import { App, normalizePath, Notice, TFile, TFolder, Vault } from 'obsidian';
import { load as parseYaml, dump as stringifyYaml } from "js-yaml";

// Copy a file to a new folder, creating the folder if needed
export async function copyFileToFolder(app: App, file: TFile, newFilePath: string) {
	const vault = app.vault;
	const targetFolder = newFilePath.substring(0, newFilePath.lastIndexOf('/'));

	if (!(await folderExists(vault, targetFolder))) {
		await vault.createFolder(targetFolder);
	}

	await vault.copy(file, newFilePath);
}

// Check if a folder exists in the vault
export async function folderExists(vault: Vault, folderPath: string): Promise<boolean> {
	try {
		const folder = vault.getAbstractFileByPath(folderPath);
		return folder instanceof TFolder;
	} catch {
		return false;
	}
}

// Wait for a given number of milliseconds
export async function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Create or update a file with new content
export async function createOrUpdateFile(vault: Vault, filePath: string, content: string) {
	const file = vault.getAbstractFileByPath(filePath);
	if (file instanceof TFile) {
		await vault.modify(file, content);
	} else {
		await vault.create(filePath, content);
	}
}

// Find a markdown file in the vault by filename
export async function findFileByName(vault: Vault, fileName: string): Promise<TFile | null> {
	return vault.getMarkdownFiles().find(f => f.name === fileName) ?? null;
}

// Extract YAML frontmatter from a file's content
export function getFileFrontmatter(fileContent: string): Record<string, any> | null {
	const lines = fileContent.split("\n");

	if (lines[0].trim() !== "---") return null;

	const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
	if (endIndex === -1) return null;

	const yamlContent = lines.slice(1, endIndex).join("\n");
	try {
		const parsed = parseYaml(yamlContent);
		return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, any> : null;
	} catch (e) {
		console.error("Failed to parse YAML frontmatter:", e);
		return null;
	}
}

// Inject or update YAML frontmatter in a file
export function setFileFrontmatter(fileContent: string, newData: Record<string, any>): string {
	const lines = fileContent.split("\n");
	let start = -1, end = -1;

	if (lines[0].trim() === "---") {
		start = 0;
		end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
	}

	let existing: Record<string, any> = {};
	if (start === 0 && end !== -1) {
		try {
			existing = parseYaml(lines.slice(1, end).join("\n")) as Record<string, any>;
		} catch (e) {
			console.error("Failed to parse existing YAML frontmatter:", e);
		}
	}

	const updated = { ...existing, ...newData };
	const yamlText = stringifyYaml(updated).trim();

	const bodyLines = (start === 0 && end !== -1) ? lines.slice(end + 1) : lines;
	return `---\n${yamlText}\n---\n${bodyLines.join("\n").trim()}`;
}

// Sanitize and format a string to be a safe topic slug
export function formatTopic(topic: string): string {
	return topic
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\/\\:*?"<>|#%{}]/g, '')
		.replace(/[^a-z0-9\- ]+/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')
		.trim();
}

// Normalize question formatting and punctuation
export function formatQuestion(question: string): string {
	return question
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/[ ]*\?+$/, '')
		.replace(/[^\w\s'"(),.-]/g, '')
		.normalize("NFKD")
		.concat('?');
}

// State file
export async function initializeStateFile(vault: Vault, outputFolder: string): Promise<Record<string, boolean>> {
    const stateFile = normalizePath(`${outputFolder}/.voltaire_state.json`);
    let state: Record<string, boolean> = {};

    try {
        if (await vault.adapter.exists(stateFile)) {
            const content = await vault.adapter.read(stateFile);
            state = JSON.parse(content);
        } else {
            // Create new state file with empty object
            await vault.adapter.write(stateFile, JSON.stringify(state));
        }
    } catch (error) {
        console.error("❌ Failed to initialize state file:", error);
        new Notice("❌ Failed to initialize processing state");
        // Return empty state but continue processing
        return {};
    }

    return state;
}

export async function cleanupStateFile(vault: Vault, outputFolder: string, success: boolean) {
    const stateFile = normalizePath(`${outputFolder}/.voltaire_state.json`);
    
    try {
        if (success) {
            // Remove state file on successful completion
            if (await vault.adapter.exists(stateFile)) {
                await vault.adapter.remove(stateFile);
            }
        } else {
            // Keep state file on failure for recovery
            const content = await vault.adapter.read(stateFile);
            const state = JSON.parse(content);
            
            // Remove any successfully processed chunks
            const cleanedState = Object.fromEntries(
                Object.entries(state).filter(([_, value]) => !value)
            );
            
            await vault.adapter.write(stateFile, JSON.stringify(cleanedState));
        }
    } catch (error) {
        console.error("❌ Failed to clean up state file:", error);
    }
}
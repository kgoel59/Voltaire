import { VoltairePluginSettings } from 'main';
import { App, normalizePath, Notice, Vault } from 'obsidian';
import { cleanupStateFile } from 'utils/tools';

export async function clearNotes(app: App, settings: VoltairePluginSettings) {
  const rawFolder = settings.input_folder; // Folder for unprocessed files
  
  const vault: Vault = app.vault;

  // Get all markdown files in the raw folder
  const rawFolderPath = normalizePath(rawFolder);
  const rawFiles = vault.getMarkdownFiles().filter(file => file.path.startsWith(rawFolderPath));

  // Iterate over each file in the raw folder
  for (const file of rawFiles) {
    // Read the file content
    app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.voltaire = false;  
    })
  }

  await cleanupStateFile(app.vault, settings.output_folder, true);

  new Notice('Finished clearing voltaire flag from notes!');
}
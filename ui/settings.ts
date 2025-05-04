import VoltairePlugin from "main";
import { App, PluginSettingTab, Setting, TFolder } from "obsidian";

export class VoltairePluginSettingTab extends PluginSettingTab {
    plugin: VoltairePlugin;
  
    constructor(app: App, plugin: VoltairePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
  
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        this.addSectionHeader(containerEl, "Folder Settings");
        this.createFolderSettings(containerEl);
        
        this.addSectionHeader(containerEl, "API Configuration");
        this.createApiSettings(containerEl);

        this.addSectionHeader(containerEl, "AI Configuration");
        this.createAIConfigSettings(containerEl);
    
        this.addSectionHeader(containerEl, "Advanced");
        this.createChunkSettings(containerEl);
        this.createSimilaritySettings(containerEl);
    }
    
    // Helper to create headers with consistent style
    private addSectionHeader(containerEl: HTMLElement, title: string) {
        new Setting(containerEl).setName(title).setHeading();
    }

    private createFolderSettings(containerEl: HTMLElement): void {
        const folders = this.getAllFolderPaths();
    
        new Setting(containerEl)
            .setName("Input Folder")
            .setDesc("Folder containing raw notes to be processed")
            .addDropdown(drop => drop
                .addOptions(folders)
                .setValue(this.plugin.settings.input_folder)
                .onChange(async (value) => {
                    this.plugin.settings.input_folder = value;
                    await this.plugin.saveSettings();
                })
            );
    
        new Setting(containerEl)
            .setName("Output Folder")
            .setDesc("Folder where summarized notes will be saved")
            .addDropdown(drop => drop
                .addOptions(folders)
                .setValue(this.plugin.settings.output_folder)
                .onChange(async (value) => {
                    this.plugin.settings.output_folder = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    // Utility: Get all folder paths in the vault
    private getAllFolderPaths(): Record<string, string> {
        const folders: Record<string, string> = {};
        const root = this.app.vault.getRoot();

        const walkFolders = (folder: TFolder) => {
            folders[folder.path] = folder.path;
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    walkFolders(child);
                }
            }
        };

        walkFolders(root);
        return folders;
    }

    private createApiSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("OpenAI API Key")
            .setDesc("Your private OpenAI API key (stored locally)")
            .addText(text => text
                .setPlaceholder("sk-...")
                .setValue(this.plugin.settings.open_api_key)
                .onChange(async (value) => {
                    this.plugin.settings.open_api_key = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Pinecone API Key")
            .setDesc("Your private Pinecone API key (stored locally)")
            .addText(text => text
                .setPlaceholder("pcsk_...")
                .setValue(this.plugin.settings.pinecone_api_key)
                .onChange(async (value) => {
                    this.plugin.settings.pinecone_api_key = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    private createChunkSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Min Chunk Size")
            .setDesc("Minimum token count for text chunks (default: 200)")
            .addText(text => text
                .setPlaceholder("200")
                .setValue(this.plugin.settings.min_chunk_size.toString())
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num)) {
                        this.plugin.settings.min_chunk_size = num;
                        await this.plugin.saveSettings();
                    }
                })
            );

        new Setting(containerEl)
            .setName("Max Chunk Size")
            .setDesc("Maximum token count for text chunks (default: 400)")
            .addText(text => text
                .setPlaceholder("400")
                .setValue(this.plugin.settings.max_chunk_size.toString())
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num)) {
                        this.plugin.settings.max_chunk_size = num;
                        await this.plugin.saveSettings();
                    }
                })
            );
    }

    private createSimilaritySettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Tag Similarity Threshold")
            .setDesc("Minimum similarity score for topics (0.0-1.0, default: 0.8)")
            .addText(text => text
                .setPlaceholder("0.80")
                .setValue(this.plugin.settings.topic_similarity_threshold.toString())
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num >= 0 && num <= 1) {
                        this.plugin.settings.topic_similarity_threshold = num;
                        await this.plugin.saveSettings();
                    }
                })
            );

        new Setting(containerEl)
            .setName("Folder Similarity Threshold")
            .setDesc("Minimum similarity score for categories (0.0-1.0, default: 0.6)")
            .addText(text => text
                .setPlaceholder("0.60")
                .setValue(this.plugin.settings.category_similarity_threshold.toString())
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num >= 0 && num <= 1) {
                        this.plugin.settings.category_similarity_threshold = num;
                        await this.plugin.saveSettings();
                    }
                })
            );

        new Setting(containerEl)
            .setName("Question Similarity Threshold")
            .setDesc("Minimum similarity score for questions (0.0-1.0, default: 0.90)")
            .addText(text => text
                .setPlaceholder("0.90")
                .setValue(this.plugin.settings.question_similarity_threshold.toString())
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num >= 0 && num <= 1) {
                        this.plugin.settings.question_similarity_threshold = num;
                        await this.plugin.saveSettings();
                    }
                })
            );

            new Setting(containerEl)
            .setName("Similar Item Count")
            .setDesc("Number of item to fetch from vector database for comparison (default: 3)")
            .addText(text => text
                .setPlaceholder("3")
                .setValue(this.plugin.settings.similar_items_count.toString())
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num >= 1) {
                        this.plugin.settings.similar_items_count = num;
                        await this.plugin.saveSettings();
                    }
                })
            );

    }
    private createAIConfigSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("AI Delay Time (ms)")
            .setDesc("Delay between AI requests to avoid rate limits (default: 100ms)")
            .addText(text => text
                .setPlaceholder("100")
                .setValue(this.plugin.settings.ai_delay_time.toString())
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0) {
                        this.plugin.settings.ai_delay_time = num;
                        await this.plugin.saveSettings();
                    }
                })
            );
    
        // Dropdown for Chat Model
        new Setting(containerEl)
            .setName("Chat Model")
            .setDesc("OpenAI model for chat completions.")
            .addDropdown(drop => drop
                .addOptions({
                    "gpt-3.5-turbo-0613": "gpt-3.5-turbo-0613",
                    "gpt-3.5-turbo-0125": "gpt-3.5-turbo-0125",
                    "o1-mini": "o1-mini",
                    "gpt-4-0613": "gpt-4-0613"
                })
                .setValue(this.plugin.settings.chat_model)
                .onChange(async (value) => {
                    this.plugin.settings.chat_model = value;
                    await this.plugin.saveSettings();
                })
            );
    
        // Dropdown for Embeddings Model
        new Setting(containerEl)
            .setName("Embeddings Model")
            .setDesc("OpenAI model for embeddings.")
            .addDropdown(drop => drop
                .addOptions({
                    "text-embedding-ada-002": "text-embedding-ada-002",
                    "text-embedding-3-small": "text-embedding-3-small",
                    "text-embedding-3-large": "text-embedding-3-large"
                })
                .setValue(this.plugin.settings.embdedding_model)
                .onChange(async (value) => {
                    this.plugin.settings.embdedding_model = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}
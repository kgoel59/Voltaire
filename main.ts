import { Plugin, Notice } from 'obsidian';
import { processNotes } from './commands/process_notes';
import { clearNotes } from './commands/clear_notes';
import { VoltairePluginSettingTab } from './ui/settings';

export interface VoltairePluginSettings {
  input_folder: string;
  output_folder: string;
  open_api_key: string;
  pinecone_api_key: string;
  min_chunk_size: number;
  max_chunk_size: number;
  topic_similarity_threshold: number;
  category_similarity_threshold: number;
  question_similarity_threshold: number;
  similar_items_count: number;
  ai_delay_time: number;
  chat_model: string;
  embdedding_model: string;
}

const DEFAULT_SETTINGS: VoltairePluginSettings = {
  input_folder: "raw_notes",
  output_folder: "summarized_notes",
  open_api_key: "sk-...",
  pinecone_api_key: "pcsk_...",
  min_chunk_size: 200,
  max_chunk_size: 400,
  topic_similarity_threshold: 0.8,
  category_similarity_threshold: 0.6,
  question_similarity_threshold: 0.9,
  similar_items_count: 3,
  ai_delay_time: 100,
  chat_model: "gpt-3.5-turbo-0125",
  embdedding_model: "text-embedding-ada-002"
};

export default class VoltairePlugin extends Plugin {
  settings: VoltairePluginSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VoltairePluginSettingTab(this.app, this));

    // Main processing command with Alt+V binding
    this.addCommand({
      id: 'voltaire-run',
      name: 'Summarize, organize, and generate questions from all notes',
      callback: async () => {
        await processNotes(this.app, this.settings);    
        new Notice('Finished organizing notes with Voltaire');
      }
    });

    // Reset command with Alt+Shift+V binding
    this.addCommand({
      id: 'voltaire-reset',
      name: 'Reset voltaire flags from notes in input folder',
      callback: async () => {
        await clearNotes(this.app, this.settings);
        new Notice('Voltaire flags cleared');
      }
    });

    // Force rebuild command with Ctrl+Alt+V binding
    this.addCommand({
      id: 'voltaire-rebuild',
      name: 'Force rebuild knowledge base (ignore cache)',
      callback: async () => {
        await clearNotes(this.app, this.settings);
        await processNotes(this.app, this.settings);
        new Notice('Knowledge base completely rebuilt');
      }
    });

    new Notice('Voltaire Plugin loaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onunload() {
    new Notice('Voltaire Plugin unloaded');
  }
}
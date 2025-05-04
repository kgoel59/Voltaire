import { App, normalizePath, Notice, Vault } from 'obsidian';
import { processor } from 'processor/processor';
import { VDB } from 'ai/vdb';
import { AI } from 'ai/ai';
import { VoltairePluginSettings } from 'main';

export async function processNotes(app: App, settings: VoltairePluginSettings) {
  try {
    new Notice('Voltaire processing started');

    if (!app || !settings) {
      throw new Error('App instance or settings are not provided');
    }

    const vault: Vault = app.vault;
    if (!vault) {
      throw new Error('Vault not available');
    }

    // Validate required settings
    if (!settings.open_api_key || !settings.pinecone_api_key) {
      throw new Error('API keys are required in settings');
    }

    // Initialize AI and vector database
    let ai: AI;
    let vdb: VDB;
    try {
      ai = new AI(
        settings.open_api_key,
        settings.ai_delay_time,
        settings.chat_model,
        settings.embdedding_model
      );
      
      vdb = new VDB(settings.pinecone_api_key, ['topics', 'categories', 'questions']);
      await vdb.createIndexes();
    } catch (error) {
      throw new Error(`Failed to initialize AI or VDB: ${error instanceof Error ? error.message : String(error)}`);
    }

    const inputFolderPath = normalizePath(settings.input_folder || '');
    if (!inputFolderPath) {
      throw new Error('Input folder path is not specified in settings');
    }

    let markdownFiles;
    try {
      markdownFiles = vault.getMarkdownFiles().filter(file =>
        file.path.startsWith(inputFolderPath)
      );
    } catch (error) {
      throw new Error(`Failed to get markdown files: ${error instanceof Error ? error.message : String(error)}`);
    }

    for (const file of markdownFiles) {
      try {
        let content: string;
        try {
          content = await vault.read(file);
        } catch (error) {
          new Notice(`Failed to read file ${file.name}. Skipping...`);
          console.error(`Error reading file ${file.path}:`, error);
          continue;
        }

        const fileName = file.name.replace('.md', '');

        // Skip already processed files
        if (content.includes('voltaire: true')) {
          continue;
        }

        // Process the note content
        let updatedContent: string;
        try {
          updatedContent = await processor(
            app,
            fileName,
            content,
            ai,
            vdb,
            settings.topic_similarity_threshold,
            settings.category_similarity_threshold,
            settings.question_similarity_threshold,
            settings.output_folder,
            settings.min_chunk_size,
            settings.max_chunk_size,
            settings.similar_items_count
          );
        } catch (error) {
          new Notice(`Failed to process file ${file.name}. Skipping...`);
          console.error(`Error processing file ${file.path}:`, error);
          continue;
        }

        // Save the updated content back to the original file
        try {
          await vault.modify(file, updatedContent);
          new Notice(`${file.name} processed successfully`);
        } catch (error) {
          new Notice(`Failed to save changes to ${file.name}`);
          console.error(`Error saving file ${file.path}:`, error);
          continue;
        }
      } catch (error) {
        console.error(`Unexpected error processing file ${file.path}:`, error);
        continue;
      }
    }

    new Notice('Voltaire processing completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    new Notice(`Voltaire processing failed: ${errorMessage}`);
    console.error('Voltaire processing error:', error);
    throw error; // Re-throw to allow calling code to handle if needed
  }
}
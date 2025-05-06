import { App, TFile, normalizePath, Notice, Vault } from "obsidian";
import { semanticChunkingWithPositions, annotateOriginalText } from "./chunker";
import { topic_prompt, summarize_prompt, question_prompt, common_topic_prompt, merge_questions_prompt } from "ai/prompt";
import { createOrUpdateFile, formatTopic, formatQuestion, findFileByName,initializeStateFile, cleanupStateFile } from "utils/tools";
import { getFileFrontmatter, setFileFrontmatter } from "utils/tools";
import { VDB } from "ai/vdb";
import { AI } from "ai/ai";


export function validateQuestion(question: string): string {
  const formatted = formatQuestion(question);
  if (!formatted || formatted.length < 3) {
    throw new Error(`Invalid question: ${question}`);
  }
  if (formatted.length > 200) {
    throw new Error(`Question too long: ${question}`);
  }
  return formatted;
}

export function validateTopic(topic: string): string {
  const formatted = formatTopic(topic);
  if (!formatted || formatted.length < 2) {
    throw new Error(`Invalid topic: ${topic}`);
  }
  return formatted;
}

export function createFrontmatter(
  existing: any,
  updates: {
    topics: string[];
    questions: string[];
    sourceFile: string;
    chunkSource: string;
  }
) {
  return {
    ...existing,
    tags: [...new Set([...(existing?.tags || []), ...updates.topics])],
    aliases: [...new Set([...(existing?.aliases || []), ...updates.questions])],
    links: [...new Set([...(existing?.links || []), `[[${updates.sourceFile}]]`])],
    chunk_source: [...new Set([...(existing?.chunk_source || []), updates.chunkSource])],
    processed_at: new Date().toISOString(),
    ...(existing?.original_id ? { original_id: existing.original_id } : {})
  };
}

export async function atomicFileUpdate(
  vault: Vault,
  file: TFile,
  newContent: string,
  newPath?: string
) {
  const originalPath = file.path;

  try {
    // Write new content to temp file
    const tempPath = originalPath + '.tmp';
    await vault.adapter.write(tempPath, newContent);

    // Rename original to backup
    const backupPath = originalPath + '.bak';
    await vault.adapter.rename(originalPath, backupPath);

    // Rename temp to original
    await vault.adapter.rename(tempPath, originalPath);

    // Optional final rename
    if (newPath) {
      await vault.adapter.rename(originalPath, newPath);
    }

    // Cleanup backup
    await vault.adapter.remove(backupPath);
  } catch (error) {
    // Attempt restoration
    if (await vault.adapter.exists(originalPath + '.bak')) {
      await vault.adapter.rename(originalPath + '.bak', originalPath);
    }
    throw error;
  }
}


export async function processor(
  app: App,
  fileName: string,
  originalContent: string,
  ai: AI,
  vdb: VDB,
  index_names: Record<string, string>,
  topicSimilarityThreshold: number,
  categorySimilarityThreshold: number,
  questionSimilarityThreshold: number,
  inputFolder: string,
  outputFolder: string,
  minChunkSize: number,
  maxChunkSize: number,
  similarItemsCount: number
) {
  new Notice(`Processing ${fileName}`);
  const vault = app.vault;
  const chunks = semanticChunkingWithPositions(originalContent.trim(), maxChunkSize, minChunkSize);
    
  // Initialize state file
  const state = await initializeStateFile(vault, outputFolder);
  let processingSuccess = false;

  try {
    const topicFolders = new Set<string>();
    const allTopics: string[] = [];
    const answeredQuestions: string[] = [];
    const stateFile = normalizePath(`${outputFolder}/.voltaire_state.json`);

    // Load processing state
    for (const chunk of chunks) {
      const chunkId = `${fileName}-${chunk.startPos}-${chunk.endPos}`;
      if (state[chunkId]) {
        continue; // Skip already processed chunks
      }

      try {
        const summary = await ai.getSummaryFromLLM(summarize_prompt(chunk.text));
        const rawQuestion = await ai.getQuestionFromLLM(question_prompt(summary));
        const rawTopic = await ai.getTopicFromLLM(topic_prompt(fileName, `${summary}\n\n${chunk}`));

        const question = validateQuestion(rawQuestion);
        const topic = validateTopic(rawTopic);

        answeredQuestions.push(question);
        allTopics.push(topic);

        let createNewFile = true;
        let finalQuestion = question;
        let mergeQuestion: string | null = null;
        let oldQuestionId = null;

        const questionEmbedding = await ai.createEmbeddings(question);
        const topicEmbedding = await ai.createEmbeddings(topic);

        const similarQuestions = await vdb.findSimilar(index_names["questions"], questionEmbedding, similarItemsCount, questionSimilarityThreshold);
        const similarTopics = await vdb.findSimilar(index_names["topics"], topicEmbedding, similarItemsCount, topicSimilarityThreshold);

        if (similarQuestions.length > 0) {
          const [mostUsed] = similarQuestions.sort((a, b) =>
            parseInt(b.metadata.usage_count) - parseInt(a.metadata.usage_count)
          );

          oldQuestionId = mostUsed.id;
          mergeQuestion = await ai.getQuestionFromLLM(merge_questions_prompt(oldQuestionId, question));
          finalQuestion = validateQuestion(mergeQuestion);

          const mergedEmbedding = await ai.createEmbeddings(finalQuestion);
          await vdb.replaceInIndex(index_names["questions"], {
            oldId: oldQuestionId,
            newId: finalQuestion,
            embedding: mergedEmbedding,
            metadata: {
              usage_count: (parseInt(mostUsed.metadata.usage_count) + 1).toString(),
              merged_from: [...(mostUsed.metadata.merged_from || []), oldQuestionId],
              original_id: oldQuestionId
            }
          });

          createNewFile = false;
        } else {
          await vdb.insertDataToIndex(index_names["questions"], finalQuestion, questionEmbedding, {
            usage_count: "1",
            merged_from: [],
            original_id: finalQuestion
          });
        }

        let finalTopic = topic;
        if (similarTopics.length > 0) {
          const [mostUsed] = similarTopics.sort((a, b) =>
            parseInt(b.metadata.usage_count) - parseInt(a.metadata.usage_count)
          );
          finalTopic = mostUsed.id;
          await vdb.updateUsageCount(index_names["topics"], finalTopic, (parseInt(mostUsed.metadata.usage_count) + 1).toString());
        } else {
          await vdb.insertDataToIndex(index_names["topics"], finalTopic, topicEmbedding, {
            usage_count: "1"
          });
        }

        const chunkSourceLink = `[[${fileName}#^${chunk.startPos}-${chunk.endPos}]]`;
        const chunkLocationBlock = `\n\n---\nquestion: ${question} \nsource: [[${fileName}]] \nlink: ${chunkSourceLink}\n\n---\n\n`;

        if (createNewFile) {
          topicFolders.add(finalTopic);
          const folderPath = normalizePath(`${outputFolder}/${finalTopic}`);
          if (!(await vault.adapter.exists(folderPath))) {
            await vault.createFolder(folderPath);
          }

          const filePath = normalizePath(`${folderPath}/${finalQuestion}.md`);
          const chunkContent = setFileFrontmatter(summary, 
            createFrontmatter({}, {
              topics: [finalTopic],
              questions: [question, finalQuestion].filter(Boolean),
              sourceFile: fileName,
              chunkSource: chunkSourceLink
            })
          );

          await createOrUpdateFile(vault, filePath, chunkContent + chunkLocationBlock);
        } else {
          const file = await findFileByName(vault, `${oldQuestionId}.md`);
          if (file) {
            const fileContent = await vault.read(file);
            const existingFrontmatter = getFileFrontmatter(fileContent) || {};

            const updatedContent = setFileFrontmatter(
              `${fileContent.replace(/^---[\s\S]*?---/, "").trim()}\n\n${summary}`,
              createFrontmatter(existingFrontmatter, {
                topics: [finalTopic],
                questions: [question, finalQuestion].filter(Boolean),
                sourceFile: fileName,
                chunkSource: chunkSourceLink
              })
            );

            const newFilePath = normalizePath(file.path.replace(/[^\/]+\.md$/, `${finalQuestion}.md`));
            await atomicFileUpdate(vault, file, updatedContent + chunkLocationBlock, newFilePath);
          }
        }

        // Mark as processed
        state[chunkId] = true;
        await vault.adapter.write(stateFile, JSON.stringify(state));
      } catch (error) {
        // Remove failed chunk from state
        delete state[chunkId];
        await vault.adapter.write(stateFile, JSON.stringify(state));
        console.error("❌ Error processing chunk:", error);
        new Notice(`❌ Error processing chunk: ${error.message}`);
      }
    }

    // Common topic organization
    if (allTopics.length > 1) {
      try {
        const rawCommonTopic = await ai.getTopicFromLLM(common_topic_prompt(allTopics));
        const commonTopic = validateTopic(rawCommonTopic);
        const parentFolder = normalizePath(`${outputFolder}/${commonTopic}`);
        const categoryEmbedding = await ai.createEmbeddings(commonTopic);

        const similarCategories = await vdb.findSimilar(index_names["categories"], categoryEmbedding, similarItemsCount, categorySimilarityThreshold);
        let finalCategory = commonTopic;

        if (similarCategories.length > 0) {
          const [mostUsed] = similarCategories.sort((a, b) =>
            parseInt(b.metadata.usage_count) - parseInt(a.metadata.usage_count)
          );
          finalCategory = mostUsed.id;
          await vdb.updateUsageCount(index_names["categories"], finalCategory, (parseInt(mostUsed.metadata.usage_count) + 1).toString());
        } else {
          await vdb.insertDataToIndex(index_names["categories"], finalCategory, categoryEmbedding, {
            usage_count: "1"
          });
        }

        for (const topic of topicFolders) {
          const oldFolder = normalizePath(`${outputFolder}/${topic}`);
          const newFolder = normalizePath(`${parentFolder}/${topic}`);

          if (await vault.adapter.exists(oldFolder)) {
            if (!(await vault.adapter.exists(parentFolder))) {
              await vault.createFolder(parentFolder);
            }

            await vault.adapter.rename(oldFolder, newFolder);
            const { files } = await vault.adapter.list(newFolder);

            for (const path of files) {
              const tfile = app.vault.getAbstractFileByPath(path);
              if (tfile instanceof TFile) {
                const content = await vault.read(tfile);
                const frontmatter = getFileFrontmatter(content) || {};
                const updatedContent = setFileFrontmatter(content, {
                  ...frontmatter,
                  category: [...new Set([...(frontmatter.category || []), finalCategory])]
                });
                await vault.modify(tfile, updatedContent);
              }
            }
          }
        }
      } catch (error) {
        console.error("❌ Failed to organize common category:", error);
        new Notice(`❌ Failed to organize common category: ${error.message}`);
      }
    }

    processingSuccess = true;
    new Notice(`✅ Voltaire processed ${chunks.length} chunks into folders.`);
    return setFileFrontmatter(annotateOriginalText(originalContent, chunks), {
      voltaire: true,
      answered_questions: [...new Set(answeredQuestions)],
      processed_at: new Date().toISOString()
    });
  } finally {
    // Clean up state file regardless of success/failure
    await cleanupStateFile(vault, outputFolder, processingSuccess);
  }
}
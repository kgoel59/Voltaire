import { Pinecone } from '@pinecone-database/pinecone';
import { Notice } from 'obsidian';

export class VDB {
  pc: Pinecone;
  index_names: string[];
  dimension: number;

  constructor(apiKey: string, index_names: Record<string, string>, dimension: number = 1536) {
    this.pc = new Pinecone({
      apiKey: apiKey
    });
    this.index_names = Object.values(index_names);;
    this.dimension = dimension;
  }

  async createIndexes() {
    const pc_indexes = await this.pc.listIndexes();
    const existingIndexNames = new Set(pc_indexes.indexes?.map(index => index.name) || []);

    for (const index_name of this.index_names) {
      if (!existingIndexNames.has(index_name)) {
        new Notice(`Creating index: ${index_name}`);
        await this.pc.createIndex({
          name: index_name,
          dimension: this.dimension,
          metric: 'cosine',
          spec: { 
            serverless: { 
              cloud: 'aws', 
              region: 'us-east-1' 
            }
          },
          waitUntilReady: true
        });
      }
    }
  }

  async insertDataToIndex(
    index_name: string, 
    id: string, 
    values: number[], 
    metadata: Record<string, any> = { usage_count: '1' }
  ) {
    const index = this.pc.Index(index_name);
    
    try {
      await index.upsert([{
        id,
        values,
        metadata
      }]);
    } catch (error) {
      console.error(`Failed to insert to ${index_name}:`, error);
      throw error;
    }
  }

  async replaceInIndex(index_name: string, params: {
    oldId: string;
    newId: string;
    embedding: number[];
    metadata: Record<string, any>;
  }) {
    const { oldId, newId, embedding, metadata } = params;
    const index = this.pc.Index(index_name);

    try {
      // Atomic operation - delete old and insert new
      await Promise.all([
        index.deleteOne(oldId),
        index.upsert([{
          id: newId,
          values: embedding,
          metadata
        }])
      ]);
    } catch (error) {
      console.error(`Failed to replace in ${index_name}:`, error);
      throw error;
    }
  }

  async updateUsageCount(
    index_name: string, 
    id: string, 
    count: string,
    additionalMetadata: Record<string, any> = {}
  ) {
    const index = this.pc.Index(index_name);
    
    try {
      // First fetch current metadata to preserve existing fields
      const current = await index.fetch([id]);
      const currentMetadata = current.records[id]?.metadata || {};
      
      await index.update({
        id,
        metadata: {
          ...currentMetadata,
          ...additionalMetadata,
          usage_count: count
        }
      });
    } catch (error) {
      console.error(`Failed to update in ${index_name}:`, error);
      throw error;
    }
  }

  async deleteDataFromIndex(index_name: string, id: string) {
    const index = this.pc.Index(index_name);
    try {
      await index.deleteOne(id);
    } catch (error) {
      console.error(`Failed to delete from ${index_name}:`, error);
      throw error;
    }
  }
  
  async findSimilar(
    index_name: string, 
    query: number[], 
    topK: number = 5, 
    scoreThreshold: number = 0.90
  ): Promise<Array<{
    id: string;
    metadata: Record<string, any>;
    score: number;
  }>> {
    const index = this.pc.Index(index_name);
    
    try {
      const queryResponse = await index.query({
        vector: query,
        topK: topK, // Query more to account for threshold filtering
        includeMetadata: true,
        includeValues: false
      });
  
      // More precise filtering with epsilon comparison
      const epsilon = 1e-8; // Small value to account for floating point precision
      const filtered = queryResponse.matches.filter(match => {
        const score = match.score ?? 0;
        return score >= (scoreThreshold - epsilon);
      });
  
      // Sort by score descending and limit to topK
      const results = filtered
        .map(match => ({
          id: match.id,
          metadata: match.metadata || {},
          score: match.score || 0
        }));
  
      return results;
    } catch (error) {
      console.error(`Failed to query ${index_name}:`, error);
      throw error;
    }
  }

  async findAllReferences(index_name: string, id: string): Promise<string[]> {
    // This is a placeholder - need a different approach
    // since Pinecone doesn't natively support reference tracking
    console.warn("findAllReferences not fully implemented for Pinecone");
    return [];
  }
}
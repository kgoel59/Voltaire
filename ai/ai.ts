import OpenAI from 'openai';
import { delay } from 'utils/tools';


export class AI {
  private client: OpenAI;
  private chat_model: string;
  private embdedding_model: string;
  private delay_time: number;

  constructor(private apiKey: string, delay_time: number, chat_model: string = 'gpt-3.5-turbo-0125' , embdedding_model: string = 'text-embedding-ada-002') {
    this.delay_time = delay_time; // Set the delay time for API calls
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    this.chat_model = chat_model;
    this.embdedding_model = embdedding_model;
  }

  async createEmbeddings(input: string): Promise<number[]> {
    await delay(this.delay_time); // Delay to avoid API rate limits

    try {
      // Call OpenAI's API to get embeddings for the input text
      const response = await this.client.embeddings.create({
        model: this.embdedding_model,
        input: input
      });
      const embeddings = response.data[0].embedding;
      return embeddings;
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      return [];
    }
  }

  async getTopicFromLLM(input_prompt: string): Promise<string> {
    await delay(this.delay_time); // Delay to avoid API rate limits
  
    const fallback = "Misc"; // Fallback topic if the model fails
    try {
      // Call OpenAI's API to get a topic for the chunk
  
      const response = await this.client.responses.create({
        model: this.chat_model,
        instructions: 'You are a helpful assistant that categorizes text into concise topics.',
        input: input_prompt,
        max_output_tokens: 20,
        temperature: 0.7
      });
  
      const topic = response.output_text.trim();
      return topic || fallback;
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      return fallback;
    }
  }

  async getSummaryFromLLM(input_prompt: string): Promise<string> {
    await delay(this.delay_time); // Delay to avoid API rate limits
    
    const fallback = "Cannot Summarized"; // Fallback if the model fails
    try {
      // Call OpenAI's API to get a topic for the chunk
  
      const response = await this.client.responses.create({
        model: this.chat_model,
        instructions: 'You are a helpful assistant that summarize text.',
        input: input_prompt,
        max_output_tokens: 200,
      });
  
      const topic = response.output_text.trim();
      return topic || fallback;
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      return fallback;
    }
  }

  async getQuestionFromLLM(input_prompt: string): Promise<string> {
    await delay(this.delay_time); // Delay to avoid API rate limits
    
    const fallback = "UnQuestionable"; // Fallback if the model fails
    try {
      // Call OpenAI's API to get a topic for the chunk
  
      const response = await this.client.responses.create({
        model: this.chat_model,
        instructions: 'You are a helpful assistant that questions the text.',
        input: input_prompt,
        max_output_tokens: 50,
      });
  
      const topic = response.output_text.trim();
      return topic || fallback;
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      return fallback;
    }
  }
}
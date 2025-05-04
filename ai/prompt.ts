/**
 * Prompt generators for topic extraction, summarization, and question generation.
 */


export const topic_prompt = (fileName: string, chunk: string): string => {
  return String.raw`
You are given a file excerpt. Based on its content, generate a single, concise topic or category that best represents the text. Answer only topic name nothing else.

File Name: ${fileName}

Content:
"""
${chunk}
"""

Topic:`.trim();
};


export const common_topic_prompt = (topics: string[]): string => {
  return String.raw`
Given the following list of topics, suggest one unifying parent topic or category that best encompasses them all. Answer only topic name nothing else, do not answer in a sentence.

Topics:
${topics.join(", ")}

Parent Topic:`.trim();
};

export const summarize_prompt = (chunk: string): string => {
  return String.raw`
Summarize the following text into 1–2 clear and concise sentences capturing the main idea.

Text:
"""
${chunk}
"""

Summary:`.trim();
};

export const question_prompt = (chunk: string): string => {
  return String.raw`
Based on the text below, generate a short, simple question (max 10 words) that someone curious about the topic might naturally ask.

Keep it clear, specific, and beginner-friendly. Avoid technical jargon.

Text:
"""
${chunk}
"""

Question:`.trim();
};

export const merge_questions_prompt = (q1: string, q2: string): string => {
  return String.raw`
  Combine the two questions below into a single clear question that tries addresse or relates to both topics. Ensure the question is not too long or complex, if merging forms a complex question return simple one (max 15 words).
  Question 1: ${q1} 
  Question 2: ${q2}
  Merged Question:`.trim();
}
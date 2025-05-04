import nlp from 'compromise';

interface ChunkWithPosition {
  text: string;
  startPos: number;
  endPos: number;
}

// Function to count the number of tokens (words) in a chunk
const countTokens = (text: string): number => {
  return text.trim().split(/\s+/).length;
};

// Modified mergeChunks to track positions
const mergeChunks = (
  chunks: ChunkWithPosition[],
  maxChunkSize: number,
  minChunkSize: number
): ChunkWithPosition[] => {
  const mergedChunks: ChunkWithPosition[] = [];
  let currentChunk: ChunkWithPosition = { text: '', startPos: 0, endPos: 0 };

  for (const chunk of chunks) {
    const combinedText = currentChunk.text ? `${currentChunk.text} ${chunk.text}` : chunk.text;
    
    if (countTokens(combinedText) <= maxChunkSize) {
      currentChunk.text = combinedText;
      currentChunk.endPos = chunk.endPos;
    } else {
      if (currentChunk.text && countTokens(currentChunk.text) >= minChunkSize) {
        mergedChunks.push(currentChunk);
        currentChunk = { ...chunk };
      } else if (currentChunk.text) {
        currentChunk.text += ` ${chunk.text}`;
        currentChunk.endPos = chunk.endPos;
      } else {
        currentChunk = { ...chunk };
      }
    }
  }

  if (currentChunk.text) {
    mergedChunks.push(currentChunk);
  }

  return mergedChunks;
};

// Main semantic chunking function that tracks positions
export const semanticChunkingWithPositions = (
  text: string,
  maxChunkSize: number = 400,
  minChunkSize: number = 200
): ChunkWithPosition[] => {
  const doc = nlp(text);
  const sentences: string[] = doc.sentences().out('array');
  
  let position = 0;
  const chunksWithPositions: ChunkWithPosition[] = [];

  for (const sentence of sentences) {
    const startPos = text.indexOf(sentence, position);
    if (startPos === -1) continue;
    
    const endPos = startPos + sentence.length;
    position = endPos;
    
    const words = nlp(sentence).terms().out('array');
    const filteredText = words
      .filter((word: string) => !nlp(word).has('#StopWord'))
      .join(' ');
      
    chunksWithPositions.push({
      text: filteredText,
      startPos,
      endPos
    });
  }

  return mergeChunks(chunksWithPositions, maxChunkSize, minChunkSize);
};

// Function to annotate original text with position markers
export const annotateOriginalText = (
  originalText: string,
  chunks: ChunkWithPosition[]
): string => {
  // We need to insert markers from last to first to avoid offset issues
  const sortedChunks = [...chunks].sort((a, b) => b.endPos - a.endPos);
  let annotatedText = originalText;

  for (const chunk of sortedChunks) {
    const marker = `\n\n^${chunk.startPos}-${chunk.endPos}\n\n`;
    annotatedText = 
      annotatedText.slice(0, chunk.endPos) + 
      marker+
      annotatedText.slice(chunk.endPos);
  }

  return annotatedText;
};
import type { Chunk, ChunkingOptions, ChunkingService } from '../models/index.js';
import { estimateTokenCount } from '../utils/token-counter.js';
import { randomUUID } from 'crypto';

/**
 * Default Chunking Service Implementation
 * Uses recursive character splitting with sentence boundary preservation
 */
export class DefaultChunkingService implements ChunkingService {
  // Sentence boundary markers
  private readonly sentenceEndings = /[.!?]+[\s\n]/g;
  
  // Paragraph separators
  private readonly paragraphSeparators = /\n\n+/g;

  /**
   * Split a document into chunks based on the provided options
   */
  chunk(content: string, documentId: string, options: ChunkingOptions): Chunk[] {
    const chunks: Chunk[] = [];
    
    if (!content || content.trim().length === 0) {
      return chunks;
    }

    // First, try to split by paragraphs
    const paragraphs = this.splitByParagraphs(content);
    
    let currentChunk = '';
    let currentStartChar = 0;
    let position = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphTokens = estimateTokenCount(paragraph);

      // If a single paragraph exceeds max size, split it further
      if (paragraphTokens > options.maxChunkSize) {
        // Save current chunk if it exists
        if (currentChunk.trim().length > 0) {
          chunks.push(this.createChunk(
            documentId,
            currentChunk.trim(),
            position++,
            currentStartChar,
            currentStartChar + currentChunk.length
          ));
          currentChunk = '';
        }

        // Split the large paragraph by sentences
        const sentenceChunks = this.splitLargeParagraph(
          paragraph,
          documentId,
          position,
          currentStartChar,
          options
        );
        
        chunks.push(...sentenceChunks);
        position += sentenceChunks.length;
        currentStartChar += paragraph.length;
        
        continue;
      }

      // Try to add paragraph to current chunk
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      const testTokens = estimateTokenCount(testChunk);

      if (testTokens <= options.maxChunkSize) {
        // Paragraph fits in current chunk
        currentChunk = testChunk;
      } else {
        // Current chunk is full, save it and start new one
        if (currentChunk.trim().length > 0) {
          chunks.push(this.createChunk(
            documentId,
            currentChunk.trim(),
            position++,
            currentStartChar,
            currentStartChar + currentChunk.length
          ));
        }
        
        currentStartChar += currentChunk.length;
        currentChunk = paragraph;
      }
    }

    // Save the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(
        documentId,
        currentChunk.trim(),
        position++,
        currentStartChar,
        currentStartChar + currentChunk.length
      ));
    }

    // Add overlap between chunks if requested
    if (options.overlapSize > 0 && chunks.length > 1) {
      return this.addOverlap(chunks, content, options.overlapSize);
    }

    return chunks;
  }

  /**
   * Split content by paragraph boundaries
   */
  private splitByParagraphs(content: string): string[] {
    return content
      .split(this.paragraphSeparators)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Split a large paragraph that exceeds max chunk size
   */
  private splitLargeParagraph(
    paragraph: string,
    documentId: string,
    startPosition: number,
    startChar: number,
    options: ChunkingOptions
  ): Chunk[] {
    const chunks: Chunk[] = [];
    
    if (options.preserveSentences) {
      // Split by sentences
      const sentences = this.splitBySentences(paragraph);
      let currentChunk = '';
      let currentStartChar = startChar;
      let position = startPosition;

      for (const sentence of sentences) {
        const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
        const testTokens = estimateTokenCount(testChunk);

        if (testTokens <= options.maxChunkSize) {
          currentChunk = testChunk;
        } else {
          // Save current chunk if it exists
          if (currentChunk.trim().length > 0) {
            chunks.push(this.createChunk(
              documentId,
              currentChunk.trim(),
              position++,
              currentStartChar,
              currentStartChar + currentChunk.length
            ));
            currentStartChar += currentChunk.length;
          }
          
          // If a single sentence is too large, split by characters
          if (estimateTokenCount(sentence) > options.maxChunkSize) {
            const charChunks = this.splitByCharacters(
              sentence,
              documentId,
              position,
              currentStartChar,
              options.maxChunkSize
            );
            chunks.push(...charChunks);
            position += charChunks.length;
            currentStartChar += sentence.length;
            currentChunk = '';
          } else {
            currentChunk = sentence;
          }
        }
      }

      // Save last chunk
      if (currentChunk.trim().length > 0) {
        chunks.push(this.createChunk(
          documentId,
          currentChunk.trim(),
          position++,
          currentStartChar,
          currentStartChar + currentChunk.length
        ));
      }
    } else {
      // Split by characters without preserving sentences
      return this.splitByCharacters(
        paragraph,
        documentId,
        startPosition,
        startChar,
        options.maxChunkSize
      );
    }

    return chunks;
  }

  /**
   * Split text by sentence boundaries
   */
  private splitBySentences(text: string): string[] {
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    this.sentenceEndings.lastIndex = 0;

    while ((match = this.sentenceEndings.exec(text)) !== null) {
      const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }

    return sentences.length > 0 ? sentences : [text];
  }

  /**
   * Split text by character count (fallback for very long sentences)
   */
  private splitByCharacters(
    text: string,
    documentId: string,
    startPosition: number,
    startChar: number,
    maxTokens: number
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const maxChars = maxTokens * 4; // Approximate characters per token
    let position = startPosition;
    let currentChar = startChar;

    for (let i = 0; i < text.length; i += maxChars) {
      const chunkText = text.substring(i, i + maxChars);
      chunks.push(this.createChunk(
        documentId,
        chunkText,
        position++,
        currentChar,
        currentChar + chunkText.length
      ));
      currentChar += chunkText.length;
    }

    return chunks;
  }

  /**
   * Add overlap between adjacent chunks
   */
  private addOverlap(chunks: Chunk[], fullContent: string, overlapSize: number): Chunk[] {
    const overlappedChunks: Chunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let content = chunk.content;
      let startChar = chunk.metadata.startChar;

      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const overlapText = this.getOverlapText(prevChunk.content, overlapSize);
        content = overlapText + ' ' + content;
        startChar = Math.max(0, startChar - overlapText.length - 1);
      }

      // Add overlap from next chunk
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapText = this.getOverlapText(nextChunk.content, overlapSize, true);
        content = content + ' ' + overlapText;
      }

      overlappedChunks.push({
        ...chunk,
        content: content.trim(),
        metadata: {
          ...chunk.metadata,
          startChar,
          endChar: startChar + content.length,
          tokenCount: estimateTokenCount(content),
        },
      });
    }

    return overlappedChunks;
  }

  /**
   * Get overlap text from a chunk
   */
  private getOverlapText(text: string, overlapSize: number, fromStart: boolean = false): string {
    const tokens = text.split(/\s+/);
    
    if (fromStart) {
      return tokens.slice(0, overlapSize).join(' ');
    } else {
      return tokens.slice(-overlapSize).join(' ');
    }
  }

  /**
   * Create a chunk object
   */
  private createChunk(
    documentId: string,
    content: string,
    position: number,
    startChar: number,
    endChar: number
  ): Chunk {
    return {
      id: randomUUID(),
      documentId,
      content,
      position,
      metadata: {
        startChar,
        endChar,
        tokenCount: estimateTokenCount(content),
      },
    };
  }
}

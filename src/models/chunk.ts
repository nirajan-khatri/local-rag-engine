/**
 * Chunking-related types and interfaces
 */

export interface ChunkMetadata {
  startChar: number;
  endChar: number;
  tokenCount: number;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  position: number;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  maxChunkSize: number;
  overlapSize: number;
  preserveSentences: boolean;
}

/**
 * Chunking Service Interface
 * Splits documents into semantically coherent chunks for embedding
 */
export interface ChunkingService {
  /**
   * Split a document into chunks based on the provided options
   */
  chunk(content: string, documentId: string, options: ChunkingOptions): Chunk[];
}

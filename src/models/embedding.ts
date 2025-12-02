/**
 * Embedding-related types and interfaces
 */

/**
 * Embedding Service Interface
 * Generates vector embeddings for text content
 */
export interface EmbeddingService {
  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in batch
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimensionality of the embeddings
   */
  getDimensions(): number;
}

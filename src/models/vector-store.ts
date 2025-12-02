/**
 * Vector Store types and interfaces
 */

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

export interface QueryOptions {
  topK: number;
  filter?: Record<string, any>;
  minScore?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

/**
 * Vector Store Interface
 * Stores and retrieves embeddings with similarity search
 */
export interface VectorStore {
  /**
   * Insert or update vectors in the store
   */
  upsert(vectors: VectorRecord[]): Promise<void>;

  /**
   * Query the vector store for similar vectors
   */
  query(queryVector: number[], options: QueryOptions): Promise<SearchResult[]>;

  /**
   * Delete vectors by their IDs
   */
  delete(ids: string[]): Promise<void>;

  /**
   * Delete all vectors associated with a document
   */
  deleteByDocumentId(documentId: string): Promise<void>;
}

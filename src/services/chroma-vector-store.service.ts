import type { VectorStore, VectorRecord, QueryOptions, SearchResult } from '../models/index.js';
import { getCollection } from '../config/chroma.js';

/**
 * ChromaDB Vector Store Implementation
 * Stores and retrieves embeddings using ChromaDB
 */
export class ChromaVectorStore implements VectorStore {
  /**
   * Insert or update vectors in the store
   */
  async upsert(vectors: VectorRecord[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    try {
      const collection = await getCollection();

      const ids = vectors.map((v) => v.id);
      const embeddings = vectors.map((v) => v.vector);
      const metadatas = vectors.map((v) => v.metadata);

      await collection.upsert({
        ids,
        embeddings,
        metadatas,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upsert vectors: ${error.message}`);
      }
      throw new Error('Failed to upsert vectors: Unknown error');
    }
  }

  /**
   * Query the vector store for similar vectors
   */
  async query(queryVector: number[], options: QueryOptions): Promise<SearchResult[]> {
    try {
      const collection = await getCollection();

      const queryResult = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: options.topK,
        where: options.filter,
      });

      // Transform ChromaDB results to our SearchResult format
      const results: SearchResult[] = [];

      if (queryResult.ids && queryResult.ids[0]) {
        const ids = queryResult.ids[0];
        const distances = queryResult.distances?.[0] || [];
        const metadatas = queryResult.metadatas?.[0] || [];

        for (let i = 0; i < ids.length; i++) {
          const distance = distances[i] ?? 1;
          // Convert distance to similarity score (cosine similarity: 1 - distance)
          const score = 1 - distance;

          // Filter by minimum score if specified
          if (options.minScore && score < options.minScore) {
            continue;
          }

          results.push({
            id: ids[i],
            score,
            metadata: metadatas[i] || {},
          });
        }
      }

      return results;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to query vectors: ${error.message}`);
      }
      throw new Error('Failed to query vectors: Unknown error');
    }
  }

  /**
   * Delete vectors by their IDs
   */
  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      const collection = await getCollection();
      await collection.delete({
        ids,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete vectors: ${error.message}`);
      }
      throw new Error('Failed to delete vectors: Unknown error');
    }
  }

  /**
   * Delete all vectors associated with a document
   */
  async deleteByDocumentId(documentId: string): Promise<void> {
    try {
      const collection = await getCollection();
      
      // Query for all vectors with this documentId
      await collection.delete({
        where: { documentId },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete vectors by document ID: ${error.message}`);
      }
      throw new Error('Failed to delete vectors by document ID: Unknown error');
    }
  }

  /**
   * Get count of vectors in the store
   */
  async count(): Promise<number> {
    try {
      const collection = await getCollection();
      return await collection.count();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to count vectors: ${error.message}`);
      }
      throw new Error('Failed to count vectors: Unknown error');
    }
  }

  /**
   * Get vectors by IDs
   */
  async get(ids: string[]): Promise<VectorRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    try {
      const collection = await getCollection();
      
      const result = await collection.get({
        ids,
      });

      const records: VectorRecord[] = [];

      if (result.ids) {
        for (let i = 0; i < result.ids.length; i++) {
          const embedding = result.embeddings?.[i];
          const metadata = result.metadatas?.[i];

          if (embedding) {
            records.push({
              id: result.ids[i],
              vector: embedding,
              metadata: metadata || {},
            });
          }
        }
      }

      return records;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get vectors: ${error.message}`);
      }
      throw new Error('Failed to get vectors: Unknown error');
    }
  }
}

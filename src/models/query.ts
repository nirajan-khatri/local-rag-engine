/**
 * Query-related types and interfaces
 */

import type { DocumentMetadata } from './document.js';

export interface SearchOptions {
  topK?: number;
  tags?: string[];
  minScore?: number;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: DocumentMetadata;
}

export interface SearchResponse {
  results: RetrievedChunk[];
  query: string;
  executionTime: number;
}

export interface AnswerOptions extends SearchOptions {
  includeContext?: boolean;
  model?: string;
}

export interface DocumentReference {
  documentId: string;
  title: string;
  url?: string;
}

export interface AnswerResponse {
  answer: string;
  sources: DocumentReference[];
  context?: RetrievedChunk[];
}

/**
 * Query Service Interface
 * Orchestrates the retrieval and generation process
 */
export interface QueryService {
  /**
   * Perform semantic search over the knowledge base
   */
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;

  /**
   * Generate an AI answer based on retrieved context
   */
  generateAnswer(query: string, options?: AnswerOptions): Promise<AnswerResponse>;
}

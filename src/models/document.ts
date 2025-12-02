/**
 * Document-related types and interfaces
 */

export type DocumentType = 'text' | 'pdf' | 'url';

export interface DocumentMetadata {
  title: string;
  source?: string;
  url?: string;
  tags: string[];
  createdAt: Date;
  author?: string;
}

export interface DocumentInput {
  type: DocumentType;
  content: string | Buffer;
  metadata: DocumentMetadata;
}

export interface ProcessedDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  extractedAt: Date;
}

export interface DocumentFilters {
  tags?: string[];
  source?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Document Processor Interface
 * Handles extraction and normalization of content from different sources
 */
export interface DocumentProcessor {
  /**
   * Process a document input and return normalized content
   */
  process(input: DocumentInput): Promise<ProcessedDocument>;
}

/**
 * Ingestion Service
 * Orchestrates the document ingestion pipeline:
 * Document Processing → Chunking → Embedding → Storage
 */

import type {
  DocumentInput,
  ProcessedDocument,
  DocumentProcessor,
  ChunkingService,
  ChunkingOptions,
  EmbeddingService,
  VectorStore,
  VectorRecord,
  Chunk,
} from '../models/index.js';
import { PrismaClient } from '@prisma/client';
import type { DocumentRepository } from '../repositories/document.repository.js';

export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  embeddingsGenerated: number;
}

export class IngestionService {
  constructor(
    private documentRepository: DocumentRepository,
    private chunkingService: ChunkingService,
    private embeddingService: EmbeddingService,
    private vectorStore: VectorStore,
    private prisma: PrismaClient,
    private processors: Map<string, DocumentProcessor>
  ) {}

  /**
   * Ingest a document through the complete pipeline
   * Uses transaction to ensure atomicity
   */
  async ingest(
    input: DocumentInput,
    chunkingOptions?: Partial<ChunkingOptions>
  ): Promise<IngestionResult> {
    // Get the appropriate processor
    const processor = this.processors.get(input.type);
    if (!processor) {
      throw new Error(`No processor found for document type: ${input.type}`);
    }

    // Step 1: Process the document
    const processedDoc = await processor.process(input);

    // Step 2: Chunk the document
    const defaultOptions: ChunkingOptions = {
      maxChunkSize: 512,
      overlapSize: 50,
      preserveSentences: true,
    };
    const options = { ...defaultOptions, ...chunkingOptions };
    const chunks = this.chunkingService.chunk(
      processedDoc.content,
      processedDoc.id,
      options
    );

    if (chunks.length === 0) {
      throw new Error('Document chunking produced no chunks');
    }

    // Step 3: Generate embeddings for all chunks
    const chunkTexts = chunks.map((chunk) => chunk.content);
    const embeddings = await this.embeddingService.embedBatch(chunkTexts);

    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`
      );
    }

    // Step 4: Store everything in a transaction
    await this.storeWithTransaction(processedDoc, chunks, embeddings);

    return {
      documentId: processedDoc.id,
      chunksCreated: chunks.length,
      embeddingsGenerated: embeddings.length,
    };
  }

  /**
   * Store document, chunks, and embeddings atomically
   */
  private async storeWithTransaction(
    document: ProcessedDocument,
    chunks: Chunk[],
    embeddings: number[][]
  ): Promise<void> {
    try {
      // Prepare vector records for vector store
      // ChromaDB requires metadata to be simple types (string, number, boolean)
      // Arrays need to be converted to strings
      const vectorRecords: VectorRecord[] = chunks.map((chunk, index) => ({
        id: chunk.id,
        vector: embeddings[index],
        metadata: {
          chunkId: chunk.id,
          documentId: document.id,
          documentTitle: document.metadata.title,
          tags: document.metadata.tags.join(','), // Convert array to comma-separated string
          source: document.metadata.source || '',
          position: chunk.position,
        },
      }));

      // Store embeddings in vector store first (outside transaction)
      await this.vectorStore.upsert(vectorRecords);

      // Then store document and chunks in database transaction
      await this.prisma.$transaction(async (tx) => {
        // Create document in database using transaction client
        await tx.document.create({
          data: {
            id: document.id,
            title: document.metadata.title,
            content: document.content,
            source: document.metadata.source,
            url: document.metadata.url,
            author: document.metadata.author,
            extractedAt: document.extractedAt,
            tags: {
              connectOrCreate: document.metadata.tags.map((tagName) => ({
                where: { name: tagName },
                create: { name: tagName },
              })),
            },
          },
        });

        // Store chunks in database with vector IDs
        for (const chunk of chunks) {
          await tx.chunk.create({
            data: {
              id: chunk.id,
              documentId: chunk.documentId,
              content: chunk.content,
              position: chunk.position,
              startChar: chunk.metadata.startChar,
              endChar: chunk.metadata.endChar,
              tokenCount: chunk.metadata.tokenCount,
              vectorId: chunk.id, // Vector ID is same as chunk ID
            },
          });
        }
      });
    } catch (error) {
      // Clean up vector store if transaction fails
      try {
        const chunkIds = chunks.map((c) => c.id);
        await this.vectorStore.delete(chunkIds);
      } catch (cleanupError) {
        // Log cleanup error but throw original error
        console.error('Failed to cleanup vectors after transaction failure:', cleanupError);
      }

      if (error instanceof Error) {
        throw new Error(`Failed to store document: ${error.message}`);
      }
      throw new Error('Failed to store document: Unknown error');
    }
  }

  /**
   * Register a document processor for a specific type
   */
  registerProcessor(type: string, processor: DocumentProcessor): void {
    this.processors.set(type, processor);
  }
}

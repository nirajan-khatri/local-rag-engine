/**
 * Property-Based Tests for Ingestion Service
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { IngestionService } from '../ingestion.service.js';
import { PrismaDocumentRepository } from '../../repositories/document.repository.js';
import { DefaultChunkingService } from '../chunking.service.js';
import { OllamaEmbeddingService } from '../ollama-embedding.service.js';
import { ChromaVectorStore } from '../chroma-vector-store.service.js';
import { TextDocumentProcessor } from '../processors/text-document.processor.js';
import { PDFDocumentProcessor } from '../processors/pdf-document.processor.js';
import { URLDocumentProcessor } from '../processors/url-document.processor.js';
import type { DocumentInput } from '../../models/index.js';

describe('Ingestion Service - Property Tests', () => {
  let prisma: PrismaClient;
  let ingestionService: IngestionService;
  let documentRepository: PrismaDocumentRepository;
  let vectorStore: ChromaVectorStore;

  beforeAll(async () => {
    prisma = new PrismaClient();
    
    // Initialize services
    documentRepository = new PrismaDocumentRepository(prisma);
    const chunkingService = new DefaultChunkingService();
    const embeddingService = new OllamaEmbeddingService();
    vectorStore = new ChromaVectorStore();

    // Create processor map
    const processors = new Map();
    processors.set('text', new TextDocumentProcessor());
    processors.set('pdf', new PDFDocumentProcessor());
    processors.set('url', new URLDocumentProcessor());

    ingestionService = new IngestionService(
      documentRepository,
      chunkingService,
      embeddingService,
      vectorStore,
      prisma,
      processors
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database before each test
    // Delete in correct order to avoid foreign key constraints
    await prisma.chunk.deleteMany();
    await prisma.document.deleteMany();
    await prisma.tag.deleteMany();
    
    // Also clean up vector store
    // Note: ChromaDB doesn't have a "delete all" so we'll rely on per-test cleanup
  });

  /**
   * **Feature: personal-knowledge-base, Property 1: Document ingestion completeness**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * For any valid text note with title and content, after ingestion the system 
   * should have stored the document with embeddings in the vector store and all 
   * metadata should be retrievable.
   */
  test('Property 1: Document ingestion completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          content: fc.string({ minLength: 10, maxLength: 1000 }).filter(s => s.trim().length >= 10),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { maxLength: 5 }),
        }),
        async (note) => {
          const input: DocumentInput = {
            type: 'text',
            content: note.content,
            metadata: {
              title: note.title,
              tags: note.tags,
              createdAt: new Date(),
            },
          };

          // Ingest the document
          const result = await ingestionService.ingest(input);

          // Small delay to ensure transaction is fully committed
          await new Promise(resolve => setTimeout(resolve, 100));

          // Verify document was stored
          const storedDoc = await documentRepository.findById(result.documentId);
          expect(storedDoc).not.toBeNull();
          expect(storedDoc!.metadata.title).toBe(note.title); // Title is stored as-is
          expect(storedDoc!.content).toBe(note.content.trim());
          expect(storedDoc!.metadata.tags).toEqual(note.tags);

          // Verify chunks were created
          expect(result.chunksCreated).toBeGreaterThan(0);
          const chunks = await prisma.chunk.findMany({
            where: { documentId: result.documentId },
          });
          expect(chunks.length).toBe(result.chunksCreated);

          // Verify embeddings were generated and stored
          expect(result.embeddingsGenerated).toBe(result.chunksCreated);
          
          // Verify embeddings are in vector store by checking count
          const vectorCount = await vectorStore.count();
          expect(vectorCount).toBeGreaterThanOrEqual(result.chunksCreated);

          // Cleanup for next iteration
          try {
            await vectorStore.deleteByDocumentId(result.documentId);
            await prisma.chunk.deleteMany({ where: { documentId: result.documentId } });
            const doc = await prisma.document.findUnique({ where: { id: result.documentId } });
            if (doc) {
              await prisma.document.delete({ where: { id: result.documentId } });
            }
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
            // Don't fail the test due to cleanup issues
          }
        }
      ),
      { numRuns: 3 } // Reduced runs due to external API calls
    );
  }, 120000); // 2 minute timeout for property test

  /**
   * **Feature: personal-knowledge-base, Property 3: PDF processing completeness**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * For any valid PDF file, after upload the system should have extracted text, 
   * created chunks, generated embeddings for all chunks, and stored them in the 
   * vector store with references to the source document.
   * 
   * Note: This test uses a mock approach to focus on testing the ingestion pipeline
   * property rather than PDF generation complexity. The property being tested is
   * that the ingestion service correctly processes PDF content through the pipeline.
   */
  test('Property 3: PDF processing completeness', async () => {
    // Since PDF generation is complex and error-prone in tests, we'll test the property
    // by mocking the PDF processor to return known content, then testing the rest of the pipeline
    const originalProcessor = ingestionService['processors'].get('pdf');
    
    // Create a mock PDF processor that returns predictable content
    const mockPDFProcessor = {
      async process(input: DocumentInput) {
        if (input.type !== 'pdf') {
          throw new Error('Mock PDF processor can only process PDF documents');
        }
        
        // Extract test content from the buffer (we'll encode it as a simple string)
        const testContent = input.content.toString('utf8');
        
        return {
          id: require('crypto').randomUUID(),
          content: testContent,
          metadata: {
            ...input.metadata,
            source: 'pdf',
          },
          extractedAt: new Date(),
        };
      }
    };

    // Replace the PDF processor temporarily
    ingestionService['processors'].set('pdf', mockPDFProcessor);

    try {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 30 })
              .map(s => s.replace(/[^a-zA-Z0-9\s]/g, 'A').trim())
              .filter(s => s.length > 0),
            content: fc.string({ minLength: 20, maxLength: 100 })
              .map(s => s.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim())
              .filter(s => s.length >= 20),
            tags: fc.array(
              fc.string({ minLength: 1, maxLength: 10 })
                .map(s => s.replace(/[^a-zA-Z0-9]/g, 'tag')), 
              { maxLength: 2 }
            ),
          }),
          async (pdfData) => {
            // Create a "PDF" buffer that contains our test content
            const pdfBuffer = Buffer.from(pdfData.content, 'utf8');

            const input: DocumentInput = {
              type: 'pdf',
              content: pdfBuffer,
              metadata: {
                title: pdfData.title,
                tags: pdfData.tags,
                createdAt: new Date(),
              },
            };

            // Ingest the PDF document
            const result = await ingestionService.ingest(input);

            // Small delay to ensure transaction is fully committed
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify document was stored
            const storedDoc = await documentRepository.findById(result.documentId);
            expect(storedDoc).not.toBeNull();
            expect(storedDoc!.metadata.title).toBe(pdfData.title);
            expect(storedDoc!.content).toBe(pdfData.content);
            expect(storedDoc!.metadata.source).toBe('pdf');

            // Verify chunks were created
            expect(result.chunksCreated).toBeGreaterThan(0);
            const chunks = await prisma.chunk.findMany({
              where: { documentId: result.documentId },
            });
            expect(chunks.length).toBe(result.chunksCreated);

            // Verify embeddings were generated for all chunks
            expect(result.embeddingsGenerated).toBe(result.chunksCreated);

            // Verify embeddings are in vector store
            const vectorCount = await vectorStore.count();
            expect(vectorCount).toBeGreaterThanOrEqual(result.chunksCreated);

            // Cleanup
            try {
              await vectorStore.deleteByDocumentId(result.documentId);
              await prisma.chunk.deleteMany({ where: { documentId: result.documentId } });
              const doc = await prisma.document.findUnique({ where: { id: result.documentId } });
              if (doc) {
                await prisma.document.delete({ where: { id: result.documentId } });
              }
            } catch (cleanupError) {
              console.error('Cleanup error:', cleanupError);
            }
          }
        ),
        { numRuns: 3 }
      );
    } finally {
      // Restore the original PDF processor
      if (originalProcessor) {
        ingestionService['processors'].set('pdf', originalProcessor);
      }
    }
  }, 120000);

  /**
   * **Feature: personal-knowledge-base, Property 4: URL ingestion completeness**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   * 
   * For any valid URL pointing to article content, after import the system should 
   * have fetched the page, extracted the main text, and stored it with metadata 
   * including URL, title, and fetch date.
   * 
   * Note: This test uses example.com which is a stable test domain.
   * In a real scenario, we would mock the HTTP calls for property testing.
   */
  test('Property 4: URL ingestion completeness - example test', async () => {
    // Using a single stable URL for this test since property testing with 
    // random URLs would be unreliable and slow
    const testUrl = 'https://example.com';
    
    const input: DocumentInput = {
      type: 'url',
      content: testUrl,
      metadata: {
        title: 'Example Domain',
        tags: ['test', 'example'],
        createdAt: new Date(),
      },
    };

    try {
      // Ingest the URL document
      const result = await ingestionService.ingest(input);

      // Small delay to ensure transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify document was stored
      const storedDoc = await documentRepository.findById(result.documentId);
      expect(storedDoc).not.toBeNull();
      expect(storedDoc!.metadata.url).toBe(testUrl);
      expect(storedDoc!.metadata.source).toBe('url');
      expect(storedDoc!.content.length).toBeGreaterThan(100);
      expect(storedDoc!.extractedAt).toBeInstanceOf(Date);

      // Verify chunks were created
      expect(result.chunksCreated).toBeGreaterThan(0);
      const chunks = await prisma.chunk.findMany({
        where: { documentId: result.documentId },
      });
      expect(chunks.length).toBe(result.chunksCreated);

      // Verify embeddings were generated
      expect(result.embeddingsGenerated).toBe(result.chunksCreated);

      // Verify embeddings are in vector store
      const vectorCount = await vectorStore.count();
      expect(vectorCount).toBeGreaterThanOrEqual(result.chunksCreated);

      // Cleanup
      try {
        await vectorStore.deleteByDocumentId(result.documentId);
        await prisma.chunk.deleteMany({ where: { documentId: result.documentId } });
        const doc = await prisma.document.findUnique({ where: { id: result.documentId } });
        if (doc) {
          await prisma.document.delete({ where: { id: result.documentId } });
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    } catch (error) {
      // If network is unavailable, skip this test
      if (error instanceof Error && error.message.includes('unreachable')) {
        console.warn('Skipping URL test - network unavailable');
        return;
      }
      throw error;
    }
  }, 120000);
});

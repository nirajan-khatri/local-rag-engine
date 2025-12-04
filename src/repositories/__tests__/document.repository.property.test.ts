/**
 * Property-based tests for Document Repository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { PrismaDocumentRepository } from '../document.repository.js';
import type { ProcessedDocument } from '../../models/index.js';
import { randomUUID } from 'crypto';

describe('Document Repository - Property Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaDocumentRepository;

  beforeEach(async () => {
    prisma = new PrismaClient();
    repository = new PrismaDocumentRepository(prisma);
    
    // Clean up database before each test
    await prisma.chunk.deleteMany();
    await prisma.document.deleteMany();
    await prisma.tag.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.chunk.deleteMany();
    await prisma.document.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.$disconnect();
  });

  // Generator for valid ProcessedDocument
  // Note: We generate unique IDs using crypto.randomUUID to avoid collisions
  const processedDocumentArb = fc.record({
    content: fc.string({ minLength: 10, maxLength: 1000 }),
    metadata: fc.record({
      title: fc.string({ minLength: 1, maxLength: 200 }),
      source: fc.option(fc.constantFrom('text', 'pdf', 'url'), { nil: undefined }),
      url: fc.option(fc.webUrl(), { nil: undefined }),
      tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
      // Use reasonable date range to avoid Prisma date conversion issues
      createdAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
      author: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    }),
    extractedAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
  }).map(doc => ({
    ...doc,
    id: randomUUID(),
  }));

  // **Feature: personal-knowledge-base, Property 12: Document listing completeness**
  it('Property 12: listing documents should return all ingested and not deleted documents', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(processedDocumentArb, { minLength: 1, maxLength: 5 }),
        async (documents) => {
          // Clean database before this property run
          await prisma.chunk.deleteMany();
          await prisma.document.deleteMany();
          await prisma.tag.deleteMany();

          // Ingest all documents
          const createdIds: string[] = [];
          for (const doc of documents) {
            const id = await repository.create(doc);
            createdIds.push(id);
          }

          // List all documents
          const listed = await repository.findAll();

          // Should return exactly the documents we created
          expect(listed.length).toBe(documents.length);

          // All created IDs should be in the list
          const listedIds = listed.map(d => d.id);
          for (const id of createdIds) {
            expect(listedIds).toContain(id);
          }

          // Now delete some documents randomly
          const docsToDelete = createdIds.slice(0, Math.floor(createdIds.length / 2));
          for (const id of docsToDelete) {
            await repository.delete(id);
          }

          // List again
          const listedAfterDelete = await repository.findAll();

          // Should only return non-deleted documents
          expect(listedAfterDelete.length).toBe(createdIds.length - docsToDelete.length);

          const listedIdsAfterDelete = listedAfterDelete.map(d => d.id);
          for (const id of docsToDelete) {
            expect(listedIdsAfterDelete).not.toContain(id);
          }

          // Clean up after this property run
          await prisma.chunk.deleteMany();
          await prisma.document.deleteMany();
          await prisma.tag.deleteMany();
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  // **Feature: personal-knowledge-base, Property 8: Tag listing completeness**
  it('Property 8: listing documents by tag should return exactly documents with that tag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(processedDocumentArb, { minLength: 2, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (documents, targetTag) => {
          // Clean database before this property run
          await prisma.chunk.deleteMany();
          await prisma.document.deleteMany();
          await prisma.tag.deleteMany();

          // Create documents, some with the target tag, some without
          const docsWithTag: string[] = [];
          const docsWithoutTag: string[] = [];

          for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            
            // Alternate: add target tag to some documents
            if (i % 2 === 0) {
              doc.metadata.tags = [...doc.metadata.tags, targetTag];
              const id = await repository.create(doc);
              docsWithTag.push(id);
            } else {
              // Ensure this doc doesn't have the target tag
              doc.metadata.tags = doc.metadata.tags.filter(t => t !== targetTag);
              const id = await repository.create(doc);
              docsWithoutTag.push(id);
            }
          }

          // Find documents by the target tag
          const foundDocs = await repository.findByTags([targetTag]);
          const foundIds = foundDocs.map(d => d.id);

          // Should return exactly the documents with the tag
          expect(foundDocs.length).toBe(docsWithTag.length);

          // All documents with the tag should be in results
          for (const id of docsWithTag) {
            expect(foundIds).toContain(id);
          }

          // No documents without the tag should be in results
          for (const id of docsWithoutTag) {
            expect(foundIds).not.toContain(id);
          }

          // Each returned document should have the target tag
          for (const doc of foundDocs) {
            expect(doc.metadata.tags).toContain(targetTag);
          }

          // Clean up after this property run
          await prisma.chunk.deleteMany();
          await prisma.document.deleteMany();
          await prisma.tag.deleteMany();
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

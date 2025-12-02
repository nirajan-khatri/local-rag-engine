import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TextDocumentProcessor } from '../text-document.processor.js';
import type { DocumentInput } from '../../../models/index.js';

describe('Text Document Processor - Property Tests', () => {
  const processor = new TextDocumentProcessor();

  it('Property 2: should reject documents with invalid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t\n  \t'),
          fc.string().filter(s => /^\s+$/.test(s))
        ),
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.string().filter(s => /^\s*$/.test(s))
        ),
        async (invalidTitle, invalidContent) => {
          const inputWithInvalidTitle: DocumentInput = {
            type: 'text',
            content: 'Valid content',
            metadata: {
              title: invalidTitle,
              tags: [],
              createdAt: new Date(),
            },
          };

          await expect(processor.process(inputWithInvalidTitle)).rejects.toThrow();

          const inputWithInvalidContent: DocumentInput = {
            type: 'text',
            content: invalidContent,
            metadata: {
              title: 'Valid Title',
              tags: [],
              createdAt: new Date(),
            },
          };

          await expect(processor.process(inputWithInvalidContent)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept valid documents with non-empty title and content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (title, content) => {
          const input: DocumentInput = {
            type: 'text',
            content,
            metadata: {
              title,
              tags: [],
              createdAt: new Date(),
            },
          };

          const result = await processor.process(input);

          expect(result.id).toBeDefined();
          expect(result.content).toBe(content.trim());
          expect(result.metadata.title).toBe(title);
          expect(result.extractedAt).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });
});

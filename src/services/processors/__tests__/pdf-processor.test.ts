import { describe, it, expect } from 'vitest';
import { PDFDocumentProcessor } from '../pdf-document.processor.js';
import type { DocumentInput } from '../../../models/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('PDFDocumentProcessor', () => {
  const processor = new PDFDocumentProcessor();

  it('should reject non-PDF document types', async () => {
    const input: DocumentInput = {
      type: 'text',
      content: Buffer.from('test'),
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow(
      'PDFDocumentProcessor can only process PDF documents'
    );
  });

  it('should reject string content', async () => {
    const input: DocumentInput = {
      type: 'pdf',
      content: 'not a buffer',
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow(
      'PDF content must be provided as Buffer'
    );
  });

  it('should reject empty buffer', async () => {
    const input: DocumentInput = {
      type: 'pdf',
      content: Buffer.from([]),
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow('PDF file is empty');
  });

  it('should reject invalid PDF data', async () => {
    const input: DocumentInput = {
      type: 'pdf',
      content: Buffer.from('This is not a valid PDF file'),
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow(/Failed to parse PDF|corrupted/);
  });
});

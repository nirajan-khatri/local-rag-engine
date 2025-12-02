import type { DocumentProcessor, DocumentInput, ProcessedDocument } from '../../models/index.js';
import { randomUUID } from 'crypto';

export class TextDocumentProcessor implements DocumentProcessor {
  async process(input: DocumentInput): Promise<ProcessedDocument> {
    if (input.type !== 'text') {
      throw new Error('TextDocumentProcessor can only process text documents');
    }

    const content = typeof input.content === 'string' 
      ? input.content 
      : input.content.toString('utf-8');

    this.validate(input.metadata.title, content);

    return {
      id: randomUUID(),
      content: content.trim(),
      metadata: {
        ...input.metadata,
        source: input.metadata.source || 'text',
      },
      extractedAt: new Date(),
    };
  }

  private validate(title: string, content: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Document title is required');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Document content cannot be empty');
    }

    if (/^\s+$/.test(content)) {
      throw new Error('Document content cannot be only whitespace');
    }
  }
}

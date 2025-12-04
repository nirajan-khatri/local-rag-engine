import type { DocumentProcessor, DocumentInput, ProcessedDocument } from '../../models/index.js';
import { randomUUID } from 'crypto';
import pdfParse from 'pdf-parse';

export class PDFDocumentProcessor implements DocumentProcessor {
  async process(input: DocumentInput): Promise<ProcessedDocument> {
    if (input.type !== 'pdf') {
      throw new Error('PDFDocumentProcessor can only process PDF documents');
    }

    if (typeof input.content === 'string') {
      throw new Error('PDF content must be provided as Buffer');
    }

    if (!input.content || input.content.length === 0) {
      throw new Error('PDF file is empty');
    }

    try {
      const pdfData = await pdfParse(input.content);
      
      const content = pdfData.text.trim();

      if (!content || content.length === 0) {
        throw new Error('PDF contains no extractable text');
      }

      return {
        id: randomUUID(),
        content,
        metadata: {
          ...input.metadata,
          source: input.metadata.source || 'pdf',
        },
        extractedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('no extractable text')) {
          throw error;
        }
        
        if (error.message.includes('Invalid PDF') || 
            error.message.includes('PDF header') ||
            error.message.includes('encrypted') ||
            error.message.includes('password')) {
          throw new Error(`PDF file is corrupted or invalid: ${error.message}`);
        }
        
        throw new Error(`Failed to parse PDF: ${error.message}`);
      }
      throw new Error('Failed to parse PDF: Unknown error');
    }
  }
}

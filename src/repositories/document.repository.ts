/**
 * Document Repository
 * Manages document metadata and content in PostgreSQL using Prisma
 */

import { PrismaClient, Document, Tag } from '@prisma/client';
import type { ProcessedDocument, DocumentFilters } from '../models/index.js';

export interface DocumentRepository {
  create(document: ProcessedDocument): Promise<string>;
  findById(id: string): Promise<ProcessedDocument | null>;
  findAll(filters?: DocumentFilters): Promise<ProcessedDocument[]>;
  update(id: string, updates: Partial<ProcessedDocument>): Promise<void>;
  delete(id: string): Promise<void>;
  findByTags(tags: string[]): Promise<ProcessedDocument[]>;
  addTags(documentId: string, tags: string[]): Promise<void>;
  removeTags(documentId: string, tags: string[]): Promise<void>;
}

type DocumentWithTags = Document & { tags: Tag[] };

export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new document with tags
   */
  async create(document: ProcessedDocument): Promise<string> {
    const created = await this.prisma.document.create({
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

    return created.id;
  }

  /**
   * Find a document by ID
   */
  async findById(id: string): Promise<ProcessedDocument | null> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { tags: true },
    });

    if (!document) {
      return null;
    }

    return this.toProcessedDocument(document);
  }

  /**
   * Find all documents with optional filters
   */
  async findAll(filters?: DocumentFilters): Promise<ProcessedDocument[]> {
    const where: any = {};

    if (filters?.source) {
      where.source = filters.source;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = {
        some: {
          name: {
            in: filters.tags,
          },
        },
      };
    }

    const documents = await this.prisma.document.findMany({
      where,
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((doc) => this.toProcessedDocument(doc));
  }

  /**
   * Find documents by tags (must have ALL specified tags)
   */
  async findByTags(tags: string[]): Promise<ProcessedDocument[]> {
    if (tags.length === 0) {
      return [];
    }

    // Find all documents and filter in memory to ensure they have ALL specified tags
    const documents = await this.prisma.document.findMany({
      where: {
        tags: {
          some: {
            name: {
              in: tags,
            },
          },
        },
      },
      include: { tags: true },
    });

    // Filter to ensure documents have ALL the tags we want
    const filtered = documents.filter((doc) => {
      const docTagNames = doc.tags.map((t) => t.name);
      return tags.every((tag) => docTagNames.includes(tag));
    });

    return filtered.map((doc) => this.toProcessedDocument(doc));
  }

  /**
   * Update a document
   */
  async update(
    id: string,
    updates: Partial<ProcessedDocument>
  ): Promise<void> {
    const data: any = {};

    if (updates.content !== undefined) {
      data.content = updates.content;
    }

    if (updates.metadata) {
      if (updates.metadata.title !== undefined) {
        data.title = updates.metadata.title;
      }
      if (updates.metadata.source !== undefined) {
        data.source = updates.metadata.source;
      }
      if (updates.metadata.url !== undefined) {
        data.url = updates.metadata.url;
      }
      if (updates.metadata.author !== undefined) {
        data.author = updates.metadata.author;
      }
      if (updates.metadata.tags !== undefined) {
        // Replace all tags
        data.tags = {
          set: [],
          connectOrCreate: updates.metadata.tags.map((tagName) => ({
            where: { name: tagName },
            create: { name: tagName },
          })),
        };
      }
    }

    if (updates.extractedAt !== undefined) {
      data.extractedAt = updates.extractedAt;
    }

    await this.prisma.document.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a document (cascades to chunks)
   */
  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({
      where: { id },
    });
  }

  /**
   * Add tags to a document
   */
  async addTags(documentId: string, tags: string[]): Promise<void> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        tags: {
          connectOrCreate: tags.map((tagName) => ({
            where: { name: tagName },
            create: { name: tagName },
          })),
        },
      },
    });
  }

  /**
   * Remove tags from a document
   */
  async removeTags(documentId: string, tags: string[]): Promise<void> {
    // Find tag IDs
    const tagRecords = await this.prisma.tag.findMany({
      where: {
        name: {
          in: tags,
        },
      },
    });

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        tags: {
          disconnect: tagRecords.map((tag) => ({ id: tag.id })),
        },
      },
    });
  }

  /**
   * Convert Prisma document to ProcessedDocument
   */
  private toProcessedDocument(doc: DocumentWithTags): ProcessedDocument {
    return {
      id: doc.id,
      content: doc.content,
      metadata: {
        title: doc.title,
        source: doc.source || undefined,
        url: doc.url || undefined,
        tags: doc.tags.map((t) => t.name),
        createdAt: doc.createdAt,
        author: doc.author || undefined,
      },
      extractedAt: doc.extractedAt,
    };
  }
}

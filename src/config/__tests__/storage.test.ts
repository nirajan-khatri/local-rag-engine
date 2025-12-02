import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient, initializeDatabase, closeDatabase, checkDatabaseHealth } from '../database.js';
import { getChromaClient, initializeVectorStore, getCollection } from '../chroma.js';

describe('Storage Setup', () => {
  beforeAll(async () => {
    await initializeDatabase();
    await initializeVectorStore();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Database', () => {
    it('should connect to PostgreSQL', async () => {
      const prisma = getPrismaClient();
      expect(prisma).toBeDefined();
    });

    it('should pass health check', async () => {
      const healthy = await checkDatabaseHealth();
      expect(healthy).toBe(true);
    });

    it('should have Document model', async () => {
      const prisma = getPrismaClient();
      const count = await prisma.document.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should have Chunk model', async () => {
      const prisma = getPrismaClient();
      const count = await prisma.chunk.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should have Tag model', async () => {
      const prisma = getPrismaClient();
      const count = await prisma.tag.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Vector Store', () => {
    it('should connect to ChromaDB', async () => {
      const client = await getChromaClient();
      expect(client).toBeDefined();
    });

    it('should respond to heartbeat', async () => {
      const client = await getChromaClient();
      const heartbeat = await client.heartbeat();
      expect(heartbeat).toBeGreaterThan(0);
    });

    it('should have knowledge_base collection', async () => {
      const collection = await getCollection();
      expect(collection).toBeDefined();
      expect(collection.name).toBe('knowledge_base');
    });

    it('should have correct collection metadata', async () => {
      const collection = await getCollection();
      const metadata = collection.metadata;
      expect(metadata).toBeDefined();
      expect(metadata?.['hnsw:space']).toBe('cosine');
    });
  });
});

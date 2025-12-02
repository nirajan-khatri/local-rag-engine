import { ChromaClient } from 'chromadb';
import { config } from './index.js';

let chromaClient: ChromaClient | null = null;

/**
 * Get or create ChromaDB client instance
 */
export async function getChromaClient(): Promise<ChromaClient> {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: config.chroma.url,
    });
  }
  return chromaClient;
}

/**
 * Initialize ChromaDB collection for the knowledge base
 */
export async function initializeVectorStore(): Promise<void> {
  try {
    const client = await getChromaClient();
    
    // Try to get existing collection first
    try {
      await client.getCollection({ name: config.chroma.collection });
      console.log(`✓ ChromaDB collection already exists: ${config.chroma.collection}`);
      return;
    } catch (error) {
      // Collection doesn't exist, create it
    }

    // Create collection with cosine similarity
    await client.createCollection({
      name: config.chroma.collection,
      metadata: {
        'hnsw:space': 'cosine',
        description: 'Personal knowledge base embeddings',
      },
    });
    console.log(`✓ Created ChromaDB collection: ${config.chroma.collection}`);
  } catch (error) {
    console.error('Failed to initialize ChromaDB:', error);
    throw new Error(`ChromaDB initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the knowledge base collection
 */
export async function getCollection() {
  const client = await getChromaClient();
  return await client.getCollection({
    name: config.chroma.collection,
  });
}

/**
 * Reset the vector store (delete and recreate collection)
 * WARNING: This will delete all embeddings!
 */
export async function resetVectorStore(): Promise<void> {
  try {
    const client = await getChromaClient();
    
    // Try to delete existing collection
    try {
      await client.deleteCollection({ name: config.chroma.collection });
      console.log(`✓ Deleted existing collection: ${config.chroma.collection}`);
    } catch (error) {
      // Collection might not exist, that's okay
      console.log('No existing collection to delete');
    }
    
    // Create new collection
    await initializeVectorStore();
  } catch (error) {
    console.error('Failed to reset vector store:', error);
    throw error;
  }
}

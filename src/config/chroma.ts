import { ChromaClient, Collection } from 'chromadb';
import { config } from './index.js';

let chromaClient: ChromaClient | null = null;
let collection: Collection | null = null;

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
    
    // Use getOrCreateCollection for idempotent initialization
    collection = await client.getOrCreateCollection({
      name: config.chroma.collection,
      metadata: {
        'hnsw:space': 'cosine',
        description: 'Personal knowledge base embeddings',
      },
    });
    
    console.log(`✓ ChromaDB collection ready: ${config.chroma.collection}`);
  } catch (error) {
    console.error('Failed to initialize ChromaDB:', error);
    throw new Error(`ChromaDB initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the knowledge base collection
 */
export async function getCollection(): Promise<Collection> {
  if (!collection) {
    await initializeVectorStore();
  }
  return collection!;
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
      collection = null;
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

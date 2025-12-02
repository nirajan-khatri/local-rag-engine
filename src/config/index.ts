import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/knowledge_base',

  // Ollama
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    llmModel: process.env.OLLAMA_LLM_MODEL || 'llama3.2',
  },

  // ChromaDB
  chroma: {
    url: process.env.CHROMA_URL || 'http://localhost:8000',
    collection: process.env.CHROMA_COLLECTION || 'knowledge_base',
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Chunking
  chunking: {
    maxChunkSize: parseInt(process.env.MAX_CHUNK_SIZE || '512', 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '50', 10),
  },

  // Query
  query: {
    defaultTopK: parseInt(process.env.DEFAULT_TOP_K || '5', 10),
    minSimilarityScore: parseFloat(process.env.MIN_SIMILARITY_SCORE || '0.5'),
  },
};

import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { initializeVectorStore } from './config/chroma.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes will be added here
// app.use('/api', apiRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
});

// Initialize storage and start server
async function startServer() {
  try {
    console.log('🚀 Starting Personal Knowledge Base API...\n');
    
    // Initialize database
    await initializeDatabase();
    
    // Initialize vector store
    await initializeVectorStore();
    
    // Start server
    const PORT = config.server.port;
    app.listen(PORT, () => {
      console.log(`\n✅ Server running on port ${PORT}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
      console.log(`Ollama URL: ${config.ollama.baseUrl}`);
      console.log(`ChromaDB URL: ${config.chroma.url}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

startServer();

export default app;

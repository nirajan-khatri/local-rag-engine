import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';

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

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Personal Knowledge Base API running on port ${PORT}`);
  console.log(`Environment: ${config.server.nodeEnv}`);
  console.log(`Ollama URL: ${config.ollama.baseUrl}`);
  console.log(`ChromaDB URL: ${config.chroma.url}`);
});

export default app;

# Personal Knowledge Base Assistant

A RAG-powered personal knowledge base system that runs completely locally with no API costs. Built with Node.js, TypeScript, Ollama, ChromaDB, and PostgreSQL.

## Features

- **Multiple Input Sources**: Text notes, PDF documents, and web articles
- **Semantic Search**: Find information based on meaning, not just keywords
- **AI-Generated Answers**: Get synthesized responses from your knowledge base
- **Tag Organization**: Organize and filter documents with tags
- **100% Free**: All components run locally - no API costs
- **Privacy-First**: Your data never leaves your machine

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (metadata) + ChromaDB (vectors)
- **LLM & Embeddings**: Ollama (local)
- **ORM**: Prisma

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Docker & Docker Compose** (for PostgreSQL and ChromaDB)
3. **Ollama** - Install from [ollama.ai](https://ollama.ai)

## Setup Instructions

### 1. Install Ollama and Pull Models

```bash
# Install Ollama (visit ollama.ai for your OS)

# Pull required models
ollama pull nomic-embed-text
ollama pull llama3.2
```

### 2. Clone and Install Dependencies

```bash
# Install npm dependencies
npm install
```

### 3. Start Database Services

```bash
# Start PostgreSQL and ChromaDB with Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 4. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env if needed (defaults should work for local development)
```

### 5. Initialize Database and Vector Store

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Initialize storage systems (database + vector store)
npm run init:storage
```

### 6. Start the Application

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Document Ingestion

- `POST /api/documents/text` - Create text note
- `POST /api/documents/pdf` - Upload PDF
- `POST /api/documents/url` - Import from URL

### Query

- `POST /api/query/search` - Semantic search
- `POST /api/query/answer` - Generate AI answer

### Document Management

- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document by ID
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/tags/:tag` - List by tag
- `PUT /api/documents/:id/tags` - Update tags

## Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm test:ui

# Run tests in watch mode
npm test -- --watch
```

## Development

```bash
# View database with Prisma Studio
npm run db:studio

# Run database migrations
npm run db:migrate
```

## Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Verify models are installed
ollama list
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres
```

### ChromaDB Issues

```bash
# Check if ChromaDB is running
curl http://localhost:8000/api/v1/heartbeat

# View logs
docker-compose logs chromadb
```

## Project Structure

```
├── src/
│   ├── api/          # Express routes and controllers
│   ├── services/     # Business logic (embedding, LLM, chunking, query)
│   ├── repositories/ # Data access layer
│   ├── models/       # TypeScript interfaces and types
│   ├── utils/        # Helper functions
│   └── config/       # Configuration management
├── prisma/
│   └── schema.prisma # Database schema
├── docker-compose.yml
└── README.md
```

## Architecture

The system follows a modular RAG architecture:

1. **Ingestion Pipeline**: Document → Extract → Chunk → Embed → Store
2. **Query Pipeline**: Query → Embed → Search → Generate Answer
3. **Storage Layer**: PostgreSQL (metadata) + ChromaDB (vectors)
4. **AI Layer**: Ollama (embeddings + LLM)

## License

MIT

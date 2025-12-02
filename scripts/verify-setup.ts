#!/usr/bin/env tsx

/**
 * Setup Verification Script
 * Checks if all required services are running and configured correctly
 */

import { config } from '../src/config/index.js';

interface ServiceCheck {
  name: string;
  url: string;
  check: () => Promise<boolean>;
}

const checks: ServiceCheck[] = [
  {
    name: 'Ollama',
    url: config.ollama.baseUrl,
    check: async () => {
      try {
        const response = await fetch(`${config.ollama.baseUrl}/api/tags`);
        if (!response.ok) return false;
        
        const data = await response.json();
        const models = data.models?.map((m: any) => m.name) || [];
        
        const hasEmbedding = models.some((m: string) => m.includes('nomic-embed-text'));
        const hasLLM = models.some((m: string) => m.includes('llama'));
        
        if (!hasEmbedding) {
          console.log('   [WARNING] Missing embedding model. Run: ollama pull nomic-embed-text');
        }
        if (!hasLLM) {
          console.log('   [WARNING] Missing LLM model. Run: ollama pull llama3.2');
        }
        
        return hasEmbedding && hasLLM;
      } catch (error) {
        return false;
      }
    },
  },
  {
    name: 'ChromaDB',
    url: config.chroma.url,
    check: async () => {
      try {
        // Try v2 API first (newer versions)
        let response = await fetch(`${config.chroma.url}/api/v2/heartbeat`);
        if (response.ok) return true;
        
        // Fallback to v1 API (older versions)
        response = await fetch(`${config.chroma.url}/api/v1/heartbeat`);
        return response.ok;
      } catch (error) {
        return false;
      }
    },
  },
  {
    name: 'PostgreSQL',
    url: config.databaseUrl,
    check: async () => {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$connect();
        await prisma.$disconnect();
        return true;
      } catch (error) {
        return false;
      }
    },
  },
];

async function verifySetup() {
  console.log('Verifying Personal Knowledge Base setup...\n');

  let allPassed = true;

  for (const check of checks) {
    process.stdout.write(`Checking ${check.name}... `);
    const passed = await check.check();
    
    if (passed) {
      console.log('[OK]');
    } else {
      console.log('[FAILED]');
      console.log(`   URL: ${check.url}`);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('[SUCCESS] All services are running correctly!');
    console.log('\nYou can now start the application with: npm run dev');
  } else {
    console.log('[ERROR] Some services are not available.');
    console.log('\nSetup instructions:');
    console.log('1. Start Docker services: docker-compose up -d');
    console.log('2. Install Ollama: https://ollama.ai');
    console.log('3. Pull models: ollama pull nomic-embed-text && ollama pull llama3.2');
    console.log('4. Run database migrations: npm run db:push');
  }
  
  process.exit(allPassed ? 0 : 1);
}

verifySetup();

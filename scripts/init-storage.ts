#!/usr/bin/env tsx

/**
 * Storage Initialization Script
 * 
 * This script initializes both the PostgreSQL database and ChromaDB vector store
 * for the Personal Knowledge Base Assistant.
 * 
 * Usage:
 *   npm run init:storage
 *   or
 *   tsx scripts/init-storage.ts
 */

import { initializeDatabase, closeDatabase, checkDatabaseHealth } from '../src/config/database.js';
import { initializeVectorStore, getChromaClient } from '../src/config/chroma.js';

async function main() {
  console.log('🚀 Initializing storage systems...\n');

  try {
    // Initialize database
    console.log('📊 Setting up PostgreSQL database...');
    await initializeDatabase();
    
    // Check database health
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      throw new Error('Database health check failed');
    }
    console.log('✓ Database is healthy\n');

    // Initialize vector store
    console.log('🔍 Setting up ChromaDB vector store...');
    await initializeVectorStore();
    
    // Verify ChromaDB connection
    const client = await getChromaClient();
    const heartbeat = await client.heartbeat();
    console.log(`✓ ChromaDB is responding (heartbeat: ${heartbeat}ms)\n`);

    console.log('✅ All storage systems initialized successfully!');
    console.log('\nYou can now:');
    console.log('  - Run the application: npm run dev');
    console.log('  - View database: npm run db:studio');
    console.log('  - Run tests: npm test');

  } catch (error) {
    console.error('\n❌ Initialization failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();

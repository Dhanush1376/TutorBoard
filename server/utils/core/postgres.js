import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL;
let pool = null;

if (POSTGRES_URL) {
  pool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  pool.on('error', (err) => {
    console.error('[Postgres] ❌ Unexpected error on idle client', err.message);
  });
} else {
  console.warn('[Postgres] ⚠️ POSTGRES_URL is not set. Memory and RAG features will be disabled.');
}


/**
 * Initialize the database schema for pgvector
 */
export async function initPostgres() {
  if (!pool) {
    console.warn('[Postgres] ⚠️ Skipping initialization as connection pool is not configured.');
    return;
  }
  const client = await pool.connect();

  try {
    console.log('[Postgres] Initializing schema...');
    
    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Create session memory table
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_memory (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        summary TEXT NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Index for faster cosine similarity search
    await client.query(`
      CREATE INDEX IF NOT EXISTS session_memory_embedding_idx ON session_memory 
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `);
    
    console.log('[Postgres] Schema initialized successfully.');
  } catch (err) {
    console.error('[Postgres] Initialization failed:', err.message);
  } finally {
    client.release();
  }
}

export default pool;

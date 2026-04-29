import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Initialize the database schema for pgvector
 */
export async function initPostgres() {
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

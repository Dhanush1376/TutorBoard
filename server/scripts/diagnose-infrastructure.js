#!/usr/bin/env node

/**
 * TutorBoard Infrastructure Diagnostic
 * 
 * Checks all services and reports which are online vs mocked/offline
 * Run: npm run diagnose
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk'; // If available, falls back to console

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

async function diagnoseInfrastructure() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║    TUTORBOARD INFRASTRUCTURE DIAGNOSTIC REPORT       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const report = {
    services: {},
    issues: [],
    recommendations: [],
  };

  // 1. Check MongoDB
  console.log('🔍 Checking MongoDB...');
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    if (mongoUri.includes('mongodb+srv')) {
      report.services.mongodb = { status: 'online', type: 'cloud', detail: 'MongoDB Atlas' };
      log.success('MongoDB: Cloud (Atlas)');
    } else if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
      report.services.mongodb = { status: 'online', type: 'local', detail: 'Local MongoDB' };
      log.success('MongoDB: Local');
    } else {
      report.services.mongodb = { status: 'online', type: 'other', detail: 'Custom MongoDB' };
      log.success('MongoDB: Custom');
    }
  } else {
    report.services.mongodb = { status: 'offline' };
    log.error('MongoDB: Not configured (MONGODB_URI missing)');
    report.issues.push('MongoDB not configured');
  }

  // 2. Check Redis
  console.log('\n🔍 Checking Redis...');
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    report.services.redis = { status: 'online', type: 'real', detail: redisUrl.substring(0, 50) + '...' };
    log.success(`Redis: Online (${redisUrl.includes('localhost') ? 'Local' : 'Cloud'})`);
  } else {
    report.services.redis = { status: 'mocked', type: 'fallback', detail: 'In-memory Map' };
    log.warn('Redis: Mocked (development fallback)');
    report.recommendations.push('Add REDIS_URL for distributed queues and workers');
  }

  // 3. Check PostgreSQL + pgvector
  console.log('\n🔍 Checking PostgreSQL + pgvector...');
  const postgresUrl = process.env.POSTGRES_URL;
  if (postgresUrl) {
    report.services.postgres = { status: 'online', type: 'configured', detail: postgresUrl.substring(0, 50) + '...' };
    log.warn('PostgreSQL: Configured (pgvector status unknown until server starts)');
    report.recommendations.push('Start server and check logs for "pgvector extension is active"');
  } else {
    report.services.postgres = { status: 'offline' };
    log.error('PostgreSQL: Not configured (POSTGRES_URL missing)');
    report.recommendations.push('Add POSTGRES_URL to enable semantic memory and RAG');
  }

  // 4. Check S3 / Cloud Storage
  console.log('\n🔍 Checking Cloud Storage...');
  const s3Bucket = process.env.S3_BUCKET;
  const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
  const s3Secret = process.env.S3_SECRET_ACCESS_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const firebaseKey = process.env.FIREBASE_PRIVATE_KEY;

  if (s3Bucket && s3AccessKey && s3Secret) {
    report.services.storage = { status: 'online', type: 's3', detail: `AWS S3: ${s3Bucket}` };
    log.success(`Storage: AWS S3 (${s3Bucket})`);
  } else if (supabaseUrl) {
    report.services.storage = { status: 'online', type: 'supabase', detail: 'Supabase Storage' };
    log.success('Storage: Supabase');
  } else if (firebaseKey) {
    report.services.storage = { status: 'online', type: 'firebase', detail: 'Firebase Storage' };
    log.success('Storage: Firebase');
  } else {
    report.services.storage = { status: 'mocked', type: 'fallback', detail: 'Local Filesystem' };
    log.warn('Storage: Mocked (local filesystem)');
    report.recommendations.push('Add S3_BUCKET and credentials for production file storage');
  }

  // 5. Check Tavily Search
  console.log('\n🔍 Checking Tavily Search API...');
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    report.services.search = { status: 'online', type: 'tavily', detail: 'Tavily Search API' };
    log.success('Search: Tavily Search API enabled');
  } else {
    report.services.search = { status: 'mocked', type: 'fallback', detail: 'Offline stub' };
    log.warn('Search: Mocked (offline stubs)');
    report.recommendations.push('Add TAVILY_API_KEY for web search augmentation');
  }

  // 6. Check AI Models
  console.log('\n🔍 Checking AI Model Keys...');
  const aiKeys = {
    openrouter: process.env.OPENROUTER_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    huggingface: process.env.HUGGINGFACE_API_KEY,
  };
  const enabledAI = Object.entries(aiKeys).filter(([_, key]) => !!key);
  if (enabledAI.length > 0) {
    report.services.ai = { status: 'online', providers: enabledAI.map(([k]) => k) };
    log.success(`AI: ${enabledAI.map(([k]) => k).join(', ')} configured`);
  } else {
    report.services.ai = { status: 'offline' };
    log.error('AI: No API keys configured');
    report.issues.push('At least one AI provider key required');
  }

  // 7. Check Authentication
  console.log('\n🔍 Checking Authentication...');
  const jwtSecret = process.env.JWT_SECRET;
  const googleAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  const githubAuth = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;

  if (jwtSecret) {
    log.success('JWT: Configured');
  } else {
    log.error('JWT: Missing JWT_SECRET');
    report.issues.push('JWT_SECRET required for authentication');
  }

  if (googleAuth) {
    log.success('OAuth: Google configured');
  } else {
    log.warn('OAuth: Google not configured');
  }

  if (githubAuth) {
    log.success('OAuth: GitHub configured');
  } else {
    log.warn('OAuth: GitHub not configured');
  }

  report.services.auth = { 
    jwt: !!jwtSecret, 
    google: googleAuth, 
    github: githubAuth 
  };

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY REPORT                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const onlineCount = Object.values(report.services).filter(s => s.status === 'online').length;
  const mockedCount = Object.values(report.services).filter(s => s.status === 'mocked').length;
  const offlineCount = Object.values(report.services).filter(s => s.status === 'offline').length;

  console.log(`Online Services:  ${onlineCount}`);
  console.log(`Mocked Services:  ${mockedCount} (development fallback)`);
  console.log(`Offline Services: ${offlineCount} (needs configuration)\n`);

  if (report.issues.length > 0) {
    console.log('⚠️  CRITICAL ISSUES:');
    report.issues.forEach(issue => console.log(`  • ${issue}`));
    console.log();
  }

  if (report.recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS FOR PRODUCTION:');
    report.recommendations.forEach(rec => console.log(`  1. ${rec}`));
    console.log();
  }

  // Service Health Matrix
  console.log('┌─────────────────┬──────────┬───────────────────────────────┐');
  console.log('│ Service         │ Status   │ Details                       │');
  console.log('├─────────────────┼──────────┼───────────────────────────────┤');

  const services = [
    ['MongoDB', report.services.mongodb],
    ['Redis', report.services.redis],
    ['PostgreSQL', report.services.postgres],
    ['Storage', report.services.storage],
    ['Search', report.services.search],
    ['AI Models', report.services.ai],
  ];

  services.forEach(([name, service]) => {
    const status = service.status === 'online' ? '✓ ONLINE' : 
                   service.status === 'mocked' ? '⚠ MOCKED' : '✗ OFFLINE';
    const detail = service.detail || service.type || 'Not configured';
    const paddedName = name.padEnd(15);
    const paddedStatus = status.padEnd(8);
    console.log(`│ ${paddedName} │ ${paddedStatus} │ ${detail.substring(0, 29).padEnd(29)} │`);
  });

  console.log('└─────────────────┴──────────┴───────────────────────────────┘\n');

  // Next Steps
  console.log('📋 NEXT STEPS:\n');
  console.log('1. Start the backend: npm run dev');
  console.log('2. Check health endpoints:');
  console.log('   - http://localhost:5000/health');
  console.log('   - http://localhost:5000/ready');
  console.log('   - http://localhost:5000/capabilities');
  console.log('\n3. If mocked services appear, configure them:');
  console.log('   - For Redis: Set REDIS_URL in .env');
  console.log('   - For PostgreSQL: Set POSTGRES_URL in .env');
  console.log('   - For Storage: Set S3_BUCKET and AWS credentials');
  console.log('   - For Search: Set TAVILY_API_KEY');
  console.log('\n');
}

diagnoseInfrastructure();

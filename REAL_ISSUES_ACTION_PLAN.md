# TutorBoard Real Remaining Issues - Action Plan

**Status**: Production infrastructure gaps + feature limitations  
**Not Critical**: All are development fallbacks with proper error handling

---

## Issue Priority Matrix

| Issue | Severity | Impact | Fix Type | Effort |
|-------|----------|--------|----------|--------|
| **Mongo Session Conflict** | CRITICAL | Session loses data | ✅ FIXED | - |
| **pgvector Missing** | HIGH | No semantic RAG | Config | 1-2h |
| **Redis Mock Mode** | HIGH | No distributed queues | Config | 30m |
| **Search Mocked** | HIGH | No web search | Config | 15m |
| **Storage Mocked** | HIGH | No cloud persistence | Config | 1h |
| **Workers/Queues** | MEDIUM | Depend on Redis | Config | Resolved by Redis |
| **Socket Distributed** | MEDIUM | Can't scale horizontally | Config | Resolved by Redis |

---

## ✅ Issue 1: Mongo Session Update Conflict (FIXED)

### Validation Status
```javascript
// ✅ FIXED - Code deployed
✓ docVersion field added to ChatSession
✓ Pre-save hook increments on modifications
✓ saveSession() uses $inc: { docVersion: 1 }
✓ beaconSave() uses $inc: { docVersion: 1 }
✓ updateCanvasState() uses $inc: { docVersion: 1 }
```

### How to Validate
```bash
# 1. Start server and create a session
curl -X POST http://localhost:3002/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Session",
    "canvasState": [],
    "messages": []
  }'

# 2. Update it twice simultaneously
# (Simulate from different clients)
curl -X POST http://localhost:3002/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sessionId": "SESSION_ID",
    "title": "Updated Title 1"
  }' &

curl -X POST http://localhost:3002/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sessionId": "SESSION_ID",
    "canvasState": [{...}]
  }' &

wait

# 3. Check docVersion incremented
# Expected: Both updates succeeded, version is 2
db.chatsessions.findOne({_id: ObjectId("SESSION_ID")})
// Should show: docVersion: 2
```

### Expected Behavior
- Both concurrent updates succeed
- No "would create a conflict" errors
- docVersion increments atomically
- No data loss

---

## 🔴 Issue 2: pgvector Extension Missing

### Current State
```
pgvector extension missing: extension "vector" is not available
RAG/Memory: DISABLED (Postgres available, pgvector not)
```

### Why It's Happening
Your PostgreSQL instance doesn't have pgvector installed. Current POSTGRES_URL points to a standard postgres instance.

### Solution: Choose One

#### **Option A: Use Neon PostgreSQL (Recommended for Easy Setup)**
```bash
# 1. Create free account at https://neon.tech
# 2. Create new project with PostgreSQL 16+
# 3. pgvector is enabled by default

# 3. Update .env
POSTGRES_URL="postgresql://USER:PASSWORD@ep-xyz.us-east-1.neon.tech/neondb?sslmode=require"

# 4. Restart server
# Server will auto-create pgvector extension
# ✓ pgvector: pgvector extension is active.
```

#### **Option B: Use Supabase (PostgreSQL + Built-in Tools)**
```bash
# 1. Create account at https://supabase.com
# 2. New project → PostgreSQL 14+ (pgvector pre-installed)
# 3. Copy Connection String

# In .env
POSTGRES_URL="postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require"

# Restart → pgvector will be auto-detected
```

#### **Option C: Docker pgvector Locally (For Testing)**
```bash
# 1. Start pgvector container
docker run --name postgres-pgvector \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tutorboard \
  -p 5432:5432 \
  -d pgvector/pgvector:latest

# 2. Wait for ready
sleep 5

# 3. Update .env
POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/tutorboard"

# 4. Restart server
```

#### **Option D: Render PostgreSQL (Production-Grade)**
```bash
# 1. Go to https://render.com
# 2. Create PostgreSQL instance
# 3. In dashboard, add pgvector extension:
#    SELECT CREATE EXTENSION IF NOT EXISTS vector;

POSTGRES_URL="postgresql://user:password@oregon-postgres.render.com:5432/tutorboard"
```

### Validation
```bash
# After updating POSTGRES_URL and restarting:

# 1. Check capability report
curl http://localhost:3002/capabilities

# Expected output:
# "rag": "online"          # ← Should say online now
# vectorSearch: "enabled"  # ← pgvector is working

# 2. Check logs
grep "pgvector extension is active" server_logs.txt
# ✨ pgvector extension is active.

# 3. Verify vector table exists
psql $POSTGRES_URL -c "SELECT 1 FROM session_memory LIMIT 1"
# Should succeed
```

---

## 🔴 Issue 3: Redis Running in Mock Mode

### Current State
```
Redis: DEV MOCK (In-Memory Map)
Queues: DEV MOCK (In-Memory Array)
Workers: DEV MOCK (Local Polling)
```

### Why It's Happening
`REDIS_URL` is not configured. System falls back to in-memory implementation.

### Solution: Choose One

#### **Option A: Local Redis (Development)**
```bash
# 1. Install Redis locally
# Mac
brew install redis
brew services start redis

# Windows (WSL)
sudo apt update && sudo apt install redis-server
sudo service redis-server start

# Verify running
redis-cli ping
# PONG

# 2. Update .env
REDIS_URL="redis://localhost:6379"

# 3. Restart server
```

#### **Option B: Docker Redis (Easiest)**
```bash
# 1. Start Redis container
docker run --name redis-tutorboard \
  -p 6379:6379 \
  -d redis:7-alpine

# 2. Update .env
REDIS_URL="redis://localhost:6379"

# 3. Restart server
```

#### **Option C: Upstash Redis (Cloud, Free Tier)**
```bash
# 1. Create account at https://upstash.com
# 2. Create new Redis database (free tier: 10GB)
# 3. Copy "UPSTASH_REDIS_URL"

# 4. Update .env
REDIS_URL="redis://default:PASSWORD@XXXXX.upstash.io:35917"

# 5. Restart server
```

#### **Option D: Railway Redis (Simple Cloud)**
```bash
# 1. Create account at https://railway.app
# 2. Add new service → Redis
# 3. Copy DATABASE_URL

# 4. Update .env
REDIS_URL="$DATABASE_URL"

# 5. Restart server
```

#### **Option E: Redis Cloud (Scalable)**
```bash
# 1. Go to https://app.redislabs.com
# 2. Create free database
# 3. Copy public endpoint

# 4. Update .env
REDIS_URL="redis://default:PASSWORD@xxxxx.cloud.redislabs.com:PORT"

# 5. Restart server
```

### Validation
```bash
# After updating REDIS_URL and restarting:

# 1. Check capability report
curl http://localhost:3002/capabilities

# Expected:
# "redis": "online"         # ← Should say online
# "queues": "online"        # ← Real BullMQ queues
# "workers": "online"       # ← Real workers

# 2. Check logs
grep "Redis Connected" server_logs.txt
# [Bootstrap] Redis Connected.

# 3. Test queue job
# Submit a chat request → should process through real queue
```

---

## 🔴 Issue 4: Search Layer Mocked

### Current State
```
Using offline search stubs in development
Search: DEV MOCK (Offline Stub)
```

### Why It's Happening
`BRAVE_SEARCH_API_KEY` not configured.

### Solution

#### **Get Brave Search API Key**
```bash
# 1. Go to https://api.search.brave.com
# 2. Sign up for free account
# 3. Get API key

# 2. Update .env
BRAVE_SEARCH_API_KEY="your-api-key-from-brave"

# 3. Restart server
```

### Validation
```bash
# After updating and restarting:

curl http://localhost:3002/capabilities

# Expected:
# "search": "online"    # ← Should say online, not "DEV MOCK"

grep "Brave" server_logs.txt
# Should have Brave initialization logs
```

---

## 🔴 Issue 5: Storage Layer Mocked

### Current State
```
Storage: DEV MOCK (Local FS)
Uploads: Local-only, not cloud-safe
```

### Why It's Happening
S3 configuration is missing. Falls back to local filesystem.

### Solution: Choose One

#### **Option A: AWS S3 (Industry Standard)**
```bash
# 1. Create AWS account at https://aws.amazon.com
# 2. Create S3 bucket: "tutorboard-uploads"
# 3. Create IAM user with S3 access
# 4. Get Access Key ID and Secret Access Key

# 5. Update .env
S3_BUCKET="tutorboard-uploads"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"

# 6. Restart server
```

#### **Option B: Cloudflare R2 (Cheaper S3 Alternative)**
```bash
# 1. Create Cloudflare account at https://dash.cloudflare.com
# 2. Create R2 bucket
# 3. Create API token with R2 permissions
# 4. Get Account ID and Bucket Name

# 5. Update .env
S3_BUCKET="your-bucket-name"
S3_REGION="auto"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"

# 6. Restart server
```

#### **Option C: Supabase Storage (Built into Supabase)**
```bash
# 1. Go to https://supabase.com
# 2. In your project, go to Storage
# 3. Create new bucket: "uploads"
# 4. Get project URL and anon key

# 5. Update .env
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_KEY="your-anon-key"

# 6. Restart server
```

#### **Option D: Firebase Storage (Google)**
```bash
# 1. Create project at https://firebase.google.com
# 2. Enable Cloud Storage
# 3. Generate service account key
# 4. Download JSON

# 5. Update .env
FIREBASE_PROJECT_ID="your-project"
FIREBASE_PRIVATE_KEY="json-key-content"

# 6. Restart server
```

### Validation
```bash
# After configuring and restarting:

curl http://localhost:3002/capabilities

# Expected:
# "storage": "online"    # ← Should not be DEV MOCK

# Test upload:
curl -X POST http://localhost:3002/api/upload \
  -F "file=@test.png" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should upload to cloud provider, not local filesystem
```

---

## 🟢 Issues 6-8: Queues, Workers, Socket (Dependent on Redis)

### Current State
```
Queues: DEV MOCK (In-Memory Array)
Workers: DEV MOCK (Local Polling)
Socket Adapter: Single-process only
```

### Why It's Happening
All depend on Redis. Once Redis is configured, these automatically upgrade.

### Solution
**Just configure Redis (Issue #3)** → Everything else upgrades automatically

### Validation
```bash
# After Redis is configured:

curl http://localhost:3002/capabilities

# Expected automatic upgrades:
# "queues": "online"      # ← Was mocked, now real BullMQ
# "workers": "online"     # ← Was polling, now proper workers
# Socket: Redis adapter   # ← Reports in logs

# Check logs:
grep -E "BullMQ|Redis adapter|worker started" server_logs.txt
# Should see Redis-backed implementations
```

---

## 🟢 Issue 9: No Production Infrastructure

### Current Architecture
```
✓ Startup: Stable, clean logging
✓ Health APIs: Complete
✓ Graceful shutdown: Robust
✓ Session persistence: Conflict-free with optimistic locking
✗ Infrastructure: All development fallbacks

Stable locally ✓
Production-scalable ✗
```

### To Reach Production-Ready

#### **Minimum Viable Production (MVP)**
```
1. ✅ Fix Mongo Session Conflict        → Already done
2. 🔴 Enable Redis                       → 30 min setup
3. 🔴 Enable PostgreSQL + pgvector      → 30 min setup
4. 🔴 Enable S3 for uploads             → 1 hour setup
5. 🔴 Enable Brave Search               → 15 min setup

Total time: ~2.5 hours
```

#### **Scale-Ready Production**
```
Above MVP + :
6. Proper logging/monitoring (Winston/Sentry)
7. Database backups (Atlas auto-backup)
8. Rate limiting (already in place)
9. DDoS protection (Cloudflare)
10. Load balancing (if multi-instance)
```

---

## 📋 Setup Checklist for Each Service

### Redis Setup Checklist
- [ ] Choose provider (Docker/Local/Cloud)
- [ ] Start Redis instance
- [ ] Get connection URL
- [ ] Add to `.env` as `REDIS_URL`
- [ ] Restart server
- [ ] Verify: `curl http://localhost:3002/capabilities` shows "online"
- [ ] Check logs for Redis connection message

### PostgreSQL + pgvector Checklist
- [ ] Choose provider (Neon/Supabase/Docker/Render)
- [ ] Create instance with pgvector
- [ ] Get connection URL
- [ ] Update `.env` as `POSTGRES_URL`
- [ ] Restart server
- [ ] Verify: Server logs show "pgvector extension is active"
- [ ] Check: `curl http://localhost:3002/capabilities` shows "rag": "online"

### Brave Search Checklist
- [ ] Sign up at https://api.search.brave.com
- [ ] Get API key
- [ ] Add to `.env` as `BRAVE_SEARCH_API_KEY`
- [ ] Restart server
- [ ] Verify: `curl http://localhost:3002/capabilities` shows "search": "online"

### S3 Storage Checklist
- [ ] Choose provider (AWS S3/Cloudflare R2/Supabase/Firebase)
- [ ] Create bucket
- [ ] Get credentials (Access Key, Secret Key, etc.)
- [ ] Add to `.env`:
  - `S3_BUCKET`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - (Optional: `S3_REGION`, `S3_ENDPOINT`)
- [ ] Restart server
- [ ] Test upload and verify files appear in cloud

---

## Recommended Quick-Start (2-3 hours to production-like setup)

### If You Have AWS Account
```bash
# 1. S3 bucket
aws s3 mb s3://tutorboard-uploads --region us-east-1

# 2. IAM user with S3 access
# (Create via AWS Console)

# 3. Docker Redis
docker run --name redis-tutorboard -p 6379:6379 -d redis:7-alpine

# 4. Neon PostgreSQL
# (Create at https://neon.tech, 5 min setup)

# 5. Brave Search API key
# (Get from https://api.search.brave.com, 5 min)

# 6. Update .env with all credentials

# 7. Restart server
npm run dev
```

### If You Don't Have AWS Account (Cloud-Only Stack)
```bash
# 1. Neon PostgreSQL (includes pgvector)
#    Free tier: https://neon.tech

# 2. Cloudflare R2 for storage
#    Free tier: https://dash.cloudflare.com

# 3. Upstash Redis
#    Free tier: https://upstash.com

# 4. Brave Search API key
#    Free tier: https://api.search.brave.com

# 5. Update .env with cloud URLs

# 6. Restart server
```

---

## Monitoring After Setup

### Health Check Endpoint
```bash
# Every 5 seconds (for monitoring)
curl http://localhost:3002/health

# Returns:
# - "status": "ok" or "degraded"
# - Individual service health
# - Timestamp and uptime
```

### Readiness Endpoint
```bash
# For Kubernetes/Docker orchestration
curl http://localhost:3002/ready

# Returns 200 if ready for traffic, 503 if not
```

### Capabilities Report
```bash
# Detailed system state
curl http://localhost:3002/capabilities

# Shows which services are online/mocked/offline
```

### Real-Time Logs
```bash
# Watch startup
tail -f server_logs.txt | grep "Bootstrap\|CAPABILITY"

# Watch runtime
tail -f server_logs.txt | grep "ERROR\|WARN"
```

---

## Summary: What's Already Working vs What Needs Setup

### Already Working ✅
- HTTP server startup
- Health check APIs (/health, /ready, /capabilities)
- Graceful shutdown with detailed logging
- Session persistence with conflict detection (optimistic locking)
- MongoDB connection (Atlas or in-memory fallback)
- Development mode with all fallbacks

### Needs Configuration 🔴
1. Redis (queues, workers, distributed socket)
2. PostgreSQL + pgvector (semantic memory/RAG)
3. Brave Search API (web search augmentation)
4. S3 or equivalent (persistent file storage)

### Impact of Each Missing Service
- **No Redis**: Local workers only, can't scale horizontally
- **No pgvector**: Can't retrieve similar past sessions
- **No Brave Search**: Can't augment responses with web results
- **No S3**: Uploads stored locally, lost on server restart

---

## Next Steps

1. **Immediate** (5 min): Decide which cloud provider(s) to use
2. **Setup** (2-3 hours): Configure each service and get credentials
3. **Integration** (30 min): Add credentials to .env and test
4. **Validation** (15 min): Run health check and verify all "online"
5. **Production** (Optional): Add monitoring, backups, CDN

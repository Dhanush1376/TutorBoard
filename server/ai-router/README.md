# 🚀 TutorBoard Plug-and-Play AI Router

A production-ready, modular AI routing system designed for high availability and fault tolerance.

## 🏗️ Architecture

- `/providers`: Isolated wrappers for Gemini, Groq, OpenRouter, and HF.
- `/router`: Core fallback and intent-detection logic.
- `/utils`: Standardized formatting, logging, and retry mechanisms.
- `/config`: Easy-to-tune priority and timeout settings.

## ⚙️ Setup

1. **API Keys**: Add your keys to the root `.env` file (use `.env.example` as a guide).
2. **Mounting**: The router is already mounted in `server/index.js` under `/api/ai`.
3. **Usage**:
   ```bash
   curl -X POST http://localhost:3001/api/ai/ask \
     -H "Content-Type: application/json" \
     -d '{"query": "How does binary search work?"}'
   ```

## 🔀 Routing Strategy

1. **Intent Detection**: Automatically prioritizes **Groq** for coding queries.
2. **Fallback Chain**: Gemini → Groq → OpenRouter.
3. **Retry Logic**: Every provider attempt includes a 2x retry with exponential backoff.

## 📦 Standard Output

All providers are guaranteed to return:
```json
{
  "steps": ["Step 1", "Step 2"],
  "explanation": "pedagogical text",
  "visualization": ["canvas instructions"]
}
```

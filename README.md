<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen.svg" alt="Active" />
  <img src="https://img.shields.io/badge/React-19.2-blue.svg" alt="React" />
  <img src="https://img.shields.io/badge/Express-MVC-purple.svg" alt="Express" />
  <img src="https://img.shields.io/badge/AI-OpenRouter-orange.svg" alt="OpenRouter" />

  <h1>TutorBoard</h1>
  <p>An AI-powered interactive whiteboard that translates complex university-level computer science algorithms and mathematics into step-by-step visual animations.</p>
</div>

---

## Features

- **Semantic AI Understanding**: Pass natural language prompts like *"Explain Bubble Sort on [5,3,8]"* or *"Graph y = 2x + 1"*.
- **Interactive Visualizations**: Converts logic directly into interactive SVG-based visual structures.
  - **Compare**: Highlights pointers and conditions during searches (e.g., Binary Search).
  - **Swap**: Animates nodes shifting physically during sorts.
  - **Highlight**: Tracks elements securely across operations.
  - **Graphs**: Translates math functions natively to X/Y Cartesian plots using D3.js.
- **Cinematic UI**: High-end Framer Motion and GSAP animations designed for tactile, professional flow.
- **Minimal Workspace**: Pitch-perfect Dark/Light mode SaaS aesthetic using Tailwind v4.

---

## 🚀 Deployment

### Vercel (Frontend)
TutorBoard is optimized for Vercel. Note that `vercel.json` uses static rewrites for the `/api` proxy.

> [!IMPORTANT]
> If you change your Render backend URL, you **must** update the `destination` field in `vercel.json` (line 6 and line 35) to match your new production backend URL.

### Render (Backend)
- **Cold Starts**: On the free tier, the backend spins down after 15 minutes of inactivity. The frontend includes a "Warming Up" state and extended timeouts (90s) to handle the 30-60s spin-up time.
- **Graceful Shutdown**: The server implements graceful shutdown for critical errors, ensuring Socket.IO connections are closed cleanly before the process restarts.

## 🤝 Contributing

---

## Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/TutorBoard.git
   cd TutorBoard
   ```

2. **Configure Environment Variables**
   
   **Server**: Create `server/.env` (see `.env.example` for details):
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_uri
   OPENROUTER_API_KEY=your_key
   JWT_SECRET=your_secret
   ENCRYPTION_KEY=your_32_byte_hex_key
   FRONTEND_URL=http://localhost:5173
   ```

   **Client**: Create `client/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:5000
   ```

3. **Install Dependencies**
   ```bash
   # Install root, client, and server dependencies
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

4. **Launch Application**
   ```bash
   # In terminal 1 (Server)
   cd server && npm run dev
   
   # In terminal 2 (Client)
   cd client && npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:5000`

---

## Tech Stack

### Client (Frontend)
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 (Glassmorphism, Minimalist)
- **Canvas / Graphics**: SVG + Framer Motion + D3.js
- **Animations**: GSAP + Framer Motion
- **State Management**: Zustand

### Server (Backend)
- **Architecture**: Node.js + Express (Modular MVC)
- **Intelligence Engine**: Multiple Models via OpenRouter (Gemini, Claude, GPT-4)
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.IO

---

## 📄 License
This project is open-source and available under the MIT License.

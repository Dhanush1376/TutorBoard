<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen.svg" alt="Active" />
  <img src="https://img.shields.io/badge/React-19.2-blue.svg" alt="React" />
  <img src="https://img.shields.io/badge/Express-MVC-purple.svg" alt="Express" />
  <img src="https://img.shields.io/badge/AI-DeepSeek_Core-black.svg" alt="DeepSeek" />

  <h1>TutorBoard 🧠</h1>
  <p>An AI-powered interactive whiteboard that translates complex university-level computer science algorithms and mathematics into step-by-step visual animations.</p>
</div>

---

## ✨ Features

- **Semantic AI Understanding**: Pass natural language prompts like *"Explain Bubble Sort on [5,3,8]"* or *"Graph y = 2x + 1"*.
- **Interactive Visualizations**: Converts logic directly into interactive Konva.js visual structures.
  - 🟡 **Compare**: Highlights pointers and conditions during searches (e.g., Binary Search).
  - 🔴 **Swap**: Animates nodes shifting physically during sorts.
  - 🟢 **Highlight**: Tracks elements securely across operations.
  - 🟣 **Graphs**: Translates math functions natively to X/Y Cartesian plots.
- **Physics-Based UI**: High-end `@react-spring/konva` animations designed for tactile, professional flow.
- **Minimal Workspace**: Pitch-perfect Dark/Light mode SaaS aesthetic using Tailwind v4.

---

## 📸 Screenshots

*(Replace these placeholders with actual screenshots of your application)*

| Board View | Algorithm Explanation |
|---|---|
| <img width="400" src="https://via.placeholder.com/400x250?text=Interactive+Board" /> | <img width="400" src="https://via.placeholder.com/400x250?text=Bubble+Sort+Animation" /> |

---

## 🚀 Quick Setup (Windows)

We've automated the entire setup process.

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/TutorBoard.git
   cd TutorBoard
   ```

2. **Configure AI Identity**
   Create a `.env` file in the `server` directory and add your DeepSeek API key:
   ```env
   OPENAI_API_KEY=sk-your-deepseek-key-here
   PORT=3001
   ```

3. **Install Dependencies**
   Double-click the inclusive `setup.bat` file, or run:
   ```bash
   ./setup.bat
   ```

4. **Launch Application**
   Double-click `dev.bat` to concurrently start the Node API and Vite UI.
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`

---

## 🛠️ Tech Stack

### Client (Frontend)
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 (Glassmorphism, Minimalist)
- **Canvas / Graphics**: Konva.js + `react-konva`
- **Animations**: `@react-spring/konva` and `tailwindcss-animate`

### Server (Backend)
- **Architecture**: Node.js + Express (Modular MVC)
- **Intelligence Engine**: DeepSeek via `openai` Node SDK

---

## 📄 License
This project is open-source and available under the MIT License.

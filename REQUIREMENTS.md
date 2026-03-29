# TutorBoard Project Requirements

All necessary dependencies and environment settings for the TutorBoard AI platform.

## ⚙️ System Requirements
- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher
- **OS**: Windows (Full support), macOS/Linux (scripts may need .sh adjustment)

## 📦 Core Dependencies

### Frontend (client)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| `react` | ^19.2.4 | UI Framework |
| `vite` | ^8.0.1 | Build Tool / Dev Server |
| `tailwindcss` | ^4.2.2 | CSS Framework (v4) |
| `@tailwindcss/vite` | ^4.2.2 | Tailwind v4 Vite Plugin |
| `konva` | ^10.2.3 | Canvas Engine |
| `react-konva` | ^19.2.3 | React Wrapper for Konva |
| `@react-spring/konva`| ^10.0.3 | Physics Animations |
| `lucide-react` | ^1.7.0 | Icon Library |
| `react-router-dom` | ^7.13.2 | Navigation |

### Backend (server)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| `express` | ^5.2.1 | Web Server |
| `openai` | ^6.33.0 | DeepSeek/OpenAI API Client |
| `cors` | ^2.8.6 | Cross-Origin Resource Sharing |
| `dotenv` | ^17.3.1 | Environment Variable Management |

## 🔑 Environment Variables
Create a `.env` file in the `server` directory with the following:
```env
OPENAI_API_KEY=your_deepseek_api_key_here
PORT=3001
```

## 🛠️ Commands
- **Install All**: `npm install` (run in both folders) or use `setup.bat`.
- **Run All**: `npm run dev` (client) and `npm start` (server) or use `dev.bat`.

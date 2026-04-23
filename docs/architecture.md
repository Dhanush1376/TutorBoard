# 🧠 TutorBoard — Full Architecture Graph

> AI-powered interactive teaching platform with real-time canvas rendering, multi-agent lesson generation, and adaptive learning.

---

## 🏗️ System Overview

```mermaid
graph TB
    subgraph EXTERNAL["☁️ External Services"]
        GOOGLE["Google OAuth"]
        LLM["LLM Providers<br/>(Gemini / OpenAI / Claude)"]
        MONGO[(MongoDB Atlas)]
        REDIS[(Redis Cache)]
    end

    subgraph CLIENT["🖥️ Client — React + Vite"]
        APP["App.jsx<br/>Router + Auth Guard"]
        PAGES["Pages Layer"]
        COMPONENTS["Component Layer"]
        STORE["Zustand Store"]
        HOOKS["Hooks Layer"]
        ENGINE_C["Client Engine"]
        RENDERERS["Renderer Layer"]
    end

    subgraph SERVER["⚙️ Server — Express + Socket.IO"]
        INDEX["index.js<br/>HTTP + WS Entry"]
        ROUTES["REST Routes"]
        CONTROLLERS["Controllers"]
        MIDDLEWARE["Middleware"]
        SOCKETS["Socket.IO Layer"]
        ENGINE_S["Teaching Engine"]
        AGENTS["6-Agent AI Pipeline"]
        MODELS["Mongoose Models"]
    end

    CLIENT <-->|"WebSocket<br/>(Socket.IO)"| SOCKETS
    CLIENT <-->|"REST API<br/>(Axios)"| ROUTES
    ROUTES --> MIDDLEWARE --> CONTROLLERS
    CONTROLLERS --> MODELS --> MONGO
    SOCKETS --> ENGINE_S --> AGENTS --> LLM
    ENGINE_S --> REDIS
    ENGINE_S --> MODELS
    APP --> GOOGLE

    style CLIENT fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#f8fafc
    style SERVER fill:#0f172a,stroke:#22c55e,stroke-width:2px,color:#f8fafc
    style EXTERNAL fill:#1e1b4b,stroke:#a78bfa,stroke-width:2px,color:#f8fafc
```

---

## 📂 File Tree (Annotated)

```
TutorBoard/
├── .github/workflows/
│   └── ci.yml                    # CI/CD: tests, npm audit, gitleaks
├── .infrastructure/
│   └── cloudflare.md             # CDN config documentation
│
├── client/                       # ══════ FRONTEND ══════
│   └── src/
│       ├── main.jsx              # Vite entry, providers
│       ├── App.jsx               # Router, auth guard, theme
│       ├── index.css             # Design system tokens
│       │
│       ├── pages/
│       │   ├── Home.jsx          # Main workspace (49KB)
│       │   ├── AuthLanding.jsx   # Login / signup
│       │   └── Settings.jsx      # Modular settings shell
│       │
│       ├── context/
│       │   ├── AuthContext.jsx   # Google OAuth + JWT
│       │   └── ThemeContext.jsx  # Dark/Light system
│       │
│       ├── store/
│       │   ├── tutorStore.js     # Zustand root (5 slices)
│       │   └── slices/
│       │       ├── canvasSlice   # Canvas objects, steps, transform
│       │       ├── chatSlice     # Messages, doubts, delta state
│       │       ├── controlSlice  # Playback, notes, undo/redo
│       │       ├── sessionSlice  # Session lifecycle, sync
│       │       └── uiSlice      # Theme, layout, preferences
│       │
│       ├── hooks/
│       │   ├── useTeachingMachine.js  # Socket event orchestrator
│       │   ├── useSocket.js           # Socket.IO connection
│       │   ├── useSessionSync.js      # MongoDB auto-sync
│       │   └── useClickOutside.js     # UI utility
│       │
│       ├── engine/
│       │   ├── VisualScriptInterpreter.jsx  # GSAP animation driver
│       │   ├── GSAPExecutor.js              # Tween execution
│       │   ├── RendererRouter.js            # SVG/D3/Matter picker
│       │   └── CanvasStateSnapshot.js       # State serialization
│       │
│       ├── components/
│       │   ├── canvas/           # ── Drawing Engine ──
│       │   │   ├── InfiniteCanvas.jsx        # Pan/Zoom viewport
│       │   │   ├── InteractiveCanvasLayer    # Pointer → shapes
│       │   │   ├── SVGCanvasRenderer.jsx     # Object → SVG
│       │   │   ├── AgentCanvasRenderer.jsx   # AI element router
│       │   │   ├── InlineEditor.jsx          # Rich text editing
│       │   │   ├── FloatingFormatBar.jsx     # Selection toolbar
│       │   │   ├── CodeVisualizerModal.jsx   # Code runner
│       │   │   └── CanvasMinimap.jsx         # Navigation minimap
│       │   │
│       │   ├── teaching/         # ── Lesson UI ──
│       │   │   ├── TeachingSession.jsx   # Session orchestrator
│       │   │   ├── StepPanel.jsx         # Step content renderer
│       │   │   ├── StepFilmstrip.jsx     # Timeline navigation
│       │   │   ├── NarrationBar.jsx      # Voice narration bar
│       │   │   ├── DoubtPanel.jsx        # Question submission
│       │   │   ├── DoubtThread.jsx       # Conversation history
│       │   │   ├── MasteryHUD.jsx        # Progress analytics
│       │   │   ├── SessionOverlay.jsx    # Generation progress
│       │   │   ├── ShortcutsHUD.jsx      # Keyboard shortcuts
│       │   │   └── QuizRenderer.jsx      # Checkpoint quizzes
│       │   │
│       │   ├── toolbar/          # ── Tool System ──
│       │   │   ├── Toolbar.jsx           # Layout + shortcuts
│       │   │   ├── tools/
│       │   │   │   ├── ToolButtonBase    # Shared button logic
│       │   │   │   ├── DrawTool          # Pen/Marker/Laser/Eraser
│       │   │   │   ├── ShapeTool         # 10 geometric primitives
│       │   │   │   ├── TextTool          # Heading/Body/Caption
│       │   │   │   ├── NoteTool          # Sticky notes
│       │   │   │   └── VisualizerTool    # Code visualizer
│       │   │   └── actions/
│       │   │       ├── ShareAction       # Export / share
│       │   │       └── DeleteAction      # Clear canvas
│       │   │
│       │   └── renderers/        # ── Shape Library ──
│       │       ├── CinematicShapes.jsx   # Re-export barrel
│       │       ├── shapes/
│       │       │   ├── AnimatedWrapper   # Motion.g + selection
│       │       │   ├── BaseShapes        # Rect, Ellipse, Diamond...
│       │       │   ├── DataShapes        # BarChart, PieChart...
│       │       │   ├── NotationShapes    # Arrow, Bracket, Brace
│       │       │   ├── PresentationShapes # Code, Badge, Callout
│       │       │   ├── ScientificShapes  # Molecule, Waveform
│       │       │   └── StickyNoteShape   # Editable sticky note
│       │       └── D3Renderer.jsx        # D3.js canvas engine
│       │
│       └── renderers/
│           ├── KaTeXRenderer.jsx     # LaTeX math rendering
│           └── D3Renderer.jsx        # D3 visualization engine
│
├── server/                       # ══════ BACKEND ══════
│   ├── index.js                  # Express + Mongo + Socket.IO
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT verification
│   │   ├── rateLimiter.js        # Redis-backed rate limiting
│   │   ├── requestIdMiddleware   # Correlation IDs
│   │   └── validation.middleware # Input sanitization
│   │
│   ├── routes/
│   │   ├── auth.js               # POST /login, /register, /google
│   │   ├── session.js            # GET/POST /sessions
│   │   ├── apikeys.js            # CRUD /apikeys
│   │   ├── doubt.js              # POST /doubts
│   │   ├── generate.js           # POST /generate
│   │   └── user.js               # GET/PUT /user
│   │
│   ├── controllers/
│   │   ├── auth.controller       # OAuth + JWT issuance
│   │   ├── session.controller    # Session CRUD + sync
│   │   ├── apikeys.controller    # Encrypted key management
│   │   ├── doubt.controller      # Doubt persistence
│   │   ├── generate.controller   # Generation trigger
│   │   └── user.controller       # Profile management
│   │
│   ├── models/
│   │   ├── User.js               # Auth + preferences
│   │   ├── ChatSession.js        # Session + canvas state
│   │   ├── LearnerProfile.js     # Mastery + confusion index
│   │   ├── Doubt.js              # Question history
│   │   ├── ActivityLog.js        # Usage analytics
│   │   ├── UsageLog.js           # API consumption
│   │   └── RevokedToken.js       # Token blacklist
│   │
│   ├── sockets/
│   │   ├── teaching.socket.js    # Socket.IO namespace
│   │   ├── utils.js              # Auth + helpers
│   │   └── handlers/
│   │       ├── session.js        # teaching:start → pipeline
│   │       ├── doubt.js          # teaching:doubt → delta
│   │       └── navigation.js     # teaching:nav → step jump
│   │
│   └── engine/
│       ├── core/
│       │   ├── agentLoop.js          # 6-agent orchestrator (19KB)
│       │   ├── pedagogyEngine.js     # Lesson structure gen (20KB)
│       │   ├── teachingMachine.js    # State machine controller
│       │   ├── sessionStore.js       # In-memory session cache
│       │   ├── intentEngine.js       # Topic classification
│       │   ├── cache.js              # Redis + LRU cache
│       │   ├── circuitBreaker.js     # LLM fault tolerance
│       │   ├── adaptivePlanner.js    # Difficulty adaptation
│       │   ├── animationPlanner.js   # Visual script planning
│       │   ├── rendererRouter.js     # SVG/D3/Matter selection
│       │   ├── vectorStore.js        # Semantic memory (stubbed)
│       │   └── visualScriptValidator # Schema validation
│       │
│       ├── agents/
│       │   ├── index.js              # Agent registry
│       │   ├── plannerAgent.js       # Lesson structure
│       │   ├── visualizerAgent.js    # Canvas object generation
│       │   ├── animatorAgent.js      # Animation sequencing
│       │   ├── narratorAgent.js      # Voice narration text
│       │   ├── criticAgent.js        # Quality assurance
│       │   ├── validatorAgent.js     # Schema enforcement
│       │   ├── deltaAgent.js         # Doubt-driven mutations
│       │   ├── doubtClassifier.js    # Question routing
│       │   └── doubtPrompt.js        # Doubt prompt templates
│       │
│       ├── config/
│       │   ├── domainConfig.js       # Subject domain rules
│       │   ├── promptRegistry.js     # System prompt library
│       │   ├── visualScriptTemplates # Template definitions
│       │   └── domains/              # Per-subject configs
│       │
│       ├── tools/                    # Agent tool functions
│       ├── utils/                    # Shared utilities
│       └── validators/               # Input validators
```

---

## 🔄 Data Flow: Student Session Lifecycle

```mermaid
sequenceDiagram
    participant S as Student
    participant UI as React UI
    participant WS as Socket.IO
    participant TM as TeachingMachine
    participant AL as AgentLoop
    participant LLM as LLM Provider
    participant DB as MongoDB

    S->>UI: Types "explain bubble sort"
    UI->>WS: teaching:start {topic}
    WS->>TM: initSession()
    TM->>AL: runPipeline(topic)
    
    rect rgb(30, 41, 59)
        Note over AL: 6-Agent Pipeline
        AL->>LLM: 1. Planner → lesson structure
        LLM-->>AL: {steps, objectives}
        AL->>LLM: 2. Visualizer → canvas objects
        LLM-->>AL: {elements, connections}
        AL->>LLM: 3. Animator → animation scripts
        LLM-->>AL: {animations, transitions}
        AL->>LLM: 4. Narrator → voice text
        LLM-->>AL: {narration per step}
        AL->>LLM: 5. Critic → quality check
        LLM-->>AL: {score, suggestions}
        AL->>LLM: 6. Validator → schema fix
        LLM-->>AL: {validated timeline}
    end

    AL-->>WS: teaching:timeline {objects, steps}
    WS-->>UI: Render on InfiniteCanvas
    UI->>UI: SVGCanvasRenderer + GSAP

    S->>UI: Asks "why does i stop at n-1?"
    UI->>WS: teaching:doubt {question}
    WS->>TM: handleDoubt()
    TM->>LLM: DeltaAgent → visual answer
    LLM-->>TM: {answer, actions[]}
    TM-->>WS: teaching:doubt-delta
    WS-->>UI: mutateCanvasObjects + animate
    
    TM->>DB: persist session + mastery
```

---

## 🧩 Zustand Store Architecture

```mermaid
graph LR
    subgraph STORE["tutorStore.js"]
        direction TB
        CS["canvasSlice<br/>• canvasObjects[]<br/>• canvasSteps[]<br/>• canvasTransform<br/>• selectedElementIds<br/>• history {past, future}<br/>• deltaState"]
        
        CHS["chatSlice<br/>• messages[]<br/>• doubtHistory[]<br/>• isStreaming<br/>• generationProgress"]
        
        CTRL["controlSlice<br/>• activeTool<br/>• drawColor/Width<br/>• noteColor/Size<br/>• undo() / redo()<br/>• addNoteToCanvas()"]
        
        SS["sessionSlice<br/>• sessionId<br/>• sessionManifest{}<br/>• topic<br/>• learnerProfile<br/>• isTimelineReady"]
        
        UIS["uiSlice<br/>• theme<br/>• layoutView<br/>• isSidebarOpen<br/>• isVisualizerOpen<br/>• canvasMode"]
    end

    CS --> |"addCanvasObjects<br/>mutateCanvasObjects"| RENDER["SVGCanvasRenderer"]
    CHS --> |"addMessage<br/>addDoubt"| CHAT["ChatPanel"]
    CTRL --> |"setActiveTool"| TOOLBAR["Toolbar"]
    SS --> |"setTimeline"| SESSION["TeachingSession"]
    UIS --> |"setTheme"| THEME["ThemeContext"]

    style STORE fill:#0f172a,stroke:#f59e0b,stroke-width:2px,color:#f8fafc
```

---

## 🎨 Canvas Rendering Pipeline

```mermaid
graph TD
    subgraph INPUT["User Input"]
        POINTER["Pointer Events<br/>(down/move/up)"]
        TOOLBAR_IN["Toolbar Selection<br/>(draw/shape/text/note)"]
    end

    subgraph ICL["InteractiveCanvasLayer"]
        DRAFT["Draft Object<br/>(live preview)"]
        FINALIZE["Finalize<br/>(pointerUp)"]
    end

    subgraph STORE_C["Zustand canvasSlice"]
        OBJECTS["canvasObjects[]"]
        STEPS["canvasSteps[]"]
    end

    subgraph RENDERER["SVGCanvasRenderer"]
        FILTER["Step Filter<br/>(manual / stepObjectIds)"]
        ROUTER["Shape Router<br/>(switch on type)"]
    end

    subgraph SHAPES["CinematicShapes Library"]
        AW["AnimatedWrapper<br/>(motion.g)"]
        BASE["GlassRect · GlowOrb<br/>Ellipse · Diamond · Star<br/>Hexagon · CartesianAxes"]
        DATA["BarChart · PieChart<br/>TreeNode · TableGrid"]
        PRES["CodePanel · FlowStep<br/>Callout · Cloud · Badge"]
        SCIENCE["Molecule · Waveform"]
        STICKY["StickyNoteShape"]
        PATH["FreeformShape<br/>(draw paths)"]
    end

    POINTER --> ICL
    TOOLBAR_IN --> ICL
    ICL --> DRAFT
    FINALIZE --> |"addCanvasObjects"| OBJECTS
    OBJECTS --> FILTER
    STEPS --> FILTER
    FILTER --> ROUTER
    ROUTER --> AW
    AW --> BASE & DATA & PRES & SCIENCE & STICKY & PATH

    style INPUT fill:#1e293b,stroke:#60a5fa,color:#f8fafc
    style ICL fill:#1e293b,stroke:#f472b6,color:#f8fafc
    style RENDERER fill:#1e293b,stroke:#4ade80,color:#f8fafc
    style SHAPES fill:#1e293b,stroke:#fbbf24,color:#f8fafc
```

---

## ⚙️ Server Engine: 6-Agent Pipeline

```mermaid
graph TD
    subgraph PIPELINE["AgentLoop Pipeline"]
        direction TB
        P["🎯 PlannerAgent<br/>Lesson structure<br/>Steps & objectives"]
        V["🎨 VisualizerAgent<br/>Canvas objects<br/>Shapes & layouts"]
        A["✨ AnimatorAgent<br/>Animation scripts<br/>Transitions & timing"]
        N["🎙️ NarratorAgent<br/>Voice narration<br/>Step explanations"]
        C["🔍 CriticAgent<br/>Quality scoring<br/>Improvement suggestions"]
        VAL["✅ ValidatorAgent<br/>Schema enforcement<br/>Error correction"]
    end

    subgraph SUPPORT["Support Systems"]
        CACHE["Redis Cache<br/>(lesson caching)"]
        CB["CircuitBreaker<br/>(LLM fault tolerance)"]
        AP["AdaptivePlanner<br/>(difficulty tuning)"]
        IE["IntentEngine<br/>(topic classification)"]
        SS_S["SessionStore<br/>(in-memory state)"]
    end

    subgraph DOUBT["Doubt Resolution"]
        DC["DoubtClassifier<br/>(question routing)"]
        DA["DeltaAgent<br/>(visual mutations)"]
        DP["DoubtPrompt<br/>(template engine)"]
    end

    P --> V --> A --> N --> C --> VAL
    IE --> P
    CACHE --> P
    CB --> P & V & A & N
    AP --> P
    VAL --> SS_S

    DC --> DA
    DP --> DA
    DA --> |"mutateCanvasObjects"| SS_S

    style PIPELINE fill:#0f172a,stroke:#22c55e,stroke-width:2px,color:#f8fafc
    style SUPPORT fill:#0f172a,stroke:#a78bfa,stroke-width:2px,color:#f8fafc
    style DOUBT fill:#0f172a,stroke:#f87171,stroke-width:2px,color:#f8fafc
```

---

## 🔌 Socket.IO Event Map

```mermaid
graph LR
    subgraph CLIENT_EVENTS["Client → Server"]
        TS["teaching:start<br/>{topic, sessionId}"]
        TD["teaching:doubt<br/>{question, stepIndex}"]
        TN["teaching:navigate<br/>{stepIndex}"]
        TR["teaching:resume<br/>{sessionId}"]
    end

    subgraph SERVER_EVENTS["Server → Client"]
        TT["teaching:timeline<br/>{objects, steps, connections}"]
        TP["teaching:progress<br/>{stage, message, percent}"]
        TDD["teaching:doubt-delta<br/>{answer, actions[]}"]
        TE["teaching:error<br/>{message, code}"]
        TH["teaching:heartbeat<br/>{timestamp}"]
    end

    TS --> |"session.js"| TT
    TS --> |"streaming"| TP
    TD --> |"doubt.js"| TDD
    TN --> |"navigation.js"| TT

    style CLIENT_EVENTS fill:#1e293b,stroke:#3b82f6,color:#f8fafc
    style SERVER_EVENTS fill:#1e293b,stroke:#22c55e,color:#f8fafc
```

---

## 🗄️ Database Schema Map

```mermaid
erDiagram
    User ||--o{ ChatSession : "has many"
    User ||--o| LearnerProfile : "has one"
    User ||--o{ ActivityLog : "generates"
    User ||--o{ UsageLog : "consumes"
    User ||--o{ RevokedToken : "revokes"
    ChatSession ||--o{ Doubt : "contains"

    User {
        string email PK
        string name
        string googleId
        string password_hash
        json apiKeys_encrypted
        json preferences
        string activeApiKey
        date createdAt
    }

    ChatSession {
        ObjectId _id PK
        ObjectId userId FK
        string sessionId UK
        string topic
        json messages
        json canvasObjects
        json canvasSteps
        json canvasTransform
        json pinnedNotes
        date lastAccessed
    }

    LearnerProfile {
        ObjectId userId FK
        json topicsMastery
        float confusionIndex
        json strengths
        json weaknesses
        int totalSessions
    }

    Doubt {
        ObjectId sessionId FK
        string question
        string answer
        json deltaActions
        int stepIndex
        date createdAt
    }

    ActivityLog {
        ObjectId userId FK
        string action
        json metadata
        date timestamp
    }

    UsageLog {
        ObjectId userId FK
        string provider
        int tokensUsed
        float cost
        date timestamp
    }

    RevokedToken {
        string token PK
        date expiresAt
    }
```

---

## 📊 Component Size Heatmap

| Component | Size | Complexity | Role |
|:---|:---:|:---:|:---|
| `Home.jsx` | 49 KB | 🔴 High | Main workspace, session sync, sidebar |
| `CodeVisualizerModal.jsx` | 48 KB | 🔴 High | Interactive code execution |
| `StepPanel.jsx` | 31 KB | 🔴 High | Step content + rich rendering |
| `AuthLanding.jsx` | 31 KB | 🟡 Med | Marketing + auth forms |
| `TeachingSession.jsx` | 30 KB | 🔴 High | Session orchestrator |
| `InlineEditor.jsx` | 27 KB | 🟡 Med | Rich text editing |
| `index.css` | 26 KB | 🟡 Med | Full design system |
| `InfiniteCanvas.jsx` | 23 KB | 🟡 Med | Pan/zoom viewport |
| `useTeachingMachine.js` | 20 KB | 🔴 High | Socket event manager |
| `pedagogyEngine.js` | 20 KB | 🔴 High | Lesson generation core |
| `agentLoop.js` | 19 KB | 🔴 High | 6-agent orchestrator |
| `AuthContext.jsx` | 20 KB | 🟡 Med | OAuth + JWT lifecycle |
| `PremiumTextBox.jsx` | 16 KB | 🟡 Med | Formatted text display |
| `InteractiveCanvasLayer.jsx` | 15 KB | 🟡 Med | Drawing interaction |
| `DrawTool.jsx` | 13 KB | 🟢 Low | Pen/marker/laser UI |
| `ToolButtonBase.jsx` | 13 KB | 🟢 Low | Shared button component |
| `session.js (handler)` | 13 KB | 🟡 Med | Socket session handler |

---

## 🔐 Security Architecture

```mermaid
graph TB
    subgraph AUTH["Authentication"]
        JWT["JWT Tokens<br/>(access + refresh)"]
        GOOGLE["Google OAuth 2.0"]
        REVOKE["RevokedToken<br/>Blacklist"]
    end

    subgraph GUARD["Middleware"]
        AUTH_MW["auth.middleware.js<br/>JWT verification"]
        RATE["rateLimiter.js<br/>Redis-backed"]
        VALID["validation.middleware.js<br/>Input sanitization"]
        REQ_ID["requestIdMiddleware.js<br/>Correlation tracking"]
    end

    subgraph CICD["CI/CD Security"]
        AUDIT["npm audit<br/>--audit-level=high"]
        GITLEAKS["Gitleaks<br/>Secret scanning"]
        GITIGNORE[".gitignore<br/>server/data/ protected"]
    end

    subgraph DATA["Data Protection"]
        ENCRYPT["AES-256 Encryption<br/>(API keys at rest)"]
        SANITIZE["DOMPurify<br/>(XSS prevention)"]
        PATH_GUARD["Path Traversal Guard<br/>(vectorStore.js)"]
    end

    JWT --> AUTH_MW
    GOOGLE --> JWT
    AUTH_MW --> RATE --> VALID --> REQ_ID

    style AUTH fill:#1e293b,stroke:#f87171,color:#f8fafc
    style GUARD fill:#1e293b,stroke:#fbbf24,color:#f8fafc
    style CICD fill:#1e293b,stroke:#4ade80,color:#f8fafc
    style DATA fill:#1e293b,stroke:#a78bfa,color:#f8fafc
```

---

## 📈 Technology Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Frontend** | React 18 + Vite | UI framework + dev server |
| **State** | Zustand (5 slices) | Global state management |
| **Animation** | Framer Motion + GSAP | UI transitions + canvas animations |
| **Canvas** | SVG + D3.js + Matter.js | Rendering engines |
| **Math** | KaTeX | LaTeX equation rendering |
| **Styling** | Vanilla CSS (design tokens) | Theme system |
| **Backend** | Express.js | REST API server |
| **Realtime** | Socket.IO | WebSocket communication |
| **Database** | MongoDB + Mongoose | Persistent storage |
| **Cache** | Redis | Session cache + rate limiting |
| **Auth** | JWT + Google OAuth | Authentication |
| **AI** | Gemini / OpenAI / Claude | Multi-provider LLM |
| **Security** | DOMPurify + AES-256 | XSS prevention + encryption |
| **CI/CD** | GitHub Actions | Automated testing + security |

---

> **Total Files**: ~120+ source files · **Lines of Code**: ~25,000+ · **Architecture**: Modular monolith with real-time WebSocket layer

# TutorBoard Component Architecture

This document defines the component directory conventions for the TutorBoard client. To maintain a clean, modular structure, components should be organized by their logical "layer" or responsibility.

## Directory Conventions

### `/canvas/`
**Purpose**: Core visual interaction, geometric rendering, and canvas state management.
- **Ownership**: Components that directly interact with the drawing surface or manage canvas-specific UI (minimaps, overlays, overlays, format bars).
- **Examples**: `Board.jsx`, `InfiniteCanvas.jsx`, `CanvasControls.jsx`, `PremiumTextBox.jsx`.

### `/teaching/`
**Purpose**: Pedagogy-focused UX, session state, and student/tutor progress tracking.
- **Ownership**: Components that drive the teaching logic, session modals, step-by-step guidance, and learning timelines.
- **Examples**: `TeachingModal.jsx`, `StepPanel.jsx`, `ProgressIndicator.jsx`, `DoubtPanel.jsx`.

### `/chat/`
**Purpose**: Messaging, AI orchestration feedback, and conversation-based interaction.
- **Ownership**: Message displays, chat history panels, and inline AI chat interfaces.
- **Examples**: `ChatWindow.jsx`, `Message.jsx`, `ChatHistory.jsx`, `InlineChat.jsx`.

### `/layout/`
**Purpose**: Global application shell, structural navigation, and shared branding/UI.
- **Ownership**: High-level structural components, navigation bars, global loaders, and branding assets.
- **Examples**: `Layout.jsx`, `Sidebar.jsx`, `VisaiLogo.jsx`, `Loader.jsx`, `ThemeSelector.jsx`.

### `/auth/`
**Purpose**: Authentication flows, user onboarding, and protected route management.
- **Ownership**: Login/Registration UI, protected route wrappers, and cinematic transitions.
- **Examples**: `ProtectedRoute.jsx`, `CinematicTransition.jsx`.

### `/ui/`
**Purpose**: Atomic, reusable UI components (Buttons, Inputs, Toggles).
- **Ownership**: Primitives that do not contain business logic and are used across all layers.

## Rules of Thumb
1. **Prefer Local Folders**: If a component is ONLY used by one other component, keep it in the same directory.
2. **Avoid Root Components**: No components should live in the root of `/components/` (except for high-level entry points like `Board.jsx` if absolutely necessary, though `/canvas/` is preferred).
3. **Cross-Layer Imports**: Layers can import from `/ui/` and `/layout/` freely. Imports between `/teaching/` and `/canvas/` should be mediated via shared state (e.g., `useTutorStore`).

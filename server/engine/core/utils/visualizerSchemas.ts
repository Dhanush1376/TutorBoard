import { z } from 'zod';

// Base Command Schema
export const CommandSchema = z.object({
  cmd: z.string().min(1)
}).catchall(z.any()); // allow arbitrary parameters based on cmd

// Scene Script Schema
export const VisualScriptSchema = z.object({
  renderer: z.enum(["d3", "physics", "math", "desmos", "programming", "cinematic"]).default("cinematic"),
  scene: z.string().optional(),
  script: z.array(CommandSchema).default([])
});

// A fully extracted Lesson schema might encompass steps and nodes if needed by the frontend/backend bridge.
export const LessonSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.any()).optional()
}).catchall(z.any());

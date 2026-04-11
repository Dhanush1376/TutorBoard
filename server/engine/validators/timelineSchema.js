import { z } from 'zod';

export const ElementSchema = z.object({
  id: z.string().describe("Unique identifier for the element"),
  type: z.string().describe("Type of visual primitive (e.g. circle, dot, wave, array, axes)"),
  x: z.number().optional().describe("X coordinate from 0.0 to 1.0"),
  y: z.number().optional().describe("Y coordinate from 0.0 to 1.0"),
  label: z.string().optional().describe("Text label to display"),
  color: z.string().optional().describe("CSS color or standard color string"),
  values: z.array(z.any()).optional().describe("Optional data array for 'array' type"),
  points: z.array(z.array(z.number())).optional().describe("Required for 'polygon', an array of [x, y] coordinates"),
  leftVal: z.any().optional().describe("Optional for 'comparator'"),
  rightVal: z.any().optional().describe("Optional for 'comparator'"),
  operator: z.string().optional().describe("Optional for 'comparator'"),
  result: z.any().optional().describe("Optional for 'comparator'"),
  code: z.string().optional().describe("Optional for 'codeline'")
});

export const ConnectionSchema = z.object({
  from: z.string().describe("ID of source element"),
  to: z.string().describe("ID of destination element"),
  label: z.string().optional().describe("Text label on connector"),
  type: z.string().optional().describe("arrow or line")
});

export const CameraFocusSchema = z.object({
  x: z.number().optional().describe("Camera X focus (0.0 - 1.0)"),
  y: z.number().optional().describe("Camera Y focus (0.0 - 1.0)"),
  zoom: z.number().optional().describe("Camera zoom multiplier (default 1.0)")
});

export const AnimationHintSchema = z.object({
  type: z.string().optional().describe("slide_in, fade, scale, draw, none"),
  duration: z.number().optional().describe("Animation duration in seconds")
});

export const TimelineStepSchema = z.object({
  title: z.string().describe("Title of this pedagogical step"),
  highlight: z.array(z.string()).optional().describe("Array of element IDs to highlight"),
  fade: z.array(z.string()).optional().describe("Array of element IDs to fade into background"),
  cameraFocus: CameraFocusSchema.optional(),
  animation: AnimationHintSchema.optional(),
  explanation: z.string().optional().describe("Teaching narration text for step")
});

export const SceneSchema = z.object({
  title: z.string().optional().describe("Topic title"),
  type: z.string().optional().describe("Animation style")
});

export const SceneGraphSchema = z.object({
  scene: SceneSchema.optional(),
  elements: z.array(ElementSchema).describe("Array of visual entities to render"),
  connections: z.array(ConnectionSchema).optional().describe("Array of connections between entities"),
  timeline: z.array(TimelineStepSchema).describe("Array of chronological animation steps")
});

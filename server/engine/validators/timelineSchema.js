import { z } from 'zod';

export const ElementSchema = z.object({
  id: z.string().describe("Unique identifier for the element"),
  type: z.string().describe("Type of visual primitive (e.g. circle, dot, wave, array, axes)"),
  x: z.number().optional().describe("X coordinate from 0.0 to 1.0"),
  y: z.number().optional().describe("Y coordinate from 0.0 to 1.0"),
  label: z.string().optional().describe("Text label to display"),
  color: z.string().optional().describe("CSS color or standard color string"),
  scale: z.number().optional().describe("Scale multiplier"),
  values: z.array(z.any()).optional().describe("Optional data array for 'array' type"),
  points: z.array(z.array(z.number())).optional().describe("Required for 'polygon', an array of [x, y] coordinates"),
  leftVal: z.any().optional().describe("Optional for 'comparator'"),
  rightVal: z.any().optional().describe("Optional for 'comparator'"),
  operator: z.string().optional().describe("Optional for 'comparator'"),
  result: z.any().optional().describe("Optional for 'comparator'"),
  code: z.string().optional().describe("Optional for 'codeline'")
}).passthrough();

export const ConnectionSchema = z.object({
  from: z.string().describe("ID of source element"),
  to: z.string().describe("ID of destination element"),
  label: z.string().optional().describe("Text label on connector"),
  type: z.string().optional().describe("arrow or line")
}).passthrough();

export const CameraFocusSchema = z.object({
  x: z.number().optional().describe("Camera X focus (0.0 - 1.0)"),
  y: z.number().optional().describe("Camera Y focus (0.0 - 1.0)"),
  zoom: z.number().optional().describe("Camera zoom multiplier (default 1.0)")
}).passthrough();

export const AnimationHintSchema = z.object({
  type: z.string().optional().describe("slide_in, fade, scale, draw, none"),
  duration: z.number().optional().describe("Animation duration in seconds")
}).passthrough();

const MutationSchema = z.object({
  id: z.string(),
  props: z.record(z.any())
}).passthrough();

export const VisualScriptCommandSchema = z.object({
  id: z.string().describe("ID of target element"),
  cmd: z.string().optional().describe("Alias for action (used by agents)"),
  action: z.enum([
    'fade_in', 'fade_out', 'scale_in', 'scale_out', 
    'move', 'highlight', 'shake', 'glow_pulse',
    'draw', 'array_push', 'array_pop', 'array_swap',
    'pointer_move', 'label_show',
    'array', 'pointer', 'compare', 'annotate', 'remove',
    'highlightNode', 'movePointer', 'showTextOverlay', 'emphasizeEdge', 'pulseElement'
  ]).optional(),

  duration: z.number().optional().default(400),
  delay: z.number().optional().default(0),
  easing: z.string().optional().default('ease_out'),
  props: z.record(z.any()).optional().describe("Command-specific parameters (e.g. {x, y} for move)")
}).passthrough();

const AnimationSchema = z.object({
  type: z.string().optional().default('fade'),
  duration: z.number().optional().default(0.5),
  actions: z.array(VisualScriptCommandSchema).optional().describe("Per-element choreography")
}).passthrough();

export const TimelineStepSchema = z.object({
  title: z.string().optional(),
  label: z.string().optional(),
  explanation: z.string().optional(),
  narration: z.string().optional(),
  objectIds: z.array(z.string()).describe("IDs of elements that should be VISIBLE in this step"),
  highlightIds: z.array(z.string()).optional(),
  fadeIds: z.array(z.string()).optional(),
  cameraFocus: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().optional()
  }).optional(),
  animation: AnimationSchema.optional(),
  mutations: z.array(MutationSchema).optional()
}).passthrough();

export const SceneSchema = z.object({
  title: z.string().optional().describe("Topic title"),
  type: z.string().optional().describe("Animation style")
}).passthrough();

export const SceneGraphSchema = z.object({
  scene: SceneSchema.optional(),
  elements: z.array(ElementSchema).describe("Array of visual entities to render"),
  connections: z.array(ConnectionSchema).optional().describe("Array of connections between entities"),
  timeline: z.array(TimelineStepSchema).describe("Array of chronological animation steps")
}).passthrough();


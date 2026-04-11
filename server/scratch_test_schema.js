import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const ElementSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number().optional(),
  y: z.number().optional()
});

const SceneGraphSchema = z.object({
  elements: z.array(ElementSchema),
  timeline: z.array(z.object({ title: z.string() }))
});

const schema = zodToJsonSchema(SceneGraphSchema, "root").definitions?.root || zodToJsonSchema(SceneGraphSchema);
console.log(JSON.stringify(schema, null, 2));

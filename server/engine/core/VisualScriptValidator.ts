import { z } from 'zod';

// Base command schema
const BaseCommandSchema = z.object({
  cmd: z.string().min(1, "Command 'cmd' property is required and cannot be empty"),
  id: z.string().optional(),
}).passthrough(); // Allow any other properties (values, at, left, right, etc.)

// A single step in a timeline could just be an array of commands
export const VisualScriptArraySchema = z.array(BaseCommandSchema);

// A full timeline step object
export const TimelineStepSchema = z.object({
  step: z.number().optional(),
  title: z.string().optional(),
  narration: z.string().optional(),
  explanation: z.string().optional(),
  script: VisualScriptArraySchema.optional(),
  actions: VisualScriptArraySchema.optional(), // Legacy support for 'actions'
}).passthrough();

export class VisualScriptValidator {
  /**
   * Validates an array of VisualScript commands.
   * Throws an error if invalid.
   */
  static validateScript(script: any[]): any[] {
    return VisualScriptArraySchema.parse(script);
  }

  /**
   * Validates a full timeline step.
   * Throws an error if invalid.
   */
  static validateStep(step: any): any {
    return TimelineStepSchema.parse(step);
  }

  /**
   * Safely parses and validates a raw AI response containing VisualScript.
   * Attempts to extract JSON if it's wrapped in markdown blocks.
   */
  static safeParse(rawOutput: string): any {
    try {
      const cleanString = rawOutput.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanString);
      
      // If it's an array, validate as a script array
      if (Array.isArray(parsed)) {
        return VisualScriptValidator.validateScript(parsed);
      }
      
      // Otherwise, it might be a scene or a step object
      return parsed;
    } catch (err: any) {
      console.error('[VisualScriptValidator] Failed to parse output:', err.message);
      throw new Error('Invalid VisualScript JSON format');
    }
  }
}

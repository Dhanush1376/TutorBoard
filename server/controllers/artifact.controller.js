import { z } from 'zod';
import Artifact from '../models/Artifact.js';
import { requestCompletion, getTextModel, resolveModelId } from '../utils/ai/llmClient.js';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const saveArtifactSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().optional(),
  type: z.enum(['code', 'ui', 'document', 'table', 'diagram']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
  language: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().default({}),
});

const updateArtifactSchema = z.object({
  content: z.string().min(1).max(100000),
  title: z.string().min(1).max(200).optional(),
  language: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/artifact/save
 * Create a new artifact (usually called after stream finalization).
 */
export const saveArtifact = async (req, res) => {
  try {
    const validation = saveArtifactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { sessionId, messageId, type, title, content, language, metadata } = validation.data;
    const userId = req.user?._id || req.user?.id || null;

    const artifact = await Artifact.create({
      userId,
      sessionId,
      messageId,
      type,
      title,
      content,
      language: language || null,
      metadata: metadata || {},
      version: 1,
    });

    console.log(`[Artifact] ✨ Created: ${artifact._id} (${type}) "${title}"`);

    res.status(201).json({
      id: artifact._id,
      type: artifact.type,
      title: artifact.title,
      content: artifact.content,
      language: artifact.language,
      metadata: artifact.metadata,
      version: artifact.version,
      createdAt: artifact.createdAt,
    });
  } catch (err) {
    console.error('[Artifact:Save] Error:', err);
    res.status(500).json({ error: 'Failed to save artifact' });
  }
};

/**
 * GET /api/artifact/:id
 * Retrieve a single artifact by its ID.
 */
export const getArtifact = async (req, res) => {
  try {
    const { id } = req.params;
    const artifact = await Artifact.findById(id).lean();

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Ownership check: Prevent reading artifacts owned by others
    if (artifact.userId && String(artifact.userId) !== String(req.user?._id || req.user?.id)) {
      return res.status(403).json({ error: 'Forbidden: Private artifact' });
    }

    res.json({
      id: artifact._id,
      sessionId: artifact.sessionId,
      messageId: artifact.messageId,
      type: artifact.type,
      title: artifact.title,
      content: artifact.content,
      language: artifact.language,
      metadata: artifact.metadata,
      version: artifact.version,
      versions: artifact.versions,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    });
  } catch (err) {
    console.error('[Artifact:Get] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve artifact' });
  }
};

/**
 * PUT /api/artifact/:id
 * Update an artifact — pushes current state to version history, increments version.
 */
export const updateArtifact = async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateArtifactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { content, title, language, metadata } = validation.data;

    const artifact = await Artifact.findById(id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Ownership check: Prevent updating artifacts owned by others
    if (artifact.userId && String(artifact.userId) !== String(req.user?._id || req.user?.id)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this artifact' });
    }

    // Push current state to version history before overwriting
    const newVersion = artifact.version + 1;
    artifact.versions.push({
      content,
      language: language !== undefined ? language : artifact.language,
      metadata: metadata || artifact.metadata,
      version: newVersion,
      createdAt: new Date(),
    });

    // Cap versions at 50
    if (artifact.versions.length > 50) {
      artifact.versions = artifact.versions.slice(-50);
    }

    // Update current state
    artifact.content = content;
    artifact.version = newVersion;
    if (title) artifact.title = title;
    if (language !== undefined) artifact.language = language;
    if (metadata) artifact.metadata = metadata;

    await artifact.save();

    console.log(`[Artifact] ✏️ Updated: ${artifact._id} → v${newVersion}`);

    res.json({
      id: artifact._id,
      type: artifact.type,
      title: artifact.title,
      content: artifact.content,
      language: artifact.language,
      metadata: artifact.metadata,
      version: artifact.version,
      updatedAt: artifact.updatedAt,
    });
  } catch (err) {
    console.error('[Artifact:Update] Error:', err);
    res.status(500).json({ error: 'Failed to update artifact' });
  }
};

/**
 * GET /api/artifact/history/:id
 * Retrieve the full version history of an artifact.
 */
export const getArtifactHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const artifact = await Artifact.findById(id).select('versions title type version').lean();

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Ownership check: Prevent reading history of artifacts owned by others
    if (artifact.userId && String(artifact.userId) !== String(req.user?._id || req.user?.id)) {
      return res.status(403).json({ error: 'Forbidden: Private history' });
    }

    res.json({
      id: artifact._id,
      title: artifact.title,
      type: artifact.type,
      currentVersion: artifact.version,
      versions: artifact.versions,
    });
  } catch (err) {
    console.error('[Artifact:History] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve artifact history' });
  }
};

/**
 * GET /api/artifact/session/:sessionId
 * Retrieve all artifacts belonging to a given chat session.
 */
export const getSessionArtifacts = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const artifacts = await Artifact.find({ sessionId })
      .select('-versions')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      sessionId,
      artifacts: artifacts.map(a => ({
        id: a._id,
        type: a.type,
        title: a.title,
        content: a.content,
        language: a.language,
        metadata: a.metadata,
        version: a.version,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[Artifact:Session] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve session artifacts' });
  }
};

// ─── Validation Schema for AI Modify ──────────────────────────────────────────

const modifyArtifactSchema = z.object({
  artifactId: z.string().min(1),
  instruction: z.string().min(1).max(2000),
});

/**
 * POST /api/artifact/modify
 * AI-powered artifact modification. Sends current content + user instruction to LLM,
 * saves the result as a new version.
 */
export const modifyArtifact = async (req, res) => {
  try {
    const validation = modifyArtifactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { artifactId, instruction } = validation.data;

    const artifact = await Artifact.findById(artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Ownership check: Prevent modifying artifacts owned by others
    if (artifact.userId && String(artifact.userId) !== String(req.user?._id || req.user?.id)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this artifact' });
    }

    // Build a focused modification prompt
    const typeLabels = {
      code: 'source code',
      ui: 'HTML/CSS/JS UI component',
      document: 'Markdown document',
      table: 'Markdown table',
      diagram: 'Mermaid diagram',
    };

    const systemPrompt = `You are a precise code/content editor. Modify the following ${typeLabels[artifact.type] || artifact.type} artifact according to the user's instruction.

RULES:
- Return ONLY the modified content. No explanations. No wrapping. No markdown code fences.
- Preserve the original structure and formatting unless the instruction explicitly asks to change it.
- For code: return raw source code only.
- For documents: return Markdown only.
- For diagrams: return valid Mermaid syntax only.
- For UI: return a complete HTML document only.
- For tables: return Markdown table syntax only.

CURRENT CONTENT:
${artifact.content}`;

    const result = await requestCompletion({
      model: resolveModelId(getTextModel()),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction },
      ],
      temperature: 0.3,
      maxTokens: 8000,
      taskType: 'editing',
    });

    if (result.error || !result.content) {
      return res.status(502).json({ error: 'AI modification failed', details: result.error });
    }

    let modifiedContent = result.content.trim();
    // Strip markdown code fences if the LLM wrapped the output
    modifiedContent = modifiedContent.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

    // Push current state to version history
    const newVersion = artifact.version + 1;
    artifact.versions.push({
      content: modifiedContent,
      language: artifact.language,
      metadata: { ...artifact.metadata, instruction },
      version: newVersion,
      createdAt: new Date(),
    });

    // Cap versions at 50
    if (artifact.versions.length > 50) {
      artifact.versions = artifact.versions.slice(-50);
    }

    // Update current state
    artifact.content = modifiedContent;
    artifact.version = newVersion;

    await artifact.save();

    console.log(`[Artifact] 🤖 AI Modified: ${artifact._id} → v${newVersion} ("${instruction.substring(0, 40)}...")`);

    res.json({
      id: artifact._id,
      type: artifact.type,
      title: artifact.title,
      content: artifact.content,
      language: artifact.language,
      metadata: artifact.metadata,
      version: artifact.version,
      versions: artifact.versions,
      updatedAt: artifact.updatedAt,
    });
  } catch (err) {
    console.error('[Artifact:Modify] Error:', err);
    res.status(500).json({ error: 'Failed to modify artifact' });
  }
};

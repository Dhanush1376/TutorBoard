import { z } from 'zod';
import Artifact from '../models/Artifact.js';
import ChatSession from '../models/ChatSession.js';
import { requestCompletion, getTextModel, resolveModelId } from '../utils/ai/llmClient.js';
import { classifyArtifact } from '../engine/agents/artifactClassifierAgent.js';
import { generateSceneGraph } from '../engine/agents/sceneGraphAgent.js';
import { generateDelta as generateSceneGraphDelta } from '../engine/agents/sceneGraphDeltaAgent.js';
import { applyDelta, resolveReference } from '../engine/sceneGraph/sceneGraphUtils.js';

// ─── Ownership Helpers ────────────────────────────────────────────────────────

/**
 * Verify caller owns the session (either as registered user or verified guest)
 */
export async function verifySessionOwnership(sessionId, req) {
  if (!sessionId) return null;
  const isUser = Boolean(req.user?._id || req.user?.id);
  const userId = req.user?._id || req.user?.id;
  const guestId = req.guestId;

  if (!isUser && !guestId) return null;

  const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId);
  const ownerQuery = isUser 
    ? { userId: userId.toString() } 
    : { guestId, userId: null };

  const query = isMongoId 
    ? { _id: sessionId, ...ownerQuery, isDeleted: { $ne: true } }
    : { engineSessionId: sessionId, ...ownerQuery, isDeleted: { $ne: true } };

  return ChatSession.findOne(query).select('_id userId guestId').lean();
}

/**
 * Verify caller owns the artifact
 */
export async function verifyArtifactOwnership(artifact, req) {
  if (!artifact) return false;
  const isUser = Boolean(req.user?._id || req.user?.id);
  const userId = req.user?._id || req.user?.id;
  const guestId = req.guestId;

  if (!isUser && !guestId) return false;

  // Direct artifact ownership check
  if (artifact.userId) {
    return isUser && String(artifact.userId) === String(userId);
  }

  if (artifact.guestId) {
    return !isUser && Boolean(guestId) && artifact.guestId === guestId;
  }

  // Fallback: If artifact doesn't have userId or guestId set (legacy), verify ownership of its session
  if (artifact.sessionId) {
    const session = await verifySessionOwnership(artifact.sessionId, req);
    return Boolean(session);
  }

  return false;
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const saveArtifactSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().optional(),
  type: z.enum(['code', 'ui', 'document', 'table', 'diagram', 'visual', 'interactive']),
  artifactClass: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
  sceneGraph: z.any().optional().nullable(),
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
 * Create a new artifact with strict session ownership verification.
 */
export const saveArtifact = async (req, res) => {
  try {
    const validation = saveArtifactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { sessionId, messageId, type, artifactClass, title, content, sceneGraph, language, metadata } = validation.data;
    const isUser = Boolean(req.user?._id || req.user?.id);
    const userId = req.user?._id || req.user?.id;
    const guestId = req.guestId;

    if (!isUser && !guestId) {
      return res.status(401).json({ error: 'Authentication or guest identity required', code: 'UNAUTHORIZED' });
    }

    // SEC: Verify ownership of target session
    const session = await verifySessionOwnership(sessionId, req);
    if (!session) {
      return res.status(403).json({ error: 'Forbidden: Session not found or access denied' });
    }

    const artifact = await Artifact.create({
      userId: isUser ? userId : null,
      guestId: isUser ? null : guestId,
      sessionId,
      messageId: messageId || null,
      type,
      artifactClass: artifactClass || null,
      title,
      content,
      sceneGraph: sceneGraph || null,
      language: language || null,
      metadata: metadata || {},
      version: 1,
    });

    console.log(`[Artifact] ✨ Created: ${artifact._id} (${type}) "${title}" for session ${sessionId}`);

    res.status(201).json({
      id: artifact._id,
      sessionId: artifact.sessionId,
      type: artifact.type,
      artifactClass: artifact.artifactClass,
      title: artifact.title,
      content: artifact.content,
      sceneGraph: artifact.sceneGraph,
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
 * Retrieve a single artifact by its ID with ownership check.
 */
export const getArtifact = async (req, res) => {
  try {
    const { id } = req.params;
    const artifact = await Artifact.findById(id).lean();

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Ownership check: Prevent reading artifacts owned by others
    if (!(await verifyArtifactOwnership(artifact, req))) {
      return res.status(403).json({ error: 'Forbidden: Private artifact' });
    }

    res.json({
      id: artifact._id,
      sessionId: artifact.sessionId,
      messageId: artifact.messageId,
      type: artifact.type,
      artifactClass: artifact.artifactClass,
      title: artifact.title,
      content: artifact.content,
      sceneGraph: artifact.sceneGraph,
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
    if (!(await verifyArtifactOwnership(artifact, req))) {
      return res.status(403).json({ error: 'Forbidden: You do not own this artifact' });
    }

    // Push current state to version history before overwriting
    const newVersion = artifact.version + 1;
    artifact.versions.push({
      content,
      sceneGraph: artifact.sceneGraph,
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
      sessionId: artifact.sessionId,
      type: artifact.type,
      artifactClass: artifact.artifactClass,
      title: artifact.title,
      content: artifact.content,
      sceneGraph: artifact.sceneGraph,
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
 * DELETE /api/artifact/:id
 * Delete an artifact with ownership check.
 */
export const deleteArtifact = async (req, res) => {
  try {
    const { id } = req.params;
    const artifact = await Artifact.findById(id);

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    if (!(await verifyArtifactOwnership(artifact, req))) {
      return res.status(403).json({ error: 'Forbidden: You do not own this artifact' });
    }

    await Artifact.findByIdAndDelete(id);
    console.log(`[Artifact] 🗑️ Deleted: ${id}`);

    res.json({ success: true, message: 'Artifact deleted' });
  } catch (err) {
    console.error('[Artifact:Delete] Error:', err);
    res.status(500).json({ error: 'Failed to delete artifact' });
  }
};

/**
 * GET /api/artifact/history/:id
 * Retrieve the full version history of an artifact.
 */
export const getArtifactHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const artifact = await Artifact.findById(id).select('userId guestId sessionId versions title type version').lean();

    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Ownership check: Prevent reading history of artifacts owned by others
    if (!(await verifyArtifactOwnership(artifact, req))) {
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
 * Enforces session ownership check before returning artifacts.
 */
export const getSessionArtifacts = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const isUser = Boolean(req.user?._id || req.user?.id);
    const guestId = req.guestId;

    if (!isUser && !guestId) {
      return res.status(401).json({ error: 'Authentication or guest identity required', code: 'UNAUTHORIZED' });
    }

    // SEC: Verify caller owns this session
    const session = await verifySessionOwnership(sessionId, req);
    if (!session) {
      return res.status(403).json({ error: 'Forbidden: Session not found or access denied' });
    }

    const artifacts = await Artifact.find({ sessionId })
      .select('-versions')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      sessionId,
      artifacts: artifacts.map(a => ({
        id: a._id,
        sessionId: a.sessionId,
        type: a.type,
        artifactClass: a.artifactClass,
        title: a.title,
        content: a.content,
        sceneGraph: a.sceneGraph,
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
 * AI-powered artifact modification with ownership verification.
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
    if (!(await verifyArtifactOwnership(artifact, req))) {
      return res.status(403).json({ error: 'Forbidden: You do not own this artifact' });
    }

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
    modifiedContent = modifiedContent.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

    const newVersion = artifact.version + 1;
    artifact.versions.push({
      content: modifiedContent,
      sceneGraph: artifact.sceneGraph,
      language: artifact.language,
      metadata: { ...artifact.metadata, instruction },
      version: newVersion,
      createdAt: new Date(),
    });

    if (artifact.versions.length > 50) {
      artifact.versions = artifact.versions.slice(-50);
    }

    artifact.content = modifiedContent;
    artifact.version = newVersion;

    await artifact.save();

    console.log(`[Artifact] 🤖 AI Modified: ${artifact._id} → v${newVersion} ("${instruction.substring(0, 40)}...")`);
    res.json({
      id: artifact._id,
      sessionId: artifact.sessionId,
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

/**
 * POST /api/artifact/generate
 * High-fidelity visual artifact generation with session ownership check.
 */
export const generateArtifact = async (req, res) => {
  try {
    const { sessionId, instruction } = req.body;
    const isUser = Boolean(req.user?._id || req.user?.id);
    const userId = req.user?._id || req.user?.id;
    const guestId = req.guestId;

    if (!instruction || !sessionId) {
      return res.status(400).json({ error: 'Session ID and Instruction are required' });
    }

    if (!isUser && !guestId) {
      return res.status(401).json({ error: 'Authentication or guest identity required', code: 'UNAUTHORIZED' });
    }

    // SEC: Verify session ownership
    const session = await verifySessionOwnership(sessionId, req);
    if (!session) {
      return res.status(403).json({ error: 'Forbidden: Session not found or access denied' });
    }

    console.log(`[Artifact:Generate] 🚀 Classifying intent: "${instruction.substring(0, 50)}..."`);
    
    const classification = await classifyArtifact(instruction);
    const { artifactClass, isVisual, title } = classification;

    let sceneGraph = null;
    let content = '';
    let type = isVisual ? 'visual' : 'document';

    if (isVisual) {
      console.log(`[Artifact:Generate] 🎨 Generating ${artifactClass} scene graph...`);
      sceneGraph = await generateSceneGraph(instruction, artifactClass);
      content = JSON.stringify(sceneGraph);
    } else {
      type = classification.artifactClass === 'code' ? 'code' : 'document';
      const result = await requestCompletion({
        model: resolveModelId(getTextModel()),
        messages: [{ role: 'user', content: instruction }],
        temperature: 0.7,
        taskType: 'generation'
      });
      content = result.content;
    }

    const artifact = await Artifact.create({
      userId: isUser ? userId : null,
      guestId: isUser ? null : guestId,
      sessionId,
      type,
      artifactClass,
      title: title || 'New Artifact',
      content,
      sceneGraph,
      version: 1,
    });

    console.log(`[Artifact:Generate] ✅ Created: ${artifact._id} (${artifactClass})`);

    res.status(201).json({
      id: artifact._id,
      sessionId: artifact.sessionId,
      type: artifact.type,
      artifactClass: artifact.artifactClass,
      title: artifact.title,
      content: artifact.content,
      sceneGraph: artifact.sceneGraph,
      version: artifact.version,
      createdAt: artifact.createdAt,
    });
  } catch (err) {
    console.error('[Artifact:Generate] Error:', err);
    res.status(500).json({ error: 'Failed to generate artifact', details: err.message });
  }
};

/**
 * POST /api/artifact/edit
 * AI-powered delta-based modification for visual artifacts with ownership check.
 */
export const editArtifact = async (req, res) => {
  try {
    const { artifactId, instruction } = req.body;

    if (!artifactId || !instruction) {
      return res.status(400).json({ error: 'Artifact ID and Instruction are required' });
    }

    const artifact = await Artifact.findById(artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Ownership check
    if (!(await verifyArtifactOwnership(artifact, req))) {
      return res.status(403).json({ error: 'Forbidden: You do not own this artifact' });
    }

    if (artifact.sceneGraph) {
      console.log(`[Artifact:Edit] 🔧 Applying delta to visual artifact: ${artifact._id}`);
      
      const refs = resolveReference(instruction, artifact.sceneGraph);
      if (refs.length > 0) {
        console.log(`[Artifact:Edit] Identified references: ${refs.map(r => r.label).join(', ')}`);
      }

      const delta = await generateSceneGraphDelta(instruction, artifact.sceneGraph);
      const newSceneGraph = applyDelta(artifact.sceneGraph, delta);

      artifact.sceneGraph = newSceneGraph;
      artifact.content = JSON.stringify(newSceneGraph);
      artifact.editHistory.push({
        instruction,
        patchApplied: delta,
        previousVersion: artifact.version,
        timestamp: new Date()
      });
      
      await artifact.save();

      console.log(`[Artifact:Edit] ✅ Applied delta, new version: ${artifact.version}`);

      return res.json({
        artifactId: artifact._id,
        sessionId: artifact.sessionId,
        delta,
        newSceneGraph,
        version: artifact.version,
        summary: delta.summary
      });
    } else {
      return modifyArtifact(req, res);
    }
  } catch (err) {
    console.error('[Artifact:Edit] Error:', err);
    res.status(500).json({ error: 'Failed to edit artifact', details: err.message });
  }
};

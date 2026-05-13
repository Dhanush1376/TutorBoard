import { z } from 'zod';
import Artifact from '../models/Artifact.js';
import { requestCompletion, getTextModel, resolveModelId } from '../utils/ai/llmClient.js';
import { classifyArtifact } from '../engine/agents/artifactClassifierAgent.js';
import { generateSceneGraph } from '../engine/agents/sceneGraphAgent.js';
import { generateDelta as generateSceneGraphDelta } from '../engine/agents/sceneGraphDeltaAgent.js';
import { applyDelta, resolveReference } from '../engine/sceneGraph/sceneGraphUtils.js';

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

/**
 * POST /api/artifact/generate
 * New high-fidelity visual artifact generation endpoint.
 */
export const generateArtifact = async (req, res) => {
  try {
    const { sessionId, instruction } = req.body;
    const userId = req.user?._id || req.user?.id || null;

    if (!instruction || !sessionId) {
      return res.status(400).json({ error: 'Session ID and Instruction are required' });
    }

    console.log(`[Artifact:Generate] 🚀 Classifying intent: "${instruction.substring(0, 50)}..."`);
    
    // 1. Classify the intent
    const classification = await classifyArtifact(instruction);
    const { artifactClass, isVisual, title } = classification;

    let sceneGraph = null;
    let content = '';
    let type = isVisual ? 'visual' : 'document';

    // 2. If visual, generate scene graph
    if (isVisual) {
      console.log(`[Artifact:Generate] 🎨 Generating ${artifactClass} scene graph...`);
      sceneGraph = await generateSceneGraph(instruction, artifactClass);
      content = JSON.stringify(sceneGraph);
    } else {
      // Legacy document generation or code
      console.log(`[Artifact:Generate] 📄 Generating document/code...`);
      // For now, we can use a simple prompt or delegate to legacy logic
      // But let's follow the plan: classify first.
      type = classification.artifactClass === 'code' ? 'code' : 'document';
      const result = await requestCompletion({
        model: resolveModelId(getTextModel()),
        messages: [{ role: 'user', content: instruction }],
        temperature: 0.7,
        taskType: 'generation'
      });
      content = result.content;
    }

    // 3. Create the artifact
    const artifact = await Artifact.create({
      userId,
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
 * AI-powered delta-based modification for visual artifacts.
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
    if (artifact.userId && String(artifact.userId) !== String(req.user?._id || req.user?.id)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this artifact' });
    }

    // If it's a visual artifact with a scene graph, use delta engine
    if (artifact.sceneGraph) {
      console.log(`[Artifact:Edit] 🔧 Applying delta to visual artifact: ${artifact._id}`);
      
      // 1. Resolve natural language references for context logging (optional but good for debugging)
      const refs = resolveReference(instruction, artifact.sceneGraph);
      if (refs.length > 0) {
        console.log(`[Artifact:Edit] Identified references: ${refs.map(r => r.label).join(', ')}`);
      }

      // 2. Generate delta from LLM
      const delta = await generateSceneGraphDelta(instruction, artifact.sceneGraph);

      // 3. Apply delta to current graph
      const newSceneGraph = applyDelta(artifact.sceneGraph, delta);

      // 4. Update artifact
      artifact.sceneGraph = newSceneGraph;
      artifact.content = JSON.stringify(newSceneGraph);
      artifact.editHistory.push({
        instruction,
        patchApplied: delta,
        previousVersion: artifact.version,
        timestamp: new Date()
      });
      
      // Pre-save hook will handle version increment and versions array push
      await artifact.save();

      console.log(`[Artifact:Edit] ✅ Applied delta, new version: ${artifact.version}`);

      return res.json({
        artifactId: artifact._id,
        delta,
        newSceneGraph,
        version: artifact.version,
        summary: delta.summary
      });
    } else {
      // Fallback to legacy full-regen modifyArtifact if no sceneGraph exists
      return modifyArtifact(req, res);
    }
  } catch (err) {
    console.error('[Artifact:Edit] Error:', err);
    res.status(500).json({ error: 'Failed to edit artifact', details: err.message });
  }
};

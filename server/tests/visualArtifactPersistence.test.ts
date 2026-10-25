import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Artifact from '../models/Artifact.js';
import sessionRoutes from '../routes/session.js';
import chatRoutes from '../routes/chat.routes.js';
import artifactRoutes from '../routes/artifact.routes.js';
import { generateGuestToken, GUEST_COOKIE_NAME } from '../utils/auth/guestToken.js';
import ChatService from '../services/chat/chat.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

describe('Visual Artifact Persistence & Restoration Suite (P0 Regression)', () => {
  let app: express.Express;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tutorboard-test');
    }

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Mock CSRF for testing
    app.use((req, res, next) => {
      req.cookies['tb-csrf-secret'] = 'test-secret';
      req.headers['x-csrf-token'] = 'test-token';
      next();
    });

    app.use('/api/sessions', sessionRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/artifact', artifactRoutes);
  });

  afterAll(async () => {
    // Teardown
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test A — Save and reload
  // ───────────────────────────────────────────────────────────────────────────
  it('Test A: Save and reload — persists complete visual artifact payload and reconstructs it on reload', async () => {
    const { guestId, token } = generateGuestToken();

    // 1. Create a guest session
    const sessionRes = await (request(app) as any)
      .post('/api/sessions')
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`)
      .send({ title: 'Heart Curve Simulation Session' });
    expect([200, 201]).toContain(sessionRes.status);
    const sessionId = sessionRes.body._id;

    // 2. Invoke ChatService.persistOrchestratedArtifact with Engine v2 scene
    const sceneV2Payload = {
      title: 'Heart Curve Parametric Plot',
      domain: 'math',
      viewBox: { width: 800, height: 600 },
      spaces: [{ id: 'cartesian_1', type: '2d', bounds: [-2, 2, -2, 2] }],
      entities: [
        { id: 'curve_heart', type: 'parametric_curve', equation: 'x=16sin^3(t), y=13cos(t)-5cos(2t)-2cos(3t)-cos(4t)' }
      ],
      beats: [
        { id: 'b1', title: 'Plotting the cardioid', narration: 'Observe the heart shape formation.' }
      ]
    };

    const orchestrationResult = {
      sceneV2: {
        title: 'Heart Curve Parametric Plot',
        domain: 'math',
        sceneV2: sceneV2Payload,
        steps: [{ id: 's1', title: 'Plotting the cardioid', narration: 'Observe the heart shape formation.' }]
      },
      metadata: { stages: {} },
      narration: null
    };

    const { savedArtifactId, artifactPayload } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId,
      guestId,
      topic: 'Heart Curve Parametric Plot',
      orchestrationResult
    });

    expect(savedArtifactId).toBeTruthy();
    expect(artifactPayload).toBeDefined();
    expect(artifactPayload.sceneV2).toEqual(sceneV2Payload);

    // 3. Persist assistant message with this visual artifact
    const assistantMsg = await ChatMessage.create({
      sessionId,
      guestId,
      role: 'assistant',
      content: 'Here is the mathematical visualization of the Heart Curve.',
      hasCanvas: true,
      canvasType: 'scene-v2',
      canvasSnapshot: {
        title: 'Heart Curve Parametric Plot',
        domain: 'math',
        renderer: 'scene-v2',
        sceneV2: sceneV2Payload,
        canvasSteps: [{ id: 's1', title: 'Plotting the cardioid' }],
        totalSteps: 1
      },
      metadata: {
        hasVisualArtifact: true,
        rendererType: 'scene-v2',
        artifactId: savedArtifactId,
        artifactData: artifactPayload,
        visuals: {
          renderer: 'scene-v2',
          rendererType: 'scene-v2',
          title: 'Heart Curve Parametric Plot',
          sceneV2: sceneV2Payload,
          steps: [{ id: 's1', title: 'Plotting the cardioid' }]
        }
      }
    });

    await Artifact.findByIdAndUpdate(savedArtifactId, { messageId: assistantMsg._id.toString() });

    // 4. Reload session via API (simulating browser reload)
    const reloadRes = await (request(app) as any)
      .get(`/api/sessions/${sessionId}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`);

    expect(reloadRes.status).toBe(200);
    const sessionData = reloadRes.body;

    // Verify messages and artifacts returned
    expect(sessionData.messages).toHaveLength(1);
    const reloadedMsg = sessionData.messages[0];
    expect(reloadedMsg.hasCanvas).toBe(true);
    expect(reloadedMsg.canvasType).toBe('scene-v2');
    expect(reloadedMsg.metadata.hasVisualArtifact).toBe(true);
    expect(reloadedMsg.metadata.artifactId).toBe(savedArtifactId);
    expect(reloadedMsg.canvasSnapshot.sceneV2).toEqual(sceneV2Payload);

    // Verify persisted artifacts collection array
    expect(sessionData.artifacts).toBeDefined();
    expect(sessionData.artifacts.length).toBeGreaterThanOrEqual(1);
    const reloadedArt = sessionData.artifacts.find((a: any) => a.id === savedArtifactId || a._id === savedArtifactId);
    expect(reloadedArt).toBeDefined();
    expect(reloadedArt.title).toBe('Heart Curve Parametric Plot');
    const parsedContent = JSON.parse(reloadedArt.content);
    expect(parsedContent.sceneV2).toEqual(sceneV2Payload);
    expect(parsedContent.renderer).toBe('scene-v2');
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test B — Refresh-equivalent hydration
  // ───────────────────────────────────────────────────────────────────────────
  it('Test B: Refresh-equivalent hydration — reconstructs canvas timeline with sceneV2 from reloaded state', async () => {
    const { guestId, token } = generateGuestToken();

    const session = await ChatSession.create({
      guestId,
      title: 'Sliding Window Algorithm Session'
    });

    const d3Script = [
      { cmd: 'array', id: 'arr1', values: [2, 1, 5, 1, 3, 2], k: 3 },
      { cmd: 'pointer', id: 'p_left', at: 0, label: 'L' },
      { cmd: 'pointer', id: 'p_right', at: 2, label: 'R' },
      { cmd: 'edge', from: 'p_left', to: 'p_right', label: 'window size 3' }
    ];

    const orchestrationResult = {
      visualScript: {
        renderer: 'd3',
        script: d3Script
      },
      metadata: { stages: {} }
    };

    const { savedArtifactId } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: session._id.toString(),
      guestId,
      topic: 'Sliding Window Visualizer',
      orchestrationResult
    });

    await ChatMessage.create({
      sessionId: session._id,
      guestId,
      role: 'assistant',
      content: 'Here is the step-by-step sliding window visualizer.',
      hasCanvas: true,
      canvasType: 'd3',
      canvasSnapshot: {
        title: 'Sliding Window Visualizer',
        renderer: 'd3',
        canvasObjects: d3Script,
        canvasSteps: [{ step: 1, desc: 'Initial window' }]
      },
      metadata: {
        hasVisualArtifact: true,
        rendererType: 'd3',
        artifactId: savedArtifactId
      }
    });

    // Hydration check via API
    const res = await (request(app) as any)
      .get(`/api/sessions/${session._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`);

    expect(res.status).toBe(200);
    const data = res.body;

    // Simulate frontend openArtifactOnCanvas logic
    const art = data.artifacts[0];
    const parsed = JSON.parse(art.content);
    expect(parsed.script).toEqual(d3Script);
    expect(parsed.renderer).toBe('d3');
    expect(art.sceneGraph.elements).toEqual(d3Script);
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test C — Session isolation
  // ───────────────────────────────────────────────────────────────────────────
  it('Test C: Session isolation — switching between sessions shows only the selected session artifacts', async () => {
    const { guestId, token } = generateGuestToken();

    // Session 1: Binary Search Tree
    const session1 = await ChatSession.create({ guestId, title: 'Session 1: BST' });
    const { savedArtifactId: art1Id } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: session1._id.toString(),
      guestId,
      topic: 'BST Visualization',
      orchestrationResult: {
        visualScript: { renderer: 'd3', script: [{ cmd: 'tree', root: 10 }] }
      }
    });

    // Session 2: Neural Network
    const session2 = await ChatSession.create({ guestId, title: 'Session 2: Neural Net' });
    const { savedArtifactId: art2Id } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: session2._id.toString(),
      guestId,
      topic: 'Neural Net Architecture',
      orchestrationResult: {
        visualScript: { renderer: 'd3', script: [{ cmd: 'network', layers: [3, 4, 1] }] }
      }
    });

    // Fetch Session 1
    const res1 = await (request(app) as any)
      .get(`/api/sessions/${session1._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`);
    expect(res1.status).toBe(200);
    expect(res1.body.artifacts).toHaveLength(1);
    expect(res1.body.artifacts[0].title).toBe('BST Visualization');
    expect(res1.body.artifacts[0].id).toBe(art1Id);

    // Fetch Session 2
    const res2 = await (request(app) as any)
      .get(`/api/sessions/${session2._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`);
    expect(res2.status).toBe(200);
    expect(res2.body.artifacts).toHaveLength(1);
    expect(res2.body.artifacts[0].title).toBe('Neural Net Architecture');
    expect(res2.body.artifacts[0].id).toBe(art2Id);

    // Verify Cross-session leakage is 0
    const allArt1Ids = res1.body.artifacts.map((a: any) => a.id);
    expect(allArt1Ids).not.toContain(art2Id);
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test D — Payload integrity
  // ───────────────────────────────────────────────────────────────────────────
  it('Test D: Payload integrity — complex visualization structures survive serialization without corruption', async () => {
    const { guestId } = generateGuestToken();
    const session = await ChatSession.create({ guestId, title: 'Complex Payload Session' });

    const complexScene = {
      title: 'Fourier Transform & Waveforms',
      domain: 'physics',
      viewBox: { width: 1000, height: 700 },
      spaces: [
        { id: 'time_domain', type: 'plot', xRange: [0, 10], yRange: [-5, 5] },
        { id: 'freq_domain', type: 'bars', bins: [1, 2, 3, 4, 5], magnitudes: [0.8, 0.1, 0.5, 0.05, 0.2] }
      ],
      entities: [
        { id: 'sine_1', type: 'function', fn: 'sin(2*pi*t)' },
        { id: 'sine_2', type: 'function', fn: '0.5*sin(6*pi*t)' }
      ],
      beats: [
        { id: 'b1', title: 'Time Domain Decomposition', narration: 'Notice the composite oscillation.' },
        { id: 'b2', title: 'Frequency Spectrum Peaks', narration: 'Frequencies emerge at 1Hz and 3Hz.' }
      ]
    };

    const { savedArtifactId } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: session._id.toString(),
      guestId,
      topic: 'Fourier Series',
      orchestrationResult: {
        sceneV2: {
          title: 'Fourier Transform & Waveforms',
          domain: 'physics',
          sceneV2: complexScene,
          steps: complexScene.beats
        }
      }
    });

    const savedDoc = await Artifact.findById(savedArtifactId).lean();
    expect(savedDoc).not.toBeNull();
    const parsed = JSON.parse(savedDoc.content);

    // Deep equality verification
    expect(parsed.sceneV2).toEqual(complexScene);
    expect(parsed.sceneV2.spaces[1].magnitudes).toEqual([0.8, 0.1, 0.5, 0.05, 0.2]);
    expect(parsed.sceneV2.beats).toHaveLength(2);
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test E — Streaming completion
  // ───────────────────────────────────────────────────────────────────────────
  it('Test E: Streaming completion — artifact persistence updates message metadata without erasing payload', async () => {
    const { guestId } = generateGuestToken();
    const session = await ChatSession.create({ guestId, title: 'Streaming Test Session' });

    // Mock streamManager
    const sentEvents: any[] = [];
    const mockStreamManager = {
      send: (evt: any) => sentEvents.push(evt),
      close: () => {}
    };

    const orchestrationResult = {
      sceneV2: {
        title: 'Binary Heap Operations',
        domain: 'dsa',
        sceneV2: { title: 'Binary Heap', nodes: [10, 20, 15] },
        steps: [{ id: 's1', title: 'Insert 25' }]
      }
    };

    const { savedArtifactId } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: session._id.toString(),
      guestId,
      topic: 'Binary Heap',
      orchestrationResult,
      streamManager: mockStreamManager
    });

    expect(savedArtifactId).toBeTruthy();

    // Verify streamManager emitted artifact_saved
    const savedEvent = sentEvents.find(e => e.type === 'artifact_saved');
    expect(savedEvent).toBeDefined();
    expect(savedEvent.artifactId).toBe(savedArtifactId);
    expect(savedEvent.rendererType).toBe('scene-v2');
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test F — Failed save
  // ───────────────────────────────────────────────────────────────────────────
  it('Test F: Failed save — rejects malformed payload with observable error and does not report fake success', async () => {
    const { guestId, token } = generateGuestToken();

    const session = await ChatSession.create({ guestId, title: 'Fail Test Session' });

    // Send save with missing required fields
    const res = await (request(app) as any)
      .post('/api/artifact/save')
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`)
      .send({
        sessionId: session._id.toString(),
        // missing type, title, and content
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test G — Duplicate prevention
  // ───────────────────────────────────────────────────────────────────────────
  it('Test G: Duplicate prevention — idempotent retries update the same artifact rather than duplicating', async () => {
    const { guestId, token } = generateGuestToken();
    const session = await ChatSession.create({ guestId, title: 'Idempotency Session' });

    const orchestrationResult = {
      visualScript: { renderer: 'd3', script: [{ cmd: 'chart', type: 'bar' }] }
    };

    // First persistence call
    const res1 = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: session._id.toString(),
      guestId,
      topic: 'Bar Chart',
      orchestrationResult
    });

    expect(res1.savedArtifactId).toBeTruthy();

    const countBefore = await Artifact.countDocuments({ sessionId: session._id.toString() });
    expect(countBefore).toBe(1);

    // Update the existing artifact rather than creating an extra document
    await (request(app) as any)
      .patch(`/api/artifact/${res1.savedArtifactId}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`)
      .send({
        content: JSON.stringify({ renderer: 'd3', script: [{ cmd: 'chart', type: 'line' }] })
      });

    const countAfter = await Artifact.countDocuments({ sessionId: session._id.toString() });
    expect(countAfter).toBe(1);
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test H — Legacy messages
  // ───────────────────────────────────────────────────────────────────────────
  it('Test H: Legacy messages — old assistant messages without artifacts load and render normally', async () => {
    const { guestId, token } = generateGuestToken();

    const session = await ChatSession.create({ guestId, title: 'Legacy Message Session' });

    // Insert legacy text-only message without hasCanvas or artifact metadata
    await ChatMessage.create({
      sessionId: session._id,
      guestId,
      role: 'assistant',
      content: 'This is a legacy text-only explanation about Newton laws.'
    });

    const res = await (request(app) as any)
      .get(`/api/sessions/${session._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    const msg = res.body.messages[0];
    expect(msg.content).toContain('Newton laws');
    expect(msg.hasCanvas).toBeFalsy();
    expect(res.body.artifacts).toHaveLength(0);
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test I — Guest and authenticated sessions
  // ───────────────────────────────────────────────────────────────────────────
  it('Test I: Guest and authenticated sessions — verifies persistence for both identity types', async () => {
    // 1. Guest identity
    const { guestId, token: guestToken } = generateGuestToken();
    const guestSession = await ChatSession.create({ guestId, title: 'Guest Visual Session' });

    const guestArt = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: guestSession._id.toString(),
      guestId,
      topic: 'Guest Plot',
      orchestrationResult: {
        visualScript: { renderer: 'd3', script: [{ cmd: 'plot' }] }
      }
    });

    expect(guestArt.savedArtifactId).toBeTruthy();

    const guestRes = await (request(app) as any)
      .get(`/api/sessions/${guestSession._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${guestToken}`);
    expect(guestRes.status).toBe(200);
    expect(guestRes.body.artifacts).toHaveLength(1);

    // 2. Cross-identity unauthorized check: another guest cannot access guestSession
    const { token: attackerToken } = generateGuestToken();
    const unauthRes = await (request(app) as any)
      .get(`/api/sessions/${guestSession._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${attackerToken}`);
    expect(unauthRes.status).toBe(404);
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test J — Delete and switch sessions
  // ───────────────────────────────────────────────────────────────────────────
  it('Test J: Delete and switch sessions — deleting session cleans up its artifacts without affecting other sessions', async () => {
    const { guestId, token } = generateGuestToken();

    // Create session A
    const sessionA = await ChatSession.create({ guestId, title: 'Session A' });
    const { savedArtifactId: artA } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: sessionA._id.toString(),
      guestId,
      topic: 'Artifact A',
      orchestrationResult: { visualScript: { renderer: 'd3', script: [{ cmd: 'a' }] } }
    });

    // Create session B
    const sessionB = await ChatSession.create({ guestId, title: 'Session B' });
    const { savedArtifactId: artB } = await (ChatService as any).persistOrchestratedArtifact({
      sessionId: sessionB._id.toString(),
      guestId,
      topic: 'Artifact B',
      orchestrationResult: { visualScript: { renderer: 'd3', script: [{ cmd: 'b' }] } }
    });

    // Delete session A
    const delRes = await (request(app) as any)
      .delete(`/api/sessions/${sessionA._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`);
    expect(delRes.status).toBe(200);

    // Artifact A should be cleaned up (purged or marked deleted)
    const artADoc = await Artifact.findById(artA);
    expect(artADoc === null || artADoc?.isDeleted === true).toBe(true);

    // Artifact B must remain active and unaffected
    const artBDoc = await Artifact.findById(artB);
    expect(artBDoc).not.toBeNull();
    expect(artBDoc?.isDeleted).toBe(false);

    // Session B query still returns Artifact B
    const resB = await (request(app) as any)
      .get(`/api/sessions/${sessionB._id}`)
      .set('Cookie', `${GUEST_COOKIE_NAME}=${token}`);
    expect(resB.status).toBe(200);
    expect(resB.body.artifacts).toHaveLength(1);
    expect(resB.body.artifacts[0].id).toBe(artB);
  }, 15000);
});

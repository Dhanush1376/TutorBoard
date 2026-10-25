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
import { generateGuestToken, verifyGuestToken, GUEST_COOKIE_NAME } from '../utils/auth/guestToken.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

describe('TutorBoard End-to-End Refresh Recovery & Acceptance Test Suite', () => {
  let app: express.Express;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tutorboard-test');
    }

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Mock CSRF for testing: bypass or populate valid secret
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
    // Clean up test collections if needed
  });

  it('GUEST WORKFLOW: creates 3 conversations, adds messages, canvas and artifacts, refreshes, reopens in different order, verifies total data retention and isolation', async () => {
    // 1. Initial Guest visit: GET /api/sessions issues guest token
    const initRes = await request(app).get('/api/sessions');
    expect(initRes.status).toBe(200);

    const cookies = initRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const guestCookieStr = (cookies as unknown as string[]).find((c: string) => c.startsWith(`${GUEST_COOKIE_NAME}=`));
    expect(guestCookieStr).toBeDefined();

    const guestToken = guestCookieStr!.split(';')[0].split('=')[1];
    const guestId = await verifyGuestToken(guestToken);
    expect(guestId).toMatch(/^gst_/);

    const guestCookie = `${GUEST_COOKIE_NAME}=${guestToken}`;

    // 2. Conversation 1: Calculus (Derivatives)
    const conv1SaveRes = await request(app)
      .post('/api/sessions')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken)
      .send({
        title: 'Calculus: Power Rule',
        canvasState: [
          { id: 'manual-draw-1', type: 'draw', color: '#ff0000', points: [0.1, 0.2, 0.3, 0.4] }
        ],
        canvasSteps: [{ stepIndex: 0, label: 'f(x) = x^2' }],
        preferences: { drawColor: '#ff0000', drawWidth: 4 }
      });
    expect(conv1SaveRes.status).toBe(200);
    const conv1Id = conv1SaveRes.body._id;
    expect(conv1Id).toBeDefined();

    // Add user and assistant messages to Conv 1
    const m1User = await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(conv1Id),
      guestId,
      role: 'user',
      content: 'Explain the power rule for derivatives with examples.'
    });
    const m1Assistant = await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(conv1Id),
      guestId,
      role: 'assistant',
      content: 'The power rule states that d/dx[x^n] = n*x^(n-1). For example, d/dx[x^3] = 3x^2.'
    });

    // Add visual artifact to Conv 1
    const art1Res = await request(app)
      .post('/api/artifact/save')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken)
      .send({
        sessionId: conv1Id,
        title: 'Parabola Slope Diagram',
        type: 'visual',
        content: '<svg><path d="M 10 80 Q 52.5 10, 95 80" /></svg>'
      });
    expect(art1Res.status).toBe(201);
    const art1Id = art1Res.body.id;

    // 3. Conversation 2: Quantum Physics (Wave-Particle Duality)
    const conv2SaveRes = await request(app)
      .post('/api/sessions')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken)
      .send({
        title: 'Quantum: Double Slit',
        canvasState: [
          { id: 'manual-rect-2', type: 'rect', x: 100, y: 150, width: 200, height: 100 }
        ],
        canvasSteps: [{ stepIndex: 0, label: 'Interference pattern' }],
        preferences: { drawColor: '#00ff00', drawWidth: 2 }
      });
    expect(conv2SaveRes.status).toBe(200);
    const conv2Id = conv2SaveRes.body._id;

    const m2User = await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(conv2Id),
      guestId,
      role: 'user',
      content: 'What happens in the double-slit experiment when observed?'
    });
    const m2Assistant = await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(conv2Id),
      guestId,
      role: 'assistant',
      content: 'When detectors are placed at the slits, the wave function collapses and an interference pattern is lost.'
    });

    const art2Res = await request(app)
      .post('/api/artifact/save')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken)
      .send({
        sessionId: conv2Id,
        title: 'Wave Interference Chart',
        type: 'diagram',
        content: 'graph TD; Laser-->Slits; Slits-->Screen;'
      });
    expect(art2Res.status).toBe(201);
    const art2Id = art2Res.body.id;

    // 4. Conversation 3: Computer Science (Binary Search Tree)
    const conv3SaveRes = await request(app)
      .post('/api/sessions')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken)
      .send({
        title: 'Data Structures: BST',
        canvasState: [
          { id: 'manual-note-3', type: 'note', text: 'Root node is 50', x: 50, y: 50 }
        ],
        canvasSteps: [{ stepIndex: 0, label: 'Insert 50' }],
        preferences: { drawColor: '#0000ff', drawWidth: 6 }
      });
    expect(conv3SaveRes.status).toBe(200);
    const conv3Id = conv3SaveRes.body._id;

    const m3User = await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(conv3Id),
      guestId,
      role: 'user',
      content: 'How does BST insert work in O(log n)?'
    });
    const m3Assistant = await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(conv3Id),
      guestId,
      role: 'assistant',
      content: 'Compare the new value against the current node: go left if smaller, right if larger.'
    });

    const art3Res = await request(app)
      .post('/api/artifact/save')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken)
      .send({
        sessionId: conv3Id,
        title: 'BST Implementation',
        type: 'code',
        language: 'python',
        content: 'def insert(node, val): ...'
      });
    expect(art3Res.status).toBe(201);
    const art3Id = art3Res.body.id;

    // ── 5. SIMULATE BROWSER REFRESH ──
    // On refresh, the browser only retains cookies and localStorage (guest token + active chat ID).
    // The client calls GET /api/sessions to populate the sidebar list:
    const refreshListRes = await request(app)
      .get('/api/sessions')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(refreshListRes.status).toBe(200);
    expect(refreshListRes.body.sessions).toHaveLength(3);

    const returnedIds = refreshListRes.body.sessions.map((s: any) => s._id);
    expect(returnedIds).toContain(conv1Id);
    expect(returnedIds).toContain(conv2Id);
    expect(returnedIds).toContain(conv3Id);

    // ── 6. REOPEN ALL THREE CONVERSATIONS IN DIFFERENT ORDER (2, 3, 1) ──
    // Reopen Conversation 2
    const restoreConv2 = await request(app)
      .get(`/api/sessions/${conv2Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(restoreConv2.status).toBe(200);
    expect(restoreConv2.body.title).toBe('Quantum: Double Slit');
    expect(restoreConv2.body.messages).toHaveLength(2);
    expect(restoreConv2.body.messages[0].content).toContain('double-slit');
    expect(restoreConv2.body.messages[1].content).toContain('wave function collapses');
    expect(restoreConv2.body.canvasState).toHaveLength(1);
    expect(restoreConv2.body.canvasState[0].id).toBe('manual-rect-2');
    expect(restoreConv2.body.artifacts).toHaveLength(1);
    expect(restoreConv2.body.artifacts[0].title).toBe('Wave Interference Chart');

    // Reopen Conversation 3
    const restoreConv3 = await request(app)
      .get(`/api/sessions/${conv3Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(restoreConv3.status).toBe(200);
    expect(restoreConv3.body.title).toBe('Data Structures: BST');
    expect(restoreConv3.body.messages).toHaveLength(2);
    expect(restoreConv3.body.messages[0].content).toContain('BST insert');
    expect(restoreConv3.body.canvasState[0].id).toBe('manual-note-3');
    expect(restoreConv3.body.artifacts[0].title).toBe('BST Implementation');

    // Reopen Conversation 1
    const restoreConv1 = await request(app)
      .get(`/api/sessions/${conv1Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(restoreConv1.status).toBe(200);
    expect(restoreConv1.body.title).toBe('Calculus: Power Rule');
    expect(restoreConv1.body.messages).toHaveLength(2);
    expect(restoreConv1.body.messages[0].content).toContain('power rule');
    expect(restoreConv1.body.canvasState[0].id).toBe('manual-draw-1');
    expect(restoreConv1.body.artifacts[0].title).toBe('Parabola Slope Diagram');

    // ── 7. MODIFY ARTIFACT 1 AND VERIFY OTHER CONVERSATIONS REMAIN UNCHANGED ──
    const updateArt1Res = await request(app)
      .put(`/api/artifact/${art1Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken)
      .send({
        title: 'Updated Parabola Slope Diagram (v2)',
        content: '<svg><path d="M 0 0 L 100 100" /></svg>'
      });
    expect(updateArt1Res.status).toBe(200);
    expect(updateArt1Res.body.version).toBe(2);

    // Verify Conv 2 and Conv 3 are unaffected
    const checkConv2 = await request(app)
      .get(`/api/sessions/${conv2Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(checkConv2.body.artifacts[0].title).toBe('Wave Interference Chart');
    expect(checkConv2.body.artifacts[0].version).toBe(1);

    const checkConv3 = await request(app)
      .get(`/api/sessions/${conv3Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(checkConv3.body.artifacts[0].title).toBe('BST Implementation');
    expect(checkConv3.body.artifacts[0].version).toBe(1);

    // ── 8. DELETE CONVERSATION 3 AND VERIFY CONVERSATIONS 1 & 2 REMAIN INTACT ──
    const delRes = await request(app)
      .delete(`/api/sessions/${conv3Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(delRes.status).toBe(200);

    // Verify Conv 3 is marked deleted and excluded from listing
    const afterDelList = await request(app)
      .get('/api/sessions')
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(afterDelList.body.sessions).toHaveLength(2);
    const afterDelIds = afterDelList.body.sessions.map((s: any) => s._id);
    expect(afterDelIds).not.toContain(conv3Id);
    expect(afterDelIds).toContain(conv1Id);
    expect(afterDelIds).toContain(conv2Id);

    // Conv 1 and Conv 2 remain fully intact with messages and canvas
    const verifyConv1 = await request(app)
      .get(`/api/sessions/${conv1Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(verifyConv1.status).toBe(200);
    expect(verifyConv1.body.messages).toHaveLength(2);
    expect(verifyConv1.body.canvasState[0].id).toBe('manual-draw-1');

    const verifyConv2 = await request(app)
      .get(`/api/sessions/${conv2Id}`)
      .set('Cookie', guestCookie)
      .set('X-Guest-Token', guestToken);
    expect(verifyConv2.status).toBe(200);
    expect(verifyConv2.body.messages).toHaveLength(2);
    expect(verifyConv2.body.canvasState[0].id).toBe('manual-rect-2');
  });

  it('AUTHENTICATED USER WORKFLOW: creates 3 conversations, adds messages, canvas and artifacts, refreshes, reopens in different order, verifies total data retention and isolation', async () => {
    // 1. Create authenticated user
    const { default: User } = await import('../models/User.js');
    const { default: jwt } = await import('jsonwebtoken');
    const crypto = await import('crypto');

    const authUser = await User.create({
      email: `auth-test-${Date.now()}@example.com`,
      password: 'StrongPassword123!',
      name: 'Dr. Jane Smith',
    });
    const userId = authUser._id.toString();
    const authToken = jwt.sign(
      { id: userId, jti: crypto.randomUUID(), type: 'access' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '7d', algorithm: 'HS256' }
    );
    const authHeaders = {
      Authorization: `Bearer ${authToken}`
    };

    // 2. Conversation 1: Machine Learning
    const c1Res = await request(app)
      .post('/api/sessions')
      .set(authHeaders)
      .send({
        title: 'ML: Gradient Descent',
        canvasState: [{ id: 'manual-ml-1', type: 'draw', color: '#6366f1' }],
        canvasSteps: [{ stepIndex: 0, label: 'Cost curve' }],
        preferences: { drawColor: '#6366f1' }
      });
    expect(c1Res.status).toBe(200);
    const c1Id = c1Res.body._id;

    await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(c1Id),
      userId: new mongoose.Types.ObjectId(userId),
      role: 'user',
      content: 'Explain gradient descent learning rate.'
    });
    await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(c1Id),
      userId: new mongoose.Types.ObjectId(userId),
      role: 'assistant',
      content: 'Learning rate controls step size towards the loss function minimum.'
    });

    const a1Res = await request(app)
      .post('/api/artifact/save')
      .set(authHeaders)
      .send({
        sessionId: c1Id,
        title: 'Gradient Descent Plot',
        type: 'visual',
        content: '<svg><circle cx="50" cy="50" r="40" /></svg>'
      });
    expect(a1Res.status).toBe(201);
    const a1Id = a1Res.body.id;

    // 3. Conversation 2: Operating Systems
    const c2Res = await request(app)
      .post('/api/sessions')
      .set(authHeaders)
      .send({
        title: 'OS: Deadlocks',
        canvasState: [{ id: 'manual-os-2', type: 'rect', x: 20, y: 20 }],
        canvasSteps: [{ stepIndex: 0, label: 'Dining philosophers' }],
        preferences: { drawColor: '#ef4444' }
      });
    expect(c2Res.status).toBe(200);
    const c2Id = c2Res.body._id;

    await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(c2Id),
      userId: new mongoose.Types.ObjectId(userId),
      role: 'user',
      content: 'What are the Coffman conditions for deadlock?'
    });
    await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(c2Id),
      userId: new mongoose.Types.ObjectId(userId),
      role: 'assistant',
      content: 'Mutual exclusion, hold and wait, no preemption, and circular wait.'
    });

    const a2Res = await request(app)
      .post('/api/artifact/save')
      .set(authHeaders)
      .send({
        sessionId: c2Id,
        title: 'Resource Allocation Graph',
        type: 'diagram',
        content: 'graph LR; P1-->R1; R1-->P2;'
      });
    expect(a2Res.status).toBe(201);
    const a2Id = a2Res.body.id;

    // 4. Conversation 3: Linear Algebra
    const c3Res = await request(app)
      .post('/api/sessions')
      .set(authHeaders)
      .send({
        title: 'Linear Algebra: Eigenvalues',
        canvasState: [{ id: 'manual-la-3', type: 'note', text: 'Av = lambda v' }],
        canvasSteps: [{ stepIndex: 0, label: 'Characteristic equation' }],
        preferences: { drawColor: '#10b981' }
      });
    expect(c3Res.status).toBe(200);
    const c3Id = c3Res.body._id;

    await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(c3Id),
      userId: new mongoose.Types.ObjectId(userId),
      role: 'user',
      content: 'What is the geometric meaning of eigenvectors?'
    });
    await ChatMessage.create({
      sessionId: new mongoose.Types.ObjectId(c3Id),
      userId: new mongoose.Types.ObjectId(userId),
      role: 'assistant',
      content: 'Directions along which a linear transformation acts by simple scaling.'
    });

    const a3Res = await request(app)
      .post('/api/artifact/save')
      .set(authHeaders)
      .send({
        sessionId: c3Id,
        title: 'Eigen Transformation Code',
        type: 'code',
        language: 'python',
        content: 'import numpy as np; vals, vecs = np.linalg.eig(A)'
      });
    expect(a3Res.status).toBe(201);
    const a3Id = a3Res.body.id;

    // ── 5. REFRESH SIMULATION FOR AUTHENTICATED USER ──
    const refreshAuthList = await request(app)
      .get('/api/sessions')
      .set(authHeaders);
    expect(refreshAuthList.status).toBe(200);
    expect(refreshAuthList.body.sessions).toHaveLength(3);

    const authReturnedIds = refreshAuthList.body.sessions.map((s: any) => s._id);
    expect(authReturnedIds).toContain(c1Id);
    expect(authReturnedIds).toContain(c2Id);
    expect(authReturnedIds).toContain(c3Id);

    // ── 6. REOPEN IN DIFFERENT ORDER (3, 1, 2) ──
    const restoreAuth3 = await request(app).get(`/api/sessions/${c3Id}`).set(authHeaders);
    expect(restoreAuth3.status).toBe(200);
    expect(restoreAuth3.body.title).toBe('Linear Algebra: Eigenvalues');
    expect(restoreAuth3.body.messages).toHaveLength(2);
    expect(restoreAuth3.body.messages[0].content).toContain('geometric meaning of eigenvectors');
    expect(restoreAuth3.body.canvasState[0].id).toBe('manual-la-3');
    expect(restoreAuth3.body.artifacts[0].title).toBe('Eigen Transformation Code');

    const restoreAuth1 = await request(app).get(`/api/sessions/${c1Id}`).set(authHeaders);
    expect(restoreAuth1.status).toBe(200);
    expect(restoreAuth1.body.title).toBe('ML: Gradient Descent');
    expect(restoreAuth1.body.messages).toHaveLength(2);
    expect(restoreAuth1.body.messages[0].content).toContain('learning rate');
    expect(restoreAuth1.body.canvasState[0].id).toBe('manual-ml-1');
    expect(restoreAuth1.body.artifacts[0].title).toBe('Gradient Descent Plot');

    const restoreAuth2 = await request(app).get(`/api/sessions/${c2Id}`).set(authHeaders);
    expect(restoreAuth2.status).toBe(200);
    expect(restoreAuth2.body.title).toBe('OS: Deadlocks');
    expect(restoreAuth2.body.messages).toHaveLength(2);
    expect(restoreAuth2.body.messages[0].content).toContain('Coffman conditions');
    expect(restoreAuth2.body.canvasState[0].id).toBe('manual-os-2');
    expect(restoreAuth2.body.artifacts[0].title).toBe('Resource Allocation Graph');

    // ── 7. MODIFY ARTIFACT 2 AND VERIFY ISOLATION ──
    const updateAuthArt2 = await request(app)
      .put(`/api/artifact/${a2Id}`)
      .set(authHeaders)
      .send({
        title: 'Resource Allocation Graph (Updated)',
        content: 'graph LR; P1-->R1; R1-->P2; P2-->R2; R2-->P1;'
      });
    expect(updateAuthArt2.status).toBe(200);
    expect(updateAuthArt2.body.version).toBe(2);

    // Verify other conversations unaffected
    const checkAuth1 = await request(app).get(`/api/sessions/${c1Id}`).set(authHeaders);
    expect(checkAuth1.body.artifacts[0].title).toBe('Gradient Descent Plot');
    expect(checkAuth1.body.artifacts[0].version).toBe(1);

    const checkAuth3 = await request(app).get(`/api/sessions/${c3Id}`).set(authHeaders);
    expect(checkAuth3.body.artifacts[0].title).toBe('Eigen Transformation Code');
    expect(checkAuth3.body.artifacts[0].version).toBe(1);

    // ── 8. DELETE CONVERSATION 1 AND VERIFY 2 & 3 INTACT ──
    const delAuth1 = await request(app).delete(`/api/sessions/${c1Id}`).set(authHeaders);
    expect(delAuth1.status).toBe(200);

    const afterDelAuthList = await request(app).get('/api/sessions').set(authHeaders);
    expect(afterDelAuthList.body.sessions).toHaveLength(2);
    const remainingAuthIds = afterDelAuthList.body.sessions.map((s: any) => s._id);
    expect(remainingAuthIds).not.toContain(c1Id);
    expect(remainingAuthIds).toContain(c2Id);
    expect(remainingAuthIds).toContain(c3Id);

    // Conversations 2 and 3 remain fully intact
    const verifyAuth2 = await request(app).get(`/api/sessions/${c2Id}`).set(authHeaders);
    expect(verifyAuth2.status).toBe(200);
    expect(verifyAuth2.body.messages).toHaveLength(2);
    expect(verifyAuth2.body.canvasState[0].id).toBe('manual-os-2');

    const verifyAuth3 = await request(app).get(`/api/sessions/${c3Id}`).set(authHeaders);
    expect(verifyAuth3.status).toBe(200);
    expect(verifyAuth3.body.messages).toHaveLength(2);
    expect(verifyAuth3.body.canvasState[0].id).toBe('manual-la-3');
  });
});

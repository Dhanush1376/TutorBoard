import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Artifact from '../models/Artifact.js';
import SessionLedger from '../models/SessionLedger.js';
import tokenStore from '../utils/auth/tokenStore.js';
import { 
  getSessions, 
  getSession, 
  saveSession, 
  deleteSession,
  getSessionMessages,
  claimLegacySession
} from '../controllers/session.controller.js';
import {
  saveArtifact,
  getArtifact,
  getSessionArtifacts,
  deleteArtifact,
  updateArtifact
} from '../controllers/artifact.controller.js';
import { 
  generateGuestToken, 
  verifyGuestToken, 
  extractGuestToken 
} from '../utils/auth/guestToken.js';

// Helper to simulate Express req/res cycle for controller handlers
const createMockReqRes = (reqOverrides: any = {}) => {
  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, string> = {};
  const cookies: Record<string, any> = {};

  const req: any = {
    params: {},
    query: {},
    body: {},
    headers: {},
    cookies: {},
    user: null,
    guestId: null,
    isGuest: false,
    ...reqOverrides,
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    send(data: any) {
      responseData = data;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    cookie(name: string, val: any, opts: any) {
      cookies[name] = { val, opts };
      return res;
    },
    end() {
      return res;
    }
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers,
    getCookies: () => cookies,
  };
};

describe('TutorBoard Persistence & Canvas Isolation Suite', () => {

  describe('1. Cryptographic Guest Token Architecture', () => {
    it('generates a valid signed guest JWT token with guestId prefix', async () => {
      const { guestId, token } = generateGuestToken();
      expect(guestId).toMatch(/^gst_[0-9a-f-]+/);
      expect(typeof token).toBe('string');

      const verifiedId = await verifyGuestToken(token);
      expect(verifiedId).toBe(guestId);
    });

    it('rejects tampered or malformed guest tokens', async () => {
      const { token } = generateGuestToken();
      const tampered = token.slice(0, -5) + 'abcde';
      expect(await verifyGuestToken(tampered)).toBeNull();
      expect(await verifyGuestToken('')).toBeNull();
      expect(await verifyGuestToken('invalid.token.here')).toBeNull();
    });

    it('rejects revoked guest tokens via tokenStore', async () => {
      const { guestId, token } = generateGuestToken();
      const decoded: any = jwt.decode(token);
      expect(decoded?.jti).toBeDefined();

      // Token is valid before revocation
      expect(await verifyGuestToken(token)).toBe(guestId);

      // Revoke token globally
      await tokenStore.revokeToken(decoded.jti, decoded.exp);

      // Verify it is now strictly rejected
      expect(await verifyGuestToken(token)).toBeNull();
    });

    it('never treats a client-provided raw guest ID as proof of identity', async () => {
      const rawGuestId = `gst_${new mongoose.Types.ObjectId()}`;
      // Raw string is not a valid signed JWT
      expect(await verifyGuestToken(rawGuestId)).toBeNull();
    });

    it('rejects guest tokens with invalid token type or invalid algorithms', async () => {
      const jwtSecret = process.env.JWT_SECRET || 'test-secret';
      
      // Token signed with wrong type
      const wrongTypeToken = jwt.sign({ guestId: 'gst_fake', type: 'user' }, jwtSecret, { algorithm: 'HS256' });
      expect(await verifyGuestToken(wrongTypeToken)).toBeNull();

      // Token signed with wrong secret
      const wrongSecretToken = jwt.sign({ guestId: 'gst_fake', type: 'guest' }, 'wrong-secret', { algorithm: 'HS256' });
      expect(await verifyGuestToken(wrongSecretToken)).toBeNull();

      // Token signed without gst_ prefix
      const invalidPrefixToken = jwt.sign({ guestId: 'admin_user', type: 'guest' }, jwtSecret, { algorithm: 'HS256' });
      expect(await verifyGuestToken(invalidPrefixToken)).toBeNull();
    });

    it('extracts guest token correctly from cookies or headers, ignoring raw guest ID', () => {
      const { token } = generateGuestToken();
      
      const reqFromCookie = { cookies: { 'tb-guest-token': token } };
      expect(extractGuestToken(reqFromCookie)).toBe(token);

      const reqFromHeader = { headers: { 'x-guest-token': token } };
      expect(extractGuestToken(reqFromHeader)).toBe(token);

      // Raw ID header is not extracted
      const reqFromRawId = { headers: { 'x-guest-id': 'gst_raw_id_attempt' } };
      expect(extractGuestToken(reqFromRawId)).toBeNull();
    });
  });

  describe('2. Guest Session Creation, Recovery & Cross-Guest Isolation', () => {
    it('allows guest to create and recover their own session', async () => {
      const guestA = `gst_${new mongoose.Types.ObjectId()}`;
      
      const saveCtx = createMockReqRes({
        guestId: guestA,
        isGuest: true,
        body: {
          title: 'Guest A Physics Session',
          canvasState: [{ id: 'shape-1', type: 'circle', x: 100, y: 150 }],
          canvasSteps: [{ step: 1, action: 'draw-circle' }],
          canvasVersion: 1,
          preferences: { drawColor: '#ff0000', drawWidth: 4 }
        }
      });

      await saveSession(saveCtx.req, saveCtx.res);
      expect(saveCtx.getStatus()).toBe(200);
      const saved = saveCtx.getData();
      expect(saved._id).toBeDefined();
      expect(saved.guestId).toBe(guestA);

      // Verify recovery
      const getCtx = createMockReqRes({
        guestId: guestA,
        isGuest: true,
        params: { id: saved._id.toString() }
      });

      await getSession(getCtx.req, getCtx.res);
      expect(getCtx.getStatus()).toBe(200);
      const fetched = getCtx.getData();
      expect(fetched.title).toBe('Guest A Physics Session');
      expect(fetched.canvasState).toHaveLength(1);
      expect(fetched.canvasState[0].id).toBe('shape-1');
      expect(fetched.canvasSteps).toHaveLength(1);
    });

    it('strictly isolates sessions between different guests (Guest A vs Guest B)', async () => {
      const guestA = `gst_aaa_${Date.now()}`;
      const guestB = `gst_bbb_${Date.now()}`;

      // Guest A creates session A
      const sessionA = await ChatSession.create({
        guestId: guestA,
        userId: null,
        title: "Guest A Secret Algebra",
        canvasState: [{ id: 'a-obj-1' }]
      });

      // Guest B creates session B
      const sessionB = await ChatSession.create({
        guestId: guestB,
        userId: null,
        title: "Guest B Chemistry Lab",
        canvasState: [{ id: 'b-obj-1' }]
      });

      // Guest A lists sessions -> must only see Session A
      const listA = createMockReqRes({ guestId: guestA, isGuest: true });
      await getSessions(listA.req, listA.res);
      expect(listA.getStatus()).toBe(200);
      const listAData = listA.getData();
      expect(listAData.sessions).toHaveLength(1);
      expect(listAData.sessions[0]._id.toString()).toBe(sessionA._id.toString());

      // Guest B lists sessions -> must only see Session B
      const listB = createMockReqRes({ guestId: guestB, isGuest: true });
      await getSessions(listB.req, listB.res);
      expect(listB.getStatus()).toBe(200);
      const listBData = listB.getData();
      expect(listBData.sessions).toHaveLength(1);
      expect(listBData.sessions[0]._id.toString()).toBe(sessionB._id.toString());

      // Cross-access: Guest A requests Session B -> MUST return 404
      const crossFetch = createMockReqRes({
        guestId: guestA,
        isGuest: true,
        params: { id: sessionB._id.toString() }
      });
      await getSession(crossFetch.req, crossFetch.res);
      expect(crossFetch.getStatus()).toBe(404);

      // Cross-save: Guest A tries to overwrite Session B -> MUST return 404
      const crossSave = createMockReqRes({
        guestId: guestA,
        isGuest: true,
        body: {
          sessionId: sessionB._id.toString(),
          title: 'Hacked by Guest A'
        }
      });
      await saveSession(crossSave.req, crossSave.res);
      expect(crossSave.getStatus()).toBe(404);
      
      // Verify Session B was NOT modified
      const originalB = await ChatSession.findById(sessionB._id);
      expect(originalB.title).toBe("Guest B Chemistry Lab");
    });
  });

  describe('3. Registered User vs Guest Isolation', () => {
    it('prevents registered users from accessing guest sessions and vice versa', async () => {
      const regUser = { _id: new mongoose.Types.ObjectId(), id: '' };
      regUser.id = regUser._id.toString();
      const guest = `gst_xyz_${Date.now()}`;

      // User session
      const userSession = await ChatSession.create({
        userId: regUser._id,
        title: "User Private Calculus",
        canvasState: [{ id: 'user-formula' }]
      });

      // Guest session
      const guestSession = await ChatSession.create({
        guestId: guest,
        userId: null,
        title: "Guest Geometry",
        canvasState: [{ id: 'guest-triangle' }]
      });

      // Registered user attempts to read Guest session -> 404
      const userTriesGuest = createMockReqRes({
        user: regUser,
        isGuest: false,
        params: { id: guestSession._id.toString() }
      });
      await getSession(userTriesGuest.req, userTriesGuest.res);
      expect(userTriesGuest.getStatus()).toBe(404);

      // Guest attempts to read Registered user session -> 404
      const guestTriesUser = createMockReqRes({
        guestId: guest,
        isGuest: true,
        params: { id: userSession._id.toString() }
      });
      await getSession(guestTriesUser.req, guestTriesUser.res);
      expect(guestTriesUser.getStatus()).toBe(404);
    });
  });

  describe('4. Message Persistence & Restoration from ChatMessage Collection', () => {
    it('restores user and assistant messages in correct chronological order', async () => {
      const guestId = `gst_msg_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        userId: null,
        title: "Message Persistence Test"
      });

      const now = Date.now();
      await ChatMessage.create([
        {
          sessionId: session._id,
          guestId,
          role: 'user',
          content: 'What is Newton second law?',
          timestamp: new Date(now - 10000)
        },
        {
          sessionId: session._id,
          guestId,
          role: 'assistant',
          content: 'F = ma. Force equals mass times acceleration.',
          timestamp: new Date(now - 8000),
          metadata: { versions: [{ text: 'F = ma' }] }
        },
        {
          sessionId: session._id,
          guestId,
          role: 'user',
          content: 'Can you show an example?',
          timestamp: new Date(now - 5000)
        },
        {
          sessionId: session._id,
          guestId,
          role: 'assistant',
          content: 'For a 2kg mass accelerated at 3 m/s^2, F = 6N.',
          timestamp: new Date(now - 2000)
        }
      ]);

      const fetchCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });

      await getSession(fetchCtx.req, fetchCtx.res);
      expect(fetchCtx.getStatus()).toBe(200);
      const data = fetchCtx.getData();

      expect(data.messages).toHaveLength(4);
      expect(data.messages[0].role).toBe('user');
      expect(data.messages[0].content).toBe('What is Newton second law?');
      expect(data.messages[1].role).toBe('assistant');
      expect(data.messages[1].content).toBe('F = ma. Force equals mass times acceleration.');
      expect(data.messages[2].role).toBe('user');
      expect(data.messages[3].role).toBe('assistant');
      expect(data.messages[3].content).toContain('F = 6N');
    });
  });

  describe('5. Canvas State & Artifact Persistence and Isolation', () => {
    it('persists and restores canvas state snapshots alongside artifacts', async () => {
      const guestId = `gst_art_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        userId: null,
        title: "Canvas & Artifact Test"
      });

      // Create an artifact for this session
      const artCtx = createMockReqRes({
        guestId,
        isGuest: true,
        body: {
          sessionId: session._id.toString(),
          title: 'Quadratic Equation Graph',
          type: 'visual',
          content: 'y = x^2 - 4x + 3',
          language: 'desmos',
          metadata: { scale: 1.5 }
        }
      });

      await saveArtifact(artCtx.req, artCtx.res);
      expect(artCtx.getStatus()).toBe(201);
      const createdArt = artCtx.getData();
      expect(createdArt.id).toBeDefined();
      expect(createdArt.sessionId).toBe(session._id.toString());

      // Get session includes the artifact
      const sessCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });

      await getSession(sessCtx.req, sessCtx.res);
      expect(sessCtx.getStatus()).toBe(200);
      const sessionData = sessCtx.getData();
      expect(sessionData.artifacts).toBeDefined();
      expect(sessionData.artifacts).toHaveLength(1);
      expect(sessionData.artifacts[0].title).toBe('Quadratic Equation Graph');
    });

    it('isolates artifacts across distinct sessions (Session 1 vs Session 2 vs Session 3)', async () => {
      const guestId = `gst_multi_${Date.now()}`;
      
      const session1 = await ChatSession.create({ guestId, title: "Session 1" });
      const session2 = await ChatSession.create({ guestId, title: "Session 2" });
      const session3 = await ChatSession.create({ guestId, title: "Session 3" });

      // Create artifacts in session 1 and 2
      await Artifact.create({
        sessionId: session1._id.toString(),
        guestId,
        title: "Artifact in Session 1",
        type: "code",
        content: "console.log(1);"
      });

      await Artifact.create({
        sessionId: session2._id.toString(),
        guestId,
        title: "Artifact in Session 2",
        type: "diagram",
        content: "graph TD; A-->B;"
      });

      // Get artifacts for Session 1 -> only 1 artifact
      const getArt1 = createMockReqRes({
        guestId,
        isGuest: true,
        params: { sessionId: session1._id.toString() }
      });
      await getSessionArtifacts(getArt1.req, getArt1.res);
      expect(getArt1.getStatus()).toBe(200);
      expect(getArt1.getData().artifacts).toHaveLength(1);
      expect(getArt1.getData().artifacts[0].title).toBe("Artifact in Session 1");

      // Get artifacts for Session 2 -> only 1 artifact
      const getArt2 = createMockReqRes({
        guestId,
        isGuest: true,
        params: { sessionId: session2._id.toString() }
      });
      await getSessionArtifacts(getArt2.req, getArt2.res);
      expect(getArt2.getStatus()).toBe(200);
      expect(getArt2.getData().artifacts).toHaveLength(1);
      expect(getArt2.getData().artifacts[0].title).toBe("Artifact in Session 2");

      // Get artifacts for Session 3 -> 0 artifacts
      const getArt3 = createMockReqRes({
        guestId,
        isGuest: true,
        params: { sessionId: session3._id.toString() }
      });
      await getSessionArtifacts(getArt3.req, getArt3.res);
      expect(getArt3.getStatus()).toBe(200);
      expect(getArt3.getData().artifacts).toHaveLength(0);
    });

    it('rejects unauthorized artifact access from other users or guests', async () => {
      const ownerGuest = `gst_owner_${Date.now()}`;
      const attackerGuest = `gst_attacker_${Date.now()}`;

      const session = await ChatSession.create({
        guestId: ownerGuest,
        title: "Owner Session"
      });

      const artifact = await Artifact.create({
        sessionId: session._id,
        guestId: ownerGuest,
        title: "Top Secret Formula",
        type: "code",
        content: "SECRET"
      });

      // Attacker guest attempts to read owner's artifact -> 403 Forbidden
      const stealArt = createMockReqRes({
        guestId: attackerGuest,
        isGuest: true,
        params: { id: artifact._id.toString() }
      });
      await getArtifact(stealArt.req, stealArt.res);
      expect(stealArt.getStatus()).toBe(403);

      // Attacker guest attempts to update owner's artifact -> 403 Forbidden
      const updateArt = createMockReqRes({
        guestId: attackerGuest,
        isGuest: true,
        params: { id: artifact._id.toString() },
        body: { content: "TAMPERED" }
      });
      await updateArtifact(updateArt.req, updateArt.res);
      expect(updateArt.getStatus()).toBe(403);

      // Attacker guest attempts to delete owner's artifact -> 403 Forbidden
      const delArt = createMockReqRes({
        guestId: attackerGuest,
        isGuest: true,
        params: { id: artifact._id.toString() }
      });
      await deleteArtifact(delArt.req, delArt.res);
      expect(delArt.getStatus()).toBe(403);

      // Attacker guest attempts to inject artifact into owner's session -> 403 Forbidden
      const injectArt = createMockReqRes({
        guestId: attackerGuest,
        isGuest: true,
        body: {
          sessionId: session._id.toString(),
          title: "Malicious Artifact",
          type: "code",
          content: "hax"
        }
      });
      await saveArtifact(injectArt.req, injectArt.res);
      expect(injectArt.getStatus()).toBe(403);
    });
  });

  describe('6. Cascading Deletion of Session, Messages & Artifacts', () => {
    it('cascades deletion across ChatSession, ChatMessage, Artifact and SessionLedger', async () => {
      const guestId = `gst_cascade_${Date.now()}`;
      
      const session = await ChatSession.create({
        guestId,
        title: "Session To Delete"
      });

      // Create associated messages
      await ChatMessage.create([
        { sessionId: session._id, guestId, role: 'user', content: 'hello' },
        { sessionId: session._id, guestId, role: 'assistant', content: 'hi' }
      ]);

      // Create associated artifacts
      await Artifact.create({
        sessionId: session._id.toString(),
        guestId,
        title: "Doomed Artifact",
        type: "code",
        content: "var x = 1;"
      });

      // Create associated session ledger entry
      await SessionLedger.create({
        sessionId: session._id,
        requestId: `req-unique-${Date.now()}`,
        status: 'completed',
        attempts: 1,
        response: 'done'
      });

      // Verify records exist
      expect(await ChatMessage.countDocuments({ sessionId: session._id })).toBe(2);
      expect(await Artifact.countDocuments({ sessionId: session._id.toString(), isDeleted: false })).toBe(1);
      expect(await SessionLedger.countDocuments({ sessionId: session._id })).toBe(1);

      // Execute session deletion
      const delCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });

      await deleteSession(delCtx.req, delCtx.res);
      expect(delCtx.getStatus()).toBe(200);

      // Verify session is deleted from database
      const postSession = await ChatSession.findById(session._id);
      expect(postSession).toBeNull();

      // Verify cascading deletion of messages
      const postMessages = await ChatMessage.countDocuments({ sessionId: session._id });
      expect(postMessages).toBe(0);

      // Verify cascading deletion of artifacts
      const postArtifacts = await Artifact.countDocuments({ sessionId: session._id.toString(), isDeleted: false });
      expect(postArtifacts).toBe(0);

      // Verify cascading cleanup of session ledger
      const postLedger = await SessionLedger.countDocuments({ sessionId: session._id });
      expect(postLedger).toBe(0);
    });

    it('failure injection: preserves parent session with purge_failed state when deleting messages fails', async () => {
      const guestId = `gst_msg_fail_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "Failure Injection Messages Session"
      });

      await ChatMessage.create({ sessionId: session._id, guestId, role: 'user', content: 'test msg' });

      // Inject failure on ChatMessage.deleteMany
      const deleteManySpy = vi.spyOn(ChatMessage, 'deleteMany').mockRejectedValueOnce(new Error('Disk write error deleting messages'));

      const delCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });

      await deleteSession(delCtx.req, delCtx.res);
      expect(delCtx.getStatus()).toBe(500);

      // Parent session MUST NOT be permanently deleted when child cleanup fails
      const preservedSession = await ChatSession.findById(session._id);
      expect(preservedSession).not.toBeNull();
      expect(preservedSession.isDeleted).toBe(true);
      expect(preservedSession.deletionState).toBe('purge_failed');
      expect(preservedSession.deletionError).toContain('messages');

      deleteManySpy.mockRestore();
    });

    it('failure injection: preserves parent session when deleting artifacts fails', async () => {
      const guestId = `gst_art_fail_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "Failure Injection Artifact Session"
      });

      await Artifact.create({
        sessionId: session._id.toString(),
        guestId,
        title: "Sticky Artifact",
        type: "code",
        content: "const a = 1;"
      });

      const artifactSpy = vi.spyOn(Artifact, 'deleteMany').mockRejectedValueOnce(new Error('S3 artifact store network error'));

      const delCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });

      await deleteSession(delCtx.req, delCtx.res);
      expect(delCtx.getStatus()).toBe(500);

      const preservedSession = await ChatSession.findById(session._id);
      expect(preservedSession).not.toBeNull();
      expect(preservedSession.deletionState).toBe('purge_failed');
      expect(preservedSession.deletionError).toContain('artifacts');

      artifactSpy.mockRestore();
    });

    it('failure injection: preserves parent session when deleting ledger fails', async () => {
      const guestId = `gst_led_fail_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "Failure Injection Ledger Session"
      });

      await SessionLedger.create({
        sessionId: session._id,
        requestId: `req-fail-${Date.now()}`,
        status: 'completed',
        attempts: 1
      });

      const ledgerSpy = vi.spyOn(SessionLedger, 'deleteMany').mockRejectedValueOnce(new Error('Ledger collection locked'));

      const delCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });

      await deleteSession(delCtx.req, delCtx.res);
      expect(delCtx.getStatus()).toBe(500);

      const preservedSession = await ChatSession.findById(session._id);
      expect(preservedSession).not.toBeNull();
      expect(preservedSession.deletionState).toBe('purge_failed');
      expect(preservedSession.deletionError).toContain('ledger');

      ledgerSpy.mockRestore();
    });

    it('allows idempotent retry after partial cleanup failure to complete cascading deletion', async () => {
      const guestId = `gst_retry_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "Retry Partial Cleanup Session"
      });

      await ChatMessage.create({ sessionId: session._id, guestId, role: 'user', content: 'surviving msg' });

      // First attempt fails due to simulated glitch
      const glitchSpy = vi.spyOn(ChatMessage, 'deleteMany').mockRejectedValueOnce(new Error('Transient failure'));

      const failCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });
      await deleteSession(failCtx.req, failCtx.res);
      expect(failCtx.getStatus()).toBe(500);
      glitchSpy.mockRestore();

      // Retry attempt succeeds
      const retryCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });
      await deleteSession(retryCtx.req, retryCtx.res);
      expect(retryCtx.getStatus()).toBe(200);

      // Verify complete purge
      expect(await ChatSession.findById(session._id)).toBeNull();
      expect(await ChatMessage.countDocuments({ sessionId: session._id })).toBe(0);
    });

    it('returns 404 for repeated deletion requests on already deleted session', async () => {
      const guestId = `gst_rep_${Date.now()}`;
      const session = await ChatSession.create({ guestId, title: "Deleted Once" });

      const delCtx1 = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });
      await deleteSession(delCtx1.req, delCtx1.res);
      expect(delCtx1.getStatus()).toBe(200);

      // Second deletion attempt
      const delCtx2 = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });
      await deleteSession(delCtx2.req, delCtx2.res);
      expect(delCtx2.getStatus()).toBe(404);
    });

    it('blocks concurrent access during deletion (returns 404 once purging)', async () => {
      const guestId = `gst_conc_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "Session Under Deletion",
        isDeleted: true,
        deletionState: 'purging'
      });

      const getCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() }
      });
      await getSession(getCtx.req, getCtx.res);
      expect(getCtx.getStatus()).toBe(404);
    });

    it('ensures deletion never affects unrelated conversations or other guests', async () => {
      const guestA = `gst_safe_a_${Date.now()}`;
      const guestB = `gst_safe_b_${Date.now()}`;

      const sessionA = await ChatSession.create({ guestId: guestA, title: "Session A" });
      const sessionB = await ChatSession.create({ guestId: guestB, title: "Session B" });

      await ChatMessage.create([
        { sessionId: sessionA._id, guestId: guestA, role: 'user', content: 'A message' },
        { sessionId: sessionB._id, guestId: guestB, role: 'user', content: 'B message' }
      ]);

      // Delete session A
      const delCtx = createMockReqRes({
        guestId: guestA,
        isGuest: true,
        params: { id: sessionA._id.toString() }
      });
      await deleteSession(delCtx.req, delCtx.res);
      expect(delCtx.getStatus()).toBe(200);

      // Verify Session B is 100% intact
      const checkB = await ChatSession.findById(sessionB._id);
      expect(checkB).not.toBeNull();
      expect(checkB.title).toBe("Session B");

      const msgsB = await ChatMessage.find({ sessionId: sessionB._id });
      expect(msgsB).toHaveLength(1);
      expect(msgsB[0].content).toBe('B message');
    });
  });

  describe('7. Request Ledger & Idempotency Protection', () => {
    it('records request ledger entries and enforces idempotency constraint', async () => {
      const sessionId = new mongoose.Types.ObjectId();
      const requestId = `req-dedup-${Date.now()}`;

      // First ledger entry
      const ledgerEntry1 = await SessionLedger.create({
        sessionId,
        requestId,
        status: 'requesting',
        attempts: 1
      });
      expect(ledgerEntry1._id).toBeDefined();

      // Duplicate insertion with the same sessionId + requestId should violate unique index
      let duplicateError: any = null;
      try {
        await SessionLedger.create({
          sessionId,
          requestId,
          status: 'requesting',
          attempts: 2
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).not.toBeNull();
      expect(duplicateError.code).toBe(11000); // MongoDB duplicate key error code
    });
  });

  describe('8. Safe Legacy Guest Session Migration / Adoption', () => {
    it('allows legitimate owner with proof of possession (first message) to recover legacy session', async () => {
      const guestId = `gst_legit_owner_${Date.now()}`;

      // Create an unowned legacy session
      const legacySession = await ChatSession.create({
        userId: null,
        guestId: null,
        title: "Calculus Fundamentals",
        canvasState: [{ id: 'curve-1', type: 'integral' }]
      });

      // Create initial message
      await ChatMessage.create({
        sessionId: legacySession._id,
        userId: null,
        guestId: null,
        role: 'user',
        content: 'Explain integration by parts'
      });

      await Artifact.create({
        sessionId: legacySession._id.toString(),
        userId: null,
        guestId: null,
        title: "Integration Table",
        type: "code",
        content: "formula"
      });

      // Legitimate owner claims with proof of possession (matching first user message)
      const claimCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: legacySession._id.toString() },
        body: {
          proof: { firstMessage: 'Explain integration by parts' }
        }
      });

      await claimLegacySession(claimCtx.req, claimCtx.res);
      expect(claimCtx.getStatus()).toBe(200);

      // Verify ownership transferred to legitimate owner
      const adopted = await ChatSession.findById(legacySession._id);
      expect(adopted.guestId).toBe(guestId);

      const updatedMsg = await ChatMessage.findOne({ sessionId: legacySession._id });
      expect(updatedMsg.guestId).toBe(guestId);

      const updatedArt = await Artifact.findOne({ sessionId: legacySession._id.toString() });
      expect(updatedArt.guestId).toBe(guestId);
    });

    it('allows legitimate owner with proof of possession (recovery token) to recover legacy session', async () => {
      const guestId = `gst_token_owner_${Date.now()}`;

      const legacySession = await ChatSession.create({
        userId: null,
        guestId: null,
        legacyRecoveryToken: 'rec_secret_abc123',
        title: "Linear Algebra"
      });

      const claimCtx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: legacySession._id.toString() },
        body: {
          proof: { recoveryToken: 'rec_secret_abc123' }
        }
      });

      await claimLegacySession(claimCtx.req, claimCtx.res);
      expect(claimCtx.getStatus()).toBe(200);

      const adopted = await ChatSession.findById(legacySession._id);
      expect(adopted.guestId).toBe(guestId);
    });

    it('rejects unowned session guessing or enumeration without proof of possession', async () => {
      const intruderGuest = `gst_scanner_${Date.now()}`;

      const legacySession = await ChatSession.create({
        userId: null,
        guestId: null,
        title: "Private Medical Discussion"
      });

      // 1. Merely guessing/calling getSession returns 404 and does NOT adopt
      const getCtx = createMockReqRes({
        guestId: intruderGuest,
        isGuest: true,
        params: { id: legacySession._id.toString() }
      });

      await getSession(getCtx.req, getCtx.res);
      expect(getCtx.getStatus()).toBe(404);

      // 2. Calling claim-legacy without proof returns 403
      const claimCtx = createMockReqRes({
        guestId: intruderGuest,
        isGuest: true,
        params: { id: legacySession._id.toString() },
        body: {} // No proof provided
      });

      await claimLegacySession(claimCtx.req, claimCtx.res);
      expect(claimCtx.getStatus()).toBe(403);
      expect(claimCtx.getData().code).toBe('PROOF_OF_POSSESSION_FAILED');

      // Verify session remains unowned and preserved
      const preserved = await ChatSession.findById(legacySession._id);
      expect(preserved.guestId).toBeNull();
    });

    it('rejects unrelated guest attempting adoption with incorrect proof', async () => {
      const unrelatedGuest = `gst_imposter_${Date.now()}`;

      const legacySession = await ChatSession.create({
        userId: null,
        guestId: null,
        title: "Quantum Mechanics"
      });

      await ChatMessage.create({
        sessionId: legacySession._id,
        role: 'user',
        content: 'Explain Schrödinger wave equation'
      });

      const claimCtx = createMockReqRes({
        guestId: unrelatedGuest,
        isGuest: true,
        params: { id: legacySession._id.toString() },
        body: {
          proof: { firstMessage: 'I am guessing it was about physics' }
        }
      });

      await claimLegacySession(claimCtx.req, claimCtx.res);
      expect(claimCtx.getStatus()).toBe(403);

      const unchanged = await ChatSession.findById(legacySession._id);
      expect(unchanged.guestId).toBeNull();
    });

    it('prevents concurrent adoption attempts from transferring ownership twice', async () => {
      const claimant1 = `gst_race_1_${Date.now()}`;
      const claimant2 = `gst_race_2_${Date.now()}`;

      const legacySession = await ChatSession.create({
        userId: null,
        guestId: null,
        title: "Concurrent Target"
      });

      await ChatMessage.create({
        sessionId: legacySession._id,
        role: 'user',
        content: 'Solve x^2 = 4'
      });

      const ctx1 = createMockReqRes({
        guestId: claimant1,
        isGuest: true,
        params: { id: legacySession._id.toString() },
        body: { proof: { firstMessage: 'Solve x^2 = 4' } }
      });

      const ctx2 = createMockReqRes({
        guestId: claimant2,
        isGuest: true,
        params: { id: legacySession._id.toString() },
        body: { proof: { firstMessage: 'Solve x^2 = 4' } }
      });

      // Execute concurrently
      await Promise.all([
        claimLegacySession(ctx1.req, ctx1.res),
        claimLegacySession(ctx2.req, ctx2.res)
      ]);

      const statuses = [ctx1.getStatus(), ctx2.getStatus()].sort();
      // Exactly one must succeed (200) and the other must be rejected (409 Conflict)
      expect(statuses).toEqual([200, 409]);
    });

    it('strictly rejects adopting registered-user sessions as guest sessions', async () => {
      const intruderGuest = `gst_account_hacker_${Date.now()}`;
      const registeredUserId = new mongoose.Types.ObjectId();

      const userSession = await ChatSession.create({
        userId: registeredUserId,
        title: "Paid Subscriber Private Session"
      });

      const claimCtx = createMockReqRes({
        guestId: intruderGuest,
        isGuest: true,
        params: { id: userSession._id.toString() },
        body: { proof: { firstMessage: 'anything' } }
      });

      await claimLegacySession(claimCtx.req, claimCtx.res);
      expect(claimCtx.getStatus()).toBe(403);
      expect(claimCtx.getData().code).toBe('CANNOT_ADOPT_USER_SESSION');
    });
  });

  describe('9. Complete History & Compound Cursor Pagination', () => {
    it('supports compound cursor pagination over >200 messages without skipping or duplicating', async () => {
      const guestId = `gst_mega_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "210 Messages Conversation"
      });

      const baseTime = Date.now() - 500000;
      const totalMessages = 210;
      const messagesToInsert = Array.from({ length: totalMessages }, (_, i) => ({
        sessionId: session._id,
        guestId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(baseTime + i * 1000)
      }));

      await ChatMessage.insertMany(messagesToInsert);

      // Page 1: limit = 100
      const p1Ctx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() },
        query: { limit: '100' }
      });
      await getSession(p1Ctx.req, p1Ctx.res);
      expect(p1Ctx.getStatus()).toBe(200);
      const p1 = p1Ctx.getData();
      expect(p1.messages).toHaveLength(100);
      expect(p1.pagination.hasMore).toBe(true);
      expect(p1.pagination.nextCursor).toBeDefined();

      // Page 2: limit = 100, using compound nextCursor
      const p2Ctx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() },
        query: { limit: '100', before: p1.pagination.nextCursor }
      });
      await getSession(p2Ctx.req, p2Ctx.res);
      expect(p2Ctx.getStatus()).toBe(200);
      const p2 = p2Ctx.getData();
      expect(p2.messages).toHaveLength(100);
      expect(p2.pagination.hasMore).toBe(true);
      expect(p2.pagination.nextCursor).toBeDefined();

      // Page 3: limit = 100, using compound nextCursor (remaining 10 messages)
      const p3Ctx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() },
        query: { limit: '100', before: p2.pagination.nextCursor }
      });
      await getSession(p3Ctx.req, p3Ctx.res);
      expect(p3Ctx.getStatus()).toBe(200);
      const p3 = p3Ctx.getData();
      expect(p3.messages).toHaveLength(10);
      expect(p3.pagination.hasMore).toBe(false);

      // Verify all 210 messages were collected with ZERO overlap and ZERO dropped messages
      const allContents = [
        ...p3.messages.map(m => m.content),
        ...p2.messages.map(m => m.content),
        ...p1.messages.map(m => m.content)
      ];
      expect(allContents).toHaveLength(totalMessages);
      const uniqueContents = new Set(allContents);
      expect(uniqueContents.size).toBe(totalMessages);
      expect(allContents[0]).toBe('Message 0');
      expect(allContents[totalMessages - 1]).toBe(`Message ${totalMessages - 1}`);
    });

    it('handles multiple messages sharing the exact same timestamp without dropping or duplicating', async () => {
      const guestId = `gst_sametime_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "Exact Same Timestamp Test"
      });

      const fixedTimestamp = new Date('2026-10-23T01:00:00.000Z');
      const messagesToInsert = [
        { sessionId: session._id, guestId, role: 'user', content: 'SameTime 1', timestamp: fixedTimestamp },
        { sessionId: session._id, guestId, role: 'assistant', content: 'SameTime 2', timestamp: fixedTimestamp },
        { sessionId: session._id, guestId, role: 'user', content: 'SameTime 3', timestamp: fixedTimestamp },
        { sessionId: session._id, guestId, role: 'assistant', content: 'SameTime 4', timestamp: fixedTimestamp },
        { sessionId: session._id, guestId, role: 'user', content: 'SameTime 5', timestamp: fixedTimestamp },
      ];

      const inserted = await ChatMessage.insertMany(messagesToInsert);

      // Page 1: limit 2
      const p1Ctx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() },
        query: { limit: '2' }
      });
      await getSessionMessages(p1Ctx.req, p1Ctx.res);
      expect(p1Ctx.getStatus()).toBe(200);
      const p1 = p1Ctx.getData();
      expect(p1.messages).toHaveLength(2);
      expect(p1.pagination.hasMore).toBe(true);
      expect(p1.pagination.nextCursor).toBeDefined();

      // Page 2: limit 2 using nextCursor
      const p2Ctx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() },
        query: { limit: '2', before: p1.pagination.nextCursor }
      });
      await getSessionMessages(p2Ctx.req, p2Ctx.res);
      expect(p2Ctx.getStatus()).toBe(200);
      const p2 = p2Ctx.getData();
      expect(p2.messages).toHaveLength(2);
      expect(p2.pagination.hasMore).toBe(true);

      // Page 3: limit 2 using nextCursor (1 remaining)
      const p3Ctx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() },
        query: { limit: '2', before: p2.pagination.nextCursor }
      });
      await getSessionMessages(p3Ctx.req, p3Ctx.res);
      expect(p3Ctx.getStatus()).toBe(200);
      const p3 = p3Ctx.getData();
      expect(p3.messages).toHaveLength(1);
      expect(p3.pagination.hasMore).toBe(false);

      // Verify all 5 messages retrieved with NO duplicates and NO omissions
      const allIds = [
        ...p1.messages.map(m => m.id),
        ...p2.messages.map(m => m.id),
        ...p3.messages.map(m => m.id)
      ];
      expect(allIds).toHaveLength(5);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(5);
    });

    it('restores canvas state, pinned notes, and preferences independently of message pagination', async () => {
      const guestId = `gst_canvas_ind_${Date.now()}`;
      const session = await ChatSession.create({
        guestId,
        title: "Rich Pedagogical Session",
        canvasState: [{ id: 'shape-1', type: 'circle' }, { id: 'shape-2', type: 'rect' }],
        canvasSteps: [{ step: 1, action: 'circle' }],
        pinnedNotes: [{ id: 'note-1', text: 'Important formula' }],
        preferences: { drawColor: '#00ff00', drawWidth: 5, gridType: 'isometric' }
      });

      // Insert 20 messages
      const msgs = Array.from({ length: 20 }, (_, i) => ({
        sessionId: session._id,
        guestId,
        role: 'user',
        content: `Msg ${i}`
      }));
      await ChatMessage.insertMany(msgs);

      // Request with limit 2 (client only loads top 2 messages)
      const ctx = createMockReqRes({
        guestId,
        isGuest: true,
        params: { id: session._id.toString() },
        query: { limit: '2' }
      });

      await getSession(ctx.req, ctx.res);
      expect(ctx.getStatus()).toBe(200);
      const data = ctx.getData();

      // Messages are limited to 2
      expect(data.messages).toHaveLength(2);

      // But canvasState, canvasSteps, pinnedNotes, and preferences are fully restored!
      expect(data.canvasState).toHaveLength(2);
      expect(data.canvasSteps).toHaveLength(1);
      expect(data.pinnedNotes).toHaveLength(1);
      expect(data.pinnedNotes[0].text).toBe('Important formula');
      expect(data.preferences.drawColor).toBe('#00ff00');
      expect(data.preferences.gridType).toBe('isometric');
    });
  });
});

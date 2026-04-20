import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';
const EMAIL = `sync_proof_${Date.now()}@tutorboard.ai`;
const PASSWORD = 'password123';

async function runTest() {
  console.log(`--- STARTING CROSS-TAB SYNC PROOF ---`);
  console.log(`User: ${EMAIL}`);

  // 1. SIGNUP
  console.log('\n[Action] Signing up...');
  const signupRes = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Sync Prover', email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }),
    headers: { 'Content-Type': 'application/json' }
  });
  const signupData = await signupRes.json();
  const token = signupData.token;
  if (!token) throw new Error('Signup failed: ' + JSON.stringify(signupData));
  console.log('Success: User registered and token received.');

  // 2. CREATE SESSION (Emulating TAB 1)
  console.log('\n[Action] Creating session in TAB 1...');
  const createRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({ 
      title: 'Global Sync Test', 
      messages: [{ role: 'user', content: 'Sync check', timestamp: Date.now() }] 
    }),
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const session = await createRes.json();
  const mongoId = session._id;
  console.log(`Success: Session created with Cloud ID: ${mongoId}`);

  // 3. FETCH HISTORY (Emulating TAB 2)
  console.log('\n[Action] Emulating TAB 2: Fetching history...');
  const historyRes = await fetch(`${API_URL}/api/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const historyData = await historyRes.json();
  const found = historyData.sessions.find(s => s._id === mongoId);
  if (found) {
    console.log(`Success: Tab 2 FOUND the session from Tab 1 in the cloud!`);
  } else {
    throw new Error('Tab 2 failed to find session.');
  }

  // 4. PERFORM ACTIVITY (Emulating TAB 1 Update)
  console.log('\n[Action] Tab 1 drawing on canvas...');
  await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({ 
      sessionId: mongoId,
      canvasState: [{ id: 'line-1', type: 'line', points: [0,0, 10,10] }]
    }),
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  console.log('Success: Tab 1 activity synced to MongoDB.');

  // 5. VERIFY UPDATE (Emulating Tab 2 Refresh)
  console.log('\n[Action] Tab 2 verifying canvas update...');
  const verifyRes = await fetch(`${API_URL}/api/sessions/${mongoId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const verifiedSession = await verifyRes.json();
  if (verifiedSession.canvasState.length > 0) {
    console.log(`Success: Tab 2 SEES the canvas activity from Tab 1!`);
  } else {
    throw new Error('Tab 2 failed to see update.');
  }

  console.log('\n--- VERIFICATION COMPLETE: ALL SYNC TESTS PASSED ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});

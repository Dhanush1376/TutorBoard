import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

async function testSignIn() {
  console.log('Testing Sign In endpoint...');
  try {
    const res = await fetch(`${API_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong-password' })
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (res.status === 401 && data.error === 'Invalid email or password') {
      console.log('Test Passed: Correct error handling for wrong password.');
    } else {
      console.log('Test Failed: Unexpected response.');
    }
  } catch (err) {
    console.error('Test Failed: Connection Error:', err.message);
  }
}

testSignIn();

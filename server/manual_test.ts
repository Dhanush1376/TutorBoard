import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://localhost:3001/api/chat/stream', {
      userMessage: 'Hello',
      mode: 'quick'
    }, {
      responseType: 'stream',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'test' // Server might block this if it doesn't have a secret
      }
    });
    console.log('Response status:', res.status);
    res.data.on('data', (chunk) => {
      console.log('Chunk:', chunk.toString());
    });
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  }
}

test();

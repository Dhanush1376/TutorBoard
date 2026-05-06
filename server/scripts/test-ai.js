import { routeConversationStream } from './ai-router/router/aiRouter.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function test() {
  try {
    const stream = routeConversationStream([{ role: 'user', content: 'Hello!' }]);
    for await (const chunk of stream) {
      process.stdout.write(chunk.chunk);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();

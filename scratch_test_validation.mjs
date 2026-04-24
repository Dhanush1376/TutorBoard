
import { validateApiKey } from './server/utils/validation/apiValidator.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function test() {
  console.log('Testing HuggingFace validation...');
  const result = await validateApiKey('huggingface', process.env.HUGGINGFACE_API_KEY, 'meta-llama/Llama-3-8b-chat-hf');
  console.log('Result:', JSON.stringify(result, null, 2));
}

test();

import dotenv from 'dotenv';
dotenv.config();

import { requestCompletion, getModel } from './utils/ai/llmClient.js';
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      console.log('Sending handleDoubt payload...');
      const response = await requestCompletion({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a test system prompt. Return valid json.' },
          { role: 'user', content: 'Say ok.' }
        ],
        temperature: 0.3,
        maxTokens: 1000,
        responseMimeType: 'application/json',
        taskType: 'doubt',
      });
      console.log('Success:', response.content);
    } catch (e) {
      console.log('Error caught:', e.message);
    }
    process.exit(0);
  });

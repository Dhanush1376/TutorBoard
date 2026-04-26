import dotenv from 'dotenv';
dotenv.config();

import { requestCompletion } from './utils/ai/llmClient.js';
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      console.log('Sending test completion...');
      const res = await requestCompletion({
        model: 'openai/gpt-4o-mini',
        messages: [{role: 'user', content: 'Say test'}],
        taskType: 'test'
      });
      console.log('Success:', res);
    } catch (e) {
      console.log('Error caught:', e.message);
    }
    process.exit(0);
  });

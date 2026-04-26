import dotenv from 'dotenv';
dotenv.config();

import { requestCompletion, getTextModel } from './utils/ai/llmClient.js';
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      console.log('Sending text response completion...');
      const modelId = null;
      const topic = 'General Discussion';
      const prompt = 'Hello';
      const userConfig = null;
      
      const response = await requestCompletion({
        model: modelId || getTextModel(),
        messages: [
          {
            role: 'system',
            content: `You are Tutu, a friendly and helpful AI pedagogical assistant. 
            The current context is: ${topic}. 
            Answer conversationally, be encouraging, and keep it under 3 sentences.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        maxTokens: 500,
        userConfig,
        taskType: 'simple_qa',
      });
      console.log('Success:', response.content);
    } catch (e) {
      console.log('Error caught:', e.message);
    }
    process.exit(0);
  });

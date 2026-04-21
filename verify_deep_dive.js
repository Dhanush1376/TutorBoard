
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ChatSession from './server/models/ChatSession.js';

dotenv.config({ path: './server/.env' });

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const session = await ChatSession.findOne({ title: /Recursion/i }).sort({ lastUpdated: -1 });
  if (!session) {
    console.log('No Recursion session found. Trying to find any session with messages...');
    const anySession = await ChatSession.findOne({ 'messages.0': { $exists: true } }).sort({ lastUpdated: -1 });
    if (anySession) {
      console.log('Found session:', anySession.title);
      console.log('Messages metadata:', anySession.messages.map(m => ({ 
        role: m.role, 
        hasCanvas: m.hasCanvas, 
        snapshot: !!m.canvasSnapshot 
      })));
    } else {
      console.log('No sessions found.');
    }
  } else {
    console.log('Found Recursion session:', session._id);
    console.log('Messages metadata:', session.messages.map(m => ({ 
      role: m.role, 
      hasCanvas: m.hasCanvas, 
      snapshot: !!m.canvasSnapshot 
    })));
  }

  await mongoose.disconnect();
}

verify().catch(console.error);

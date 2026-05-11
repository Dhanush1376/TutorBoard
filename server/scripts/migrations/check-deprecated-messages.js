import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in environment');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const ChatSession = mongoose.model('ChatSession', new mongoose.Schema({
      messages: [mongoose.Schema.Types.Mixed]
    }));

    const sessionsWithMessages = await ChatSession.find({
      messages: { $exists: true, $not: { $size: 0 } }
    });

    console.log(`Found ${sessionsWithMessages.length} sessions with deprecated embedded messages.`);

    if (sessionsWithMessages.length > 0) {
      console.log('Starting migration to clear embedded messages...');
      
      const result = await ChatSession.updateMany(
        { messages: { $exists: true, $not: { $size: 0 } } },
        { $set: { messages: [] } }
      );

      console.log(`Successfully cleared messages for ${result.modifiedCount} sessions.`);
    } else {
      console.log('No sessions found with embedded messages. System is clean.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();

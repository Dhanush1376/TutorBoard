import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorboard';

async function checkDB() {
  try {
    console.log('Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Status:', mongoose.connection.readyState);
    console.log('SUCCESS: DB is reachable ✅');
    process.exit(0);
  } catch (err) {
    console.error('FAILURE: DB is unreachable ❌');
    console.error(err);
    process.exit(1);
  }
}

checkDB();

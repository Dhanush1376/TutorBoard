import mongoose from 'mongoose';
import User from './models/User.js';
import ChatSession from './models/ChatSession.js';
import ActivityLog from './models/ActivityLog.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorboard';

async function verify() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const recentSessions = await ChatSession.find({
      updatedAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) } // Last 60 mins
    }).populate('userId', 'email');

    console.log(`Found ${recentSessions.length} sessions in last 60 mins:`);
    recentSessions.forEach(s => {
      console.log(`- [${s.userId?.email || 'N/A'}] Title: ${s.title} (ID: ${s._id})`);
    });

    const recentActivity = await ActivityLog.find({
      timestamp: { $gt: new Date(Date.now() - 60 * 60 * 1000) }
    });
    console.log(`\nFound ${recentActivity.length} activity logs in last 60 mins.`);

    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

verify();

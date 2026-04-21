import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './models/User.js';
import ChatSession from './models/ChatSession.js';

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({});
    for (const u of users) {
        const sessions = await ChatSession.find({ userId: u._id });
        if (sessions.length > 0) {
            console.log(`User ${u.email} has ${sessions.length} sessions`);
            const s = sessions[sessions.length-1];
            console.log(`  Latest session Topic: ${s.topic}, Messages: ${s.messages.length}`);
        }
    }
    process.exit(0);
}
run();

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './models/User.js';
import ChatSession from './models/ChatSession.js';

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        const user = await User.findOne({ email: 'test1774985993962@tutorboard.test' });
        console.log("User:", user._id);
        
        const chatSession = await ChatSession.create({
            userId: user._id, // Notice we use _id
            title: "Test",
            topic: "Test Topic",
            engineSessionId: "123456"
        });
        console.log("ChatSession created successfully:", chatSession._id);
    } catch (e) {
        console.error("ChatSession Error:", e);
    }
    process.exit(0);
}
run();

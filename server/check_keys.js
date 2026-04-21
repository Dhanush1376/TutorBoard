import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './models/User.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const users = await User.find({});
    for (const user of users) {
        console.log(`User: ${user.email} | customApi: ${user.apiPreferences?.useCustomApi}`);
        for (const key of user.apiKeys) {
            console.log(`  Key: ${key.provider} | active: ${key.isActive} | valid: ${key.isValid} | label: ${key.label} | model: ${key.model}`);
        }
    }
    process.exit(0);
});

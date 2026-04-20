import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const cols = await mongoose.connection.db.collection('chatsessions').find({}).toArray();
    console.log(`Found ${cols.length} chat sessions in DB.`);
    if (cols.length > 0) {
        console.log('Sample IDs:', cols.slice(-3).map(c => c._id));
    }
    process.exit(0);
});

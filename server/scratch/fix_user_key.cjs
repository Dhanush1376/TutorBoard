const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await mongoose.connection.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId('69e2e24b9bc8d7682b748f06'), 'apiKeys._id': new mongoose.Types.ObjectId('69e5337a74ac7cdbb1690267') },
    { 
      $set: { 
        'apiKeys.$.baseUrl': 'https://openrouter.ai/api/v1', 
        'apiKeys.$.provider': 'openrouter', 
        'apiKeys.$.model': 'openai/gpt-4o-mini' 
      } 
    }
  );
  console.log('Updated:', result.modifiedCount);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

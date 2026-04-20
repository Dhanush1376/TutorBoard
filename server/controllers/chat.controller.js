import Chat from "../models/Chat.js";

// POST /api/chat/save
// EXTREME DIAGNOSTIC MODE: Comprehensive logging + Atomic findOneAndUpdate
export const saveChatMessage = async (req, res) => {
  console.log(">>> [STRICT CHAT] 📥 INBOUND SAVE REQUEST <<<");
  console.log(">>> Time:", new Date().toISOString());
  console.log(">>> Headers:", JSON.stringify(req.headers, null, 2));
  console.log(">>> Method:", req.method);
  
  try {
    const { userId, message } = req.body;
    
    console.log(">>> Body Data:", JSON.stringify({ userId, message }, null, 2));

    if (!userId) {
      console.error(">>> [STRICT CHAT] ❌ ABORT: userId is missing from payload");
      return res.status(400).json({ error: "userId is required" });
    }

    if (!message) {
      console.error(">>> [STRICT CHAT] ❌ ABORT: message is missing from payload");
      return res.status(400).json({ error: "message is required" });
    }

    console.log(`>>> [STRICT CHAT] 💾 Attempting MongoDB push for User ${userId}...`);

    // Using findOneAndUpdate with $push for atomic concurrency
    const updatedChat = await Chat.findOneAndUpdate(
      { userId },
      { $push: { messages: message } },
      { 
        upsert: true, 
        new: true, 
        runValidators: true,
        setDefaultsOnInsert: true 
      }
    );

    console.log(`>>> [STRICT CHAT] ✅ DB SUCCESS: Doc ID ${updatedChat._id}. Total msgs: ${updatedChat.messages.length}`);
    
    res.status(200).json(updatedChat);
  } catch (err) {
    console.error(">>> [STRICT CHAT] ❌ DB FATAL ERROR:", err.message);
    console.error(">>> Stack Trace:", err.stack);
    res.status(500).json({ 
      error: err.message,
      code: err.code,
      name: err.name 
    });
  }
};

// GET /api/chat/:userId
export const getChatHistory = async (req, res) => {
  const { userId } = req.params;
  console.log(`>>> [STRICT CHAT] 🔍 HISTORY FETCH: ${userId}`);
  
  try {
    const chat = await Chat.findOne({ userId });
    console.log(`>>> [STRICT CHAT] ℹ️ History Result: ${chat ? `${chat.messages.length} messages found` : 'No history document exists yet'}`);
    res.json(chat || { messages: [] });
  } catch (err) {
    console.error(">>> [STRICT CHAT] ❌ Fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

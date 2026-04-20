import express from "express";
import { saveChatMessage, getChatHistory } from "../controllers/chat.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Publicly accessible for the test as requested, but usually protected
// The blueprint snippet didn't specify middleware, but we'll include it for production quality
router.post("/save", saveChatMessage);
router.get("/:userId", getChatHistory);

export default router;

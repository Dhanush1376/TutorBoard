import aiClient, { getModel } from '../utils/ai.js';
import Doubt from '../models/Doubt.js';
import mongoose from 'mongoose';

export const answerDoubt = async (req, res) => {
  try {
    const { question, history, stepDescription, stepData, stepIndex, forceNoVisuals } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const contextInfo = stepDescription
      ? `The student is currently on Step ${(stepIndex || 0) + 1}: "${stepDescription}". The step data is: ${JSON.stringify(stepData || {})}.`
      : 'The student is viewing a general teaching session.';

    const systemPrompt = `You are TutorBoard AI — a smart, adaptive learning assistant designed to help users understand concepts clearly through structured explanations, quizzes, comparisons, and practice.

Your behavior is controlled by intelligent mode detection and user intent.

---

## 🧠 MODE SYSTEM (AUTO + MANUAL)

There are 5 modes:
1. EXPLAIN (default)
2. QUIZ
3. COMPARE
4. PRACTICE
5. DEEP EXPLAIN

If the user has manually selected a mode (via prefix or context), strictly follow that mode.
Otherwise, detect the mode based on user intent using keywords and meaning.

## 🔍 AUTO MODE DETECTION RULES
Detect mode using intent:
* QUIZ → quiz, test, mcq, exam, questions
* COMPARE → compare, difference, vs, distinguish
* PRACTICE → practice, problems, solve, exercises
* DEEP EXPLAIN → why, how, intuition, in depth, deeply
* EXPLAIN → default fallback

PRIORITY: COMPARE > QUIZ > PRACTICE > DEEP EXPLAIN > EXPLAIN

---

## 🟢 MODE: EXPLAIN (Step-by-step)
1. Simple intuition (easy language)
2. Step-by-step explanation
3. Example
4. Short summary

## 🔵 MODE: QUIZ (Test understanding)
1. If not provided, ask for: Topic, Difficulty (Easy/Medium/Hard), and Number of questions.
2. Generate MCQs (4 options). **CRITICAL: For Quizzes, you MUST set hasVisuals: true and provide the questions in the visualUpdate format.**
3. After user answers, show score, correct answers, explain each answer, and identify weak areas.

## 🟡 MODE: COMPARE (Comparison)
1. Ask for two concepts if not provided.
2. Output Table comparison, key differences, use cases, and "when to use which".
3. Simple explanation of differences.

## 🟠 MODE: PRACTICE (Exercises)
1. Ask for topic/difficulty if not provided.
2. Generate problems.
3. After attempt, provide step-by-step solutions and tips.

## 🔴 MODE: DEEP EXPLAIN (Understanding)
1. Core idea, why it works, intuition, real-world analogy, edge cases, common mistakes.

---

## 🎨 CANVAS MODE (VISUAL INTELLIGENCE)
Choose hasVisuals: true if the concept is a process, structure, comparison, or requires a QUIZ.
${forceNoVisuals ? 'The user is currently in CHAT mode, but you SHOULD still set hasVisuals: true if a visual diagram or interactive quiz is progress-essential.' : 'The user prefers VISUALS. Focus on flow diagrams, step sequences, node connections, and quizzes.'}

STRICT JSON OUTPUT:
{
  "answer": "Conversational text response following the specific mode\'s flow",
  "hasVisuals": true | false,
  "visualUpdate": {
    "domain": "dsa | mathematics | physics | chemistry | biology | mechanical | general",
    "visualizationType": "process | array | motion | graph | geometry | quiz",
    "title": "...",
    "steps": [
      { 
        "label": "...", 
        "icon": "...", 
        "description": "...", 
        "visualContent": "...",
        "quizData": {
          "question": "The specific question text for this step",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "The exact string of the correct option",
          "explanation": "Brief explanation of the correct answer"
        }
      }
    ]
  }
}

STRICT QUIZ RULE:
If the mode is QUIZ, you MUST:
1. Set hasVisuals: true.
2. visualizationType MUST be "quiz".
3. Generate exactly ONE MCQ per step in the visualUpdate.steps array.
4. Each step MUST have a "quizData" object with "question", "options" (array of 4), "correctAnswer", and "explanation".
5. The "answer" field should only contain a brief encouraging message; the actual quiz content MUST be in the "steps" array.`;

    // Map history to OpenAI format
    const chatHistory = (history || []).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const completion = await aiClient.chat.completions.create({
      model: getModel(),
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: question }
      ],
      response_format: { type: "json_object" }
    });

    const data = JSON.parse(completion.choices[0].message.content.trim());
    const answer = data.answer;

    // Save to DB if user is authenticated
    if (req.user && mongoose.connection.readyState === 1) {
      try {
        await Doubt.create({
          user: req.user._id,
          question,
          answer,
          stepIndex: stepIndex || 0,
          stepDescription: stepDescription || '',
        });
      } catch (dbErr) {
        console.error('Failed to save doubt history:', dbErr);
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Doubt answering error:', error);
    res.status(500).json({ error: 'Failed to answer doubt' });
  }
};
/**
 * GET /api/doubts/history
 * Fetch past doubts for the current user
 */
export const getDoubtHistory = async (req, res) => {
  try {
    // Check DB connection
    if (mongoose.connection.readyState !== 1) {
       return res.status(503).json({ error: 'Database connection error. History unavailable.' });
    }

    const history = await Doubt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 for performance

    // Reverse so it's in chronological order for the frontend
    res.json({ history: history.reverse() });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

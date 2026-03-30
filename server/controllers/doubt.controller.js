import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const answerDoubt = async (req, res) => {
  try {
    const { question, stepDescription, stepData, stepIndex } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const contextInfo = stepDescription
      ? `The student is currently on Step ${(stepIndex || 0) + 1}: "${stepDescription}". The step data is: ${JSON.stringify(stepData || {})}.`
      : 'The student is viewing a general teaching session.';

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert tutor helping a student who is learning through an interactive visualization board. ${contextInfo}

Answer their doubt clearly and concisely. Keep your explanation short (2-4 sentences max) since this is an inline chat during a teaching session. Be encouraging and relate your answer to what they are currently seeing on the board.`
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    const answer = completion.choices[0].message.content.trim();
    res.json({ answer });
  } catch (error) {
    console.error('Doubt answering error:', error);
    res.status(500).json({ error: 'Failed to answer doubt' });
  }
};

import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

async function test() {
    try {
        console.log('Testing OpenRouter API...');
        const completion = await ai.chat.completions.create({
            model: 'deepseek/deepseek-chat',
            messages: [{ role: 'user', content: 'Say hello' }],
            max_tokens: 10,
        });
        console.log('API SUCCESS:', completion.choices[0].message.content);
    } catch (err) {
        console.error('API FAILURE:', err.message);
    }
}
test();

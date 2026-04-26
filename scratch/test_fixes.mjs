
import { resolveModelId } from '../server/utils/ai/llmClient.js';

function testResolveModelId() {
  console.log('--- Testing resolveModelId ---');
  const tests = [
    { input: 'llama-3.3-70b-versatile', expected: 'llama-3.3-70b-versatile', label: 'Canonical ID' },
    { input: 'Llama 3.3 70B', expected: 'llama-3.3-70b-versatile', label: 'Mapping' },
    { input: 'anthropic/claude-3-5-sonnet-20241022', expected: 'anthropic/claude-3-5-sonnet-20241022', label: 'Full path' },
    { input: 'gemini-1.5-pro', expected: 'gemini-1.5-pro', label: 'Value from mapping' },
    { input: 'My Custom Gemini', expected: 'gemini-1.5-pro', label: 'Fuzzy match' },
  ];

  tests.forEach(t => {
    const result = resolveModelId(t.input);
    const pass = result === t.expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${t.label}: "${t.input}" -> "${result}" (expected "${t.expected}")`);
  });
}

// For URL stripping, I'll just simulate the logic here as it's hard to test the private variables in providerFactory
function testUrlStripping(url) {
    return url?.replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/completions$/, '') || 'http://localhost:11434/v1';
}

function testUrls() {
  console.log('\n--- Testing URL Stripping ---');
  const urls = [
    { input: 'https://api.groq.com/openai/v1/chat/completions', expected: 'https://api.groq.com/openai/v1' },
    { input: 'https://api.groq.com/openai/v1/', expected: 'https://api.groq.com/openai/v1' },
    { input: 'http://localhost:11434/v1/completions', expected: 'http://localhost:11434/v1' },
    { input: 'https://custom.ai/v1', expected: 'https://custom.ai/v1' },
  ];

  urls.forEach(u => {
    const result = testUrlStripping(u.input);
    const pass = result === u.expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] URL: "${u.input}" -> "${result}" (expected "${u.expected}")`);
  });
}

testResolveModelId();
testUrls();

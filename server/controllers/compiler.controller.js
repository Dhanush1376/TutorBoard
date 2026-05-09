import axios from 'axios';

/**
 * Judge0 Language ID Mapping
 */
const JUDGE0_LANG_MAP = {
  javascript: 63,
  typescript: 74,
  python: 71,
  python3: 71,
  java: 62,
  cpp: 54,
  'c++': 54,
  c: 50,
  ruby: 72,
  go: 60,
  rust: 73,
};

/**
 * Backend Proxy for Code Execution (using Judge0 CE)
 * Piston's public API became whitelisted in 2026, so we've migrated to Judge0.
 */
export const executeCodeProxy = async (req, res) => {
  const { language, code, files } = req.body;
  
  // Normalize language name
  const langId = JUDGE0_LANG_MAP[language?.toLowerCase()] || JUDGE0_LANG_MAP['javascript'];
  
  // Extract code from files if provided, or use standalone code field
  const sourceCode = code || (files && files[0] && files[0].content) || '';

  if (!sourceCode) {
    return res.status(400).json({ error: 'Source code is required' });
  }

  const host = process.env.JUDGE0_HOST || 'ce.judge0.com';
  const isRapidAPI = host.includes('rapidapi.com');
  
  console.log(`[Compiler Proxy] Executing ${language} (ID: ${langId}) via Judge0 (${host})...`);

  try {
    const headers = { 'Content-Type': 'application/json' };
    
    if (process.env.JUDGE0_API_KEY) {
      if (isRapidAPI) {
        headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
        headers['X-RapidAPI-Host'] = host;
      } else {
        headers['X-Auth-Token'] = process.env.JUDGE0_API_KEY;
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.error('[Compiler Proxy] ❌ CRITICAL: Running on public Judge0 instance in production. Access denied for security.');
      return res.status(403).json({ error: 'Code execution is disabled in production without a private Judge0 instance.' });
    }

    const response = await axios.post(`https://${host}/submissions?wait=true`, {
      language_id: langId,
      source_code: sourceCode,
      stdin: '', // Optional: support stdin in the future
    }, {
      timeout: 20000,
      headers
    });

    const data = response.data;
    
    // Format Judge0 response to match Piston-like structure for frontend compatibility
    const formatted = {
      run: {
        stdout: data.stdout || '',
        stderr: (data.stderr || '') + (data.compile_output || ''),
        code: data.status?.id === 3 ? 0 : 1, // 3 is "Accepted" in Judge0
        signal: data.status?.description,
      },
      // Preserve original data for debugging
      _raw: data
    };

    return res.json(formatted);
  } catch (err) {
    console.error('[Compiler Proxy] Judge0 failed:', err.message);
    res.status(502).json({ error: 'Code execution engine is currently unavailable.' });
  }
};

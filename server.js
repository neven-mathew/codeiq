require('dotenv').config();
const express = require('express');
const path    = require('path');
const Groq    = require('groq-sdk');

const GROQ_KEY = process.env.GROQ_API_KEY;
if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here' || GROQ_KEY.length < 10) {
  console.error('\n❌ ERROR: GROQ_API_KEY is missing or not set in your .env file.');
  console.error('   Set: GROQ_API_KEY=gsk_xxxxxxxxxxxxxx in .env file\n');
}

const groq = new Groq({ apiKey: GROQ_KEY });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Groq's officially recommended models (in priority order)
const MODELS_TO_TRY = [
  'gpt-4o-oss-120b',        // GPT OSS 120B - Groq official recommendation
  'qwen-qwq-32b',           // Qwen 32B - Groq official recommendation
  'mixtral-8x7b-32768',     // Fallback
  'llama-3.1-70b-versatile', // Fallback
  'gemma-7b-it'             // Fallback
];

function sanitizeText(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\n\s*(ignore|forget|override|disregard|you are|act as|jailbreak|system:|user:|assistant:)/gi, '')
    .trim();
}

function sanitizeCode(str) {
  if (typeof str !== 'string') return '';
  return str.slice(0, 3000).replace(/\x00/g, '').trim();
}

function sanitizeSeenList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 80)
    .map(q => sanitizeText(String(q || ''), 200))
    .filter(Boolean);
}

app.post('/api/admin-login', (req, res) => {
  const { email, pass } = req.body;
  if (email === 'neven@codeiq.com' && pass === 'messi10') {
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Invalid email or password.' });
});

app.post('/api/generate-questions', async (req, res) => {
  const { lang, code, seenQuestions } = req.body;

  if (!['Python', 'MySQL', 'C++', 'General'].includes(lang)) {
    return res.status(400).json({ error: 'Invalid language.' });
  }

  if (!GROQ_KEY || GROQ_KEY.length < 10) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  const sanitizedCode = code ? sanitizeCode(code) : null;
  const sanitizedSeen = sanitizeSeenList(seenQuestions);

  const seenNote = sanitizedSeen.length > 0
    ? `\n\nDo NOT repeat: ${sanitizedSeen.slice(0, 5).join(', ')}`
    : '';

  const systemPrompt = `Output ONLY valid JSON. No markdown.
{"questions":[{"question":"text","code":"","options":["A","B","C","D"],"correct":0,"explanation":"why"}]}`;

  const userMsg = sanitizedCode
    ? `Generate 5 ${lang} quiz questions about this code:\n\`\`\`\n${sanitizedCode}\n\`\`\`${seenNote}`
    : `Generate 5 ${lang} programming quiz questions.${seenNote}`;

  // Try each model until one works
  for (const model of MODELS_TO_TRY) {
    try {
      console.log(`[${new Date().toISOString()}] Trying model: ${model}`);
      
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.7,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg }
        ]
      });

      const raw = completion.choices[0]?.message?.content || '';
      const clean = raw.replace(/```json|```/gi, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (parseErr) {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('Invalid JSON');
        }
      }

      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < 3) {
        throw new Error('Invalid format');
      }

      while (parsed.questions.length < 5) {
        parsed.questions.push({
          question: `What is a ${lang} best practice?`,
          code: '',
          options: ['Use comments', 'Follow conventions', 'Test code', 'All of above'],
          correct: 3,
          explanation: 'All are important best practices.'
        });
      }

      console.log(`[${new Date().toISOString()}] ✅ Success with model: ${model}`);
      return res.json({ questions: parsed.questions.slice(0, 5) });

    } catch (err) {
      console.log(`[${new Date().toISOString()}] ❌ Model ${model} failed: ${err.message}`);
      // Try next model
      continue;
    }
  }

  // If all models fail
  res.status(500).json({ error: 'All AI models unavailable. Please try again.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ CodeIQ running at http://localhost:${PORT}`);
  console.log(`   Using Groq's recommended models (GPT OSS 120B / Qwen)`);
  console.log(`   Admin: neven@codeiq.com / messi10\n`);
});

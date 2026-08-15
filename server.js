require('dotenv').config();
const express = require('express');
const path    = require('path');

// Google Generative AI (Gemini) - FREE
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Startup key check ──────────────────────────────────────
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY || GEMINI_KEY === 'your_gemini_key_here' || GEMINI_KEY.length < 10) {
  console.error('\n❌ ERROR: GEMINI_API_KEY is missing or not set in your .env file.');
  console.error('   1. Open the file named ".env" in the codeiq folder.');
  console.error('   2. Set: GEMINI_API_KEY=AIz...');
  console.error('   3. Get your FREE key at: https://makersuite.google.com/app/apikey\n');
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Validation helpers ───────────────────────────────
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 100;
}

function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15 && /^[\d\s\+\-\(\)]{10,20}$/.test(phone);
}

function validateName(name) {
  if (typeof name !== 'string') return false;
  return /^[a-zA-Z\s\-\.]{2,60}$/.test(name) && !/[<>"'`]/.test(name);
}

// ── Input sanitisation helpers ───────────────────────────
const ALLOWED_LANGS = ['Python', 'MySQL', 'C++', 'General'];

function sanitizeText(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
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
  return arr
    .slice(0, 80)
    .map(q => sanitizeText(String(q || ''), 200))
    .filter(Boolean);
}

// ── Secure Admin Login Endpoint ───────────────────────────
app.post('/api/admin-login', (req, res) => {
  const { email, pass } = req.body;
  const SECURE_ADMIN_EMAIL = 'neven@codeiq.com';
  const SECURE_ADMIN_PASS  = 'messi10';

  if (email === SECURE_ADMIN_EMAIL && pass === SECURE_ADMIN_PASS) {
    return res.json({ success: true, message: 'Authenticated successfully' });
  } else {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
});

// ── Quiz generation endpoint using Google Gemini (FREE) ────
app.post('/api/generate-questions', async (req, res) => {
  const rawLang  = req.body.lang;
  const rawCode  = req.body.code;
  const rawSeen  = req.body.seenQuestions;

  if (!rawLang || !ALLOWED_LANGS.includes(rawLang)) {
    return res.status(400).json({ error: 'Invalid language selection.' });
  }
  const lang = rawLang;
  const code = rawCode ? sanitizeCode(rawCode) : null;
  const seenQuestions = sanitizeSeenList(rawSeen);

  if (!GEMINI_KEY || GEMINI_KEY === 'your_gemini_key_here' || GEMINI_KEY.length < 10) {
    return res.status(500).json({
      error: 'API key not configured. Get your FREE key at https://makersuite.google.com/app/apikey'
    });
  }

  const seenNote = seenQuestions.length > 0
    ? `Do NOT repeat these questions: ${seenQuestions.slice(0, 5).join(', ')}`
    : '';

  const prompt = code
    ? `Generate 5 ${lang} programming quiz questions about this code. Focus on bugs, output, complexity, best practices.
Code:
\`\`\`${lang}
${code}
\`\`\`

${seenNote}

Return ONLY valid JSON (no markdown):
{"questions":[{"question":"text","code":"snippet or empty","options":["A","B","C","D"],"correct":0,"explanation":"why"}]}`
    : `Generate 5 varied ${lang} programming quiz questions covering different topics and difficulty levels.
${seenNote}

Return ONLY valid JSON (no markdown):
{"questions":[{"question":"text","code":"","options":["A","B","C","D"],"correct":0,"explanation":"why"}]}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const clean = text.replace(/```json|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('AI returned invalid JSON');
      }
    }

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < 3) {
      throw new Error('Invalid question format');
    }

    // Ensure we have exactly 5 questions
    while (parsed.questions.length < 5) {
      parsed.questions.push({
        question: `What is a ${lang} best practice?`,
        code: '',
        options: ['Use comments', 'Follow style guide', 'Test thoroughly', 'All of the above'],
        correct: 3,
        explanation: 'All are important.'
      });
    }

    res.json({ questions: parsed.questions.slice(0, 5) });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate questions. Try again.' });
  }
});

// ── SPA fallback ──────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ CodeIQ server running at http://localhost:${PORT}`);
  if (GEMINI_KEY && GEMINI_KEY !== 'your_gemini_key_here' && GEMINI_KEY.length >= 10) {
    console.log(`   Gemini API key: loaded ✓`);
    console.log(`   Model: Gemini Pro (FREE - unlimited requests)`);
  } else {
    console.log(`   Gemini API key: ⚠️  NOT SET`);
    console.log(`   Get FREE key at: https://makersuite.google.com/app/apikey`);
  }
  console.log(`   Admin login:  neven@codeiq.com / messi10\n`);
});

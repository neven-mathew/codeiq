require('dotenv').config();
const express = require('express');
const path    = require('path');
const Groq    = require('groq-sdk');

const GROQ_KEY = process.env.GROQ_API_KEY;
if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here' || GROQ_KEY.length < 10) {
  console.error('\n❌ ERROR: GROQ_API_KEY is missing or not set in your .env file.');
  console.error('   1. Open the file named ".env" in the codeiq folder.');
  console.error('   2. Set: GROQ_API_KEY=gsk_xxxxxxxxxxxxxx');
  console.error('   3. Get your free key at: https://console.groq.com\n');
}

const groq = new Groq({ apiKey: GROQ_KEY });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

  if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here' || GROQ_KEY.length < 10) {
    return res.status(500).json({
      error: 'API key not configured. Set GROQ_API_KEY in .env file.'
    });
  }

  const seenNote = seenQuestions.length > 0
    ? `\n\nDo NOT repeat these questions:\n${seenQuestions.slice(0, 10).map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  const systemPrompt = `You are a programming quiz generator. Output ONLY valid JSON. No markdown, no backticks.
{"questions":[{"question":"text","code":"snippet or empty","options":["A","B","C","D"],"correct":0,"explanation":"why"}]}
Rules:
- "correct" is 0, 1, 2, or 3
- Mix easy, medium, hard questions
- All 5 questions must be different topics`;

  const userMsg = code
    ? `Generate 5 ${lang} quiz questions about this code:\n\`\`\`\n${code}\n\`\`\`${seenNote}`
    : `Generate 5 ${lang} programming quiz questions covering different topics.${seenNote}`;

  try {
    const completion = await groq.chat.completions.create({
      model:       'groq-3.2-11b-text-preview',
      temperature: 0.7,
      max_tokens:  1500,
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
        throw new Error('AI returned invalid JSON');
      }
    }

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < 3) {
      throw new Error('Invalid question format');
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

    res.json({ questions: parsed.questions.slice(0, 5) });

  } catch (err) {
    console.error('Groq error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate questions. Try again.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ CodeIQ server running at http://localhost:${PORT}`);
  if (GROQ_KEY && GROQ_KEY !== 'your_groq_api_key_here' && GROQ_KEY.length >= 10) {
    console.log(`   Groq API key: loaded ✓`);
    console.log(`   Model: Groq 3.2 11B Text (stable)`);
  } else {
    console.log(`   Groq API key: ⚠️  NOT SET`);
  }
  console.log(`   Admin login:  neven@codeiq.com / messi10\n`);
});

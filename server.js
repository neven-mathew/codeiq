require('dotenv').config();
const express = require('express');
const path    = require('path');
const Groq    = require('groq-sdk');

// ── Startup key check ──────────────────────────────────────
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

// ── Quiz generation endpoint ──────────────────────────────
app.post('/api/generate-questions', async (req, res) => {
  const { lang, code, seenQuestions } = req.body;

  if (!lang) {
    return res.status(400).json({ error: 'Language is required.' });
  }

  // Guard: API key not configured
  if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here' || GROQ_KEY.length < 10) {
    return res.status(500).json({
      error: 'API key not configured. Open your .env file, set GROQ_API_KEY=gsk_..., then restart the server.'
    });
  }

  const seenNote = seenQuestions && seenQuestions.length > 0
    ? `\n\nCRITICAL: Do NOT use any of these questions already shown to this user:\n${seenQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  const systemPrompt = `You are a programming quiz generator. Generate exactly 5 multiple-choice questions.
You MUST return ONLY a valid JSON object. No markdown, no backticks, no explanation, no extra text — just the raw JSON.
Use this exact structure:
{"questions":[{"question":"question text","code":"code snippet or empty string","options":["A","B","C","D"],"correct":0,"explanation":"why the correct answer is right"}]}
Rules:
- "correct" is the zero-based index (0, 1, 2, or 3) of the correct option in the options array
- Vary difficulty: mix easy, medium, and hard questions
- Use real code snippets in the "code" field when the question benefits from it, otherwise use empty string ""
- All 5 questions must be on different topics/concepts
- Options must be plausible — no obviously wrong distractors${seenNote}`;

  const userMsg = code
    ? `Generate 5 quiz questions about this ${lang} code:\n\`\`\`\n${code}\n\`\`\`\nTest: what it does, output, bugs, complexity, best practices. Each question must cover a different aspect.`
    : `Generate 5 varied ${lang} programming quiz questions covering different topics and difficulty levels.`;

  try {
    const completion = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens:  2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMsg }
      ]
    });

    const raw   = completion.choices[0]?.message?.content || '';
    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      // Try extracting JSON block if model added surrounding text
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        console.error('JSON parse failed. Raw response:\n', raw);
        throw new Error('AI returned invalid JSON. Please try again.');
      }
    }

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('AI returned no questions. Please try again.');
    }

    res.json(parsed);

  } catch (err) {
    console.error('Groq API / server error:', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to generate questions. Please try again.' });
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
  if (GROQ_KEY && GROQ_KEY !== 'your_groq_api_key_here' && GROQ_KEY.length >= 10) {
    console.log(`   Groq API key: loaded ✓ (${GROQ_KEY.slice(0, 10)}...)`);
  } else {
    console.log(`   Groq API key: ⚠️  NOT SET — quiz generation will fail`);
    console.log(`   Fix: edit .env → GROQ_API_KEY=gsk_...`);
  }
  console.log(`   Admin login:  admin@codeiq.com / admin123\n`);
});

require('dotenv').config();
const express = require('express');
const path    = require('path');
const Groq    = require('groq-sdk');

const GROQ_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_KEY && GROQ_KEY.length > 10 ? new Groq({ apiKey: GROQ_KEY }) : null;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fallback static questions
const STATIC_QUIZZES = {
  Python: [
    { question: "What does len() return?", code: "text = 'hello'\nprint(len(text))", options: ["Length of string", "Converts to lowercase", "Removes spaces", "Counts words"], correct: 0, explanation: "len() returns the number of characters in a string" },
    { question: "Which symbol is for comments?", code: "# This is a comment\nname = 'John'", options: ["//", "#", "/*", "--"], correct: 1, explanation: "# is used for single-line comments in Python" },
    { question: "How to create a list?", code: "my_list = [1, 2, 3, 4]", options: ["[1, 2]", "{1, 2}", "(1, 2)", "<1, 2>"], correct: 0, explanation: "Lists use square brackets []" },
    { question: "What does ** do?", code: "x = 5\nprint(x ** 2)", options: ["5", "10", "25", "Error"], correct: 2, explanation: "** is exponentiation, 5**2 = 25" },
    { question: "How to define a function?", code: "def greet():\n    print('hello')", options: ["function", "def", "func", "method"], correct: 1, explanation: "'def' keyword defines functions in Python" }
  ],
  MySQL: [
    { question: "What does SELECT * do?", code: "SELECT * FROM users;", options: ["All columns", "First column", "Deletes all", "Updates rows"], correct: 0, explanation: "SELECT * retrieves all columns from the table" },
    { question: "Which filters records?", code: "SELECT * FROM users WHERE age > 18;", options: ["FILTER", "WHERE", "FIND", "SEARCH"], correct: 1, explanation: "WHERE clause filters records" },
    { question: "What is PRIMARY KEY?", code: "CREATE TABLE users (\n  id INT PRIMARY KEY\n);", options: ["Allows duplicates", "Uniquely identifies each row", "Stores passwords", "Backup copy"], correct: 1, explanation: "PRIMARY KEY uniquely identifies each record" },
    { question: "How to add a record?", code: "INSERT INTO users (name, age)\nVALUES ('John', 25);", options: ["ADD", "INSERT", "PUT", "POST"], correct: 1, explanation: "INSERT INTO adds new records" },
    { question: "What does JOIN do?", code: "SELECT * FROM users\nJOIN orders ON users.id = orders.user_id;", options: ["Deletes data", "Combines tables", "Creates backup", "Sorts data"], correct: 1, explanation: "JOIN combines rows from multiple tables" }
  ],
  'C++': [
    { question: "For loop syntax?", code: "for (int i = 0; i < 5; i++) {\n    cout << i;\n}", options: ["for (i=0; i<5; i++)", "for (i in 0..5)", "for i in range(5):", "for (int i = 0; i < 5; i++)"], correct: 3, explanation: "C++ for loop uses parentheses and braces" },
    { question: "What does cout do?", code: "#include <iostream>\nusing namespace std;\ncout << \"Hello\";", options: ["Reads input", "Outputs text", "Declares variable", "Defines function"], correct: 1, explanation: "cout outputs data to the console" },
    { question: "What is a pointer?", code: "int x = 5;\nint* ptr = &x;", options: ["A string", "Stores memory address", "An array", "A function"], correct: 1, explanation: "A pointer stores the memory address of a variable" },
    { question: "What does new do?", code: "int* arr = new int[10];", options: ["Declares variable", "Allocates memory", "Creates function", "Deletes data"], correct: 1, explanation: "'new' dynamically allocates memory" },
    { question: "What is a class?", code: "class Car {\npublic:\n  string color;\n};", options: ["Variable type", "Blueprint for objects", "A function", "An array"], correct: 1, explanation: "A class is a blueprint for creating objects" }
  ],
  General: [
    { question: "What is an algorithm?", code: "", options: ["Programming language", "Step-by-step procedure", "A database", "A type of variable"], correct: 1, explanation: "An algorithm is a set of instructions to solve a problem" },
    { question: "What does DRY stand for?", code: "", options: ["Data Retrieval Year", "Don't Repeat Yourself", "Database Record Yield", "Dynamic Resource Yield"], correct: 1, explanation: "DRY (Don't Repeat Yourself) reduces code duplication" },
    { question: "What is debugging?", code: "", options: ["Writing comments", "Finding and fixing errors", "Compiling code", "Naming variables"], correct: 1, explanation: "Debugging finds and fixes bugs in code" },
    { question: "What does API stand for?", code: "", options: ["Application Programming Interface", "Advanced Programming Initiative", "Automated Process Integration", "Application Protocol Index"], correct: 0, explanation: "API (Application Programming Interface) enables software communication" },
    { question: "What is version control?", code: "", options: ["Updating software", "Tracking code changes over time", "Fixing bugs", "Writing documentation"], correct: 1, explanation: "Version control tracks changes to code throughout development" }
  ]
};

const MODELS_TO_TRY = [
  'gpt-4o-oss-120b',
  'qwen-qwq-32b',
  'mixtral-8x7b-32768',
  'llama-3.1-70b-versatile'
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

  // Try AI models if key is available
  if (groq) {
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

    for (const model of MODELS_TO_TRY) {
      try {
        console.log(`Trying model: ${model}`);
        
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

        console.log(`✅ Success with model: ${model}`);
        return res.json({ questions: parsed.questions.slice(0, 5) });

      } catch (err) {
        console.log(`❌ Model ${model} failed: ${err.message}`);
        continue;
      }
    }
  }

  // Fallback to static questions
  console.log(`⚠️ Using static questions for ${lang}`);
  const staticQuestions = STATIC_QUIZZES[lang] || STATIC_QUIZZES.General;
  const shuffled = staticQuestions.sort(() => 0.5 - Math.random());
  res.json({ questions: shuffled.slice(0, 5) });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ CodeIQ running at http://localhost:${PORT}`);
  console.log(`   Mode: AI with fallback to static questions`);
  console.log(`   Admin: neven@codeiq.com / messi10\n`);
});

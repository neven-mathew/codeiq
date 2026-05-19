# CodeIQ — Smart Programming Quiz App

A full-stack quiz web app powered by **Groq AI** (free, fast LLM API).
Users take randomized quizzes in Python, MySQL, and C++, or paste their
own code and receive AI-generated questions tailored to it.

---

## Quick Start

### 1. Install dependencies
```bash
cd codeiq
npm install
```

### 2. Set your Groq API key
```bash
cp .env.example .env
```
Open `.env` and paste your key:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
PORT=3000
```
Get a **free** key at: https://console.groq.com → API Keys

### 3. Run
```bash
npm start
```
Open: **http://localhost:3000**

---

## Admin Login
| Field    | Value              |
|----------|--------------------|
| Email    | neven@codeiq.com   |
| Password | neven12           |

---

## File Structure
```
codeiq/
├── server.js           ← Express server + Groq AI proxy
├── package.json
├── .env.example        ← Copy to .env, add your key
└── public/
    ├── index.html      ← All HTML pages (single-page app)
    ├── style.css       ← Full stylesheet
    └── app.js          ← All client-side logic
```

---

## Pages
| Page | Description |
|------|-------------|
| Home (Page 1) | Landing page. Admin login button in top nav. |
| Language Select (Page 2) | Choose Python / MySQL / C++. Code input at bottom. |
| Quiz (Page 3) | 5 AI-generated questions with explanations. |
| Results | Score, percentage, answer breakdown. |
| Admin Panel | Stats + Users / Visit Log / Activity tabs. |

---

## Features
- **No repeat questions** — question history tracked per user
- **Code quiz mode** — paste your code, get tailored questions (sign-in required)
- **Groq AI** — uses `llama-3.3-70b-versatile` model (free tier)
- **Admin dashboard** — visitor counts, user details, quiz activity
- **Session persistence** — login remembered across page refreshes
- **Responsive** — works on mobile and desktop

---

## Groq Free Tier Limits
Groq's free tier allows ~30 requests/minute and ~14,400/day — more than enough
for personal or small-group use. No credit card required.

---

## Deployment
For a live server (Railway, Render, VPS etc.):
1. Push the `codeiq/` folder
2. Set `GROQ_API_KEY` as an environment variable
3. Run `npm start` or use PM2: `pm2 start server.js --name codeiq`

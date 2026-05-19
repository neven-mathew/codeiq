 CodeIQ — Smart Programming Quiz App



### 1. Install dependencies
```bash
cd codeiq
npm install
```

### 2. Set your Groq API key
```bash
cp .env.example .env
```


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

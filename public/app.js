'use strict';

const state = {
  page: 'home',
  lang: null,
  user: null,
  isAdmin: false,
  questions: [],
  current: 0,
  answers: [],
  isCodeQuiz: false,
};

function getData(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function setData(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

function init() {
  if (!getData('ciq_users')) setData('ciq_users', []);
  if (!getData('ciq_activity')) setData('ciq_activity', []);
  if (!getData('ciq_visits')) setData('ciq_visits', {});
  if (!getData('ciq_seen')) setData('ciq_seen', {});

  recordVisit();
  restoreSession();
  updateUserNav();

  const passField = document.getElementById('a-pass');
  if (passField) {
    passField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginAdmin();
    });
  }
}

function recordVisit() {
  const today = todayKey();
  const visits = getData('ciq_visits') || {};
  if (!visits[today]) visits[today] = { count: 0, newUsers: 0, codeQuizzes: 0, langs: {} };
  visits[today].count++;
  setData('ciq_visits', visits);
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function restoreSession() {
  const saved = getData('ciq_session');
  if (saved && saved.email) {
    const users = getData('ciq_users') || [];
    const found = users.find(u => u.email === saved.email);
    if (found) { state.user = found; }
  }
}

function saveSession() {
  if (state.user && state.user.email) {
    setData('ciq_session', { email: state.user.email });
  }
}

function clearSession() {
  localStorage.removeItem('ciq_session');
}

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  if (target) { target.classList.add('active'); state.page = id; }
  window.scrollTo(0, 0);
}

function openModal(type) {
  const el = document.getElementById('modal-' + type);
  if (el) el.classList.remove('hidden');
}

function closeModal(type) {
  const el = document.getElementById('modal-' + type);
  if (el) el.classList.add('hidden');
}

function loginUser() {
  const name = document.getElementById('u-name').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const phone = document.getElementById('u-phone').value.trim();
  const errEl = document.getElementById('user-err');

  if (!name || !email || !phone) {
    showErr(errEl, 'Please fill in all fields.');
    return;
  }

  if (!/^[a-zA-Z\s\-\.]{2,60}$/.test(name)) {
    showErr(errEl, 'Name must be letters only.');
    return;
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(email) || email.length > 100) {
    showErr(errEl, 'Enter a valid email.');
    return;
  }

  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    showErr(errEl, 'Phone must be 10-15 digits.');
    return;
  }

  errEl.classList.add('hidden');

  const users = getData('ciq_users') || [];
  let user = users.find(u => u.email === email);

  if (!user) {
    user = { name, email, phone, joined: new Date().toISOString(), quizzes: 0 };
    users.push(user);
    setData('ciq_users', users);

    const visits = getData('ciq_visits') || {};
    const today = todayKey();
    if (visits[today]) { visits[today].newUsers = (visits[today].newUsers || 0) + 1; }
    setData('ciq_visits', visits);
  } else {
    user.name = name;
    user.phone = phone;
    const idx = users.findIndex(u => u.email === email);
    users[idx] = user;
    setData('ciq_users', users);
  }

  state.user = user;
  saveSession();
  updateUserNav();
  closeModal('user');

  const warn = document.getElementById('code-login-warn');
  if (warn) warn.style.display = 'none';
}

function logoutUser() {
  state.user = null;
  clearSession();
  updateUserNav();
}

function updateUserNav() {
  const loginBtn = document.getElementById('btn-login-nav');
  const pillSpan = document.getElementById('user-pill-nav');

  if (state.user && state.user.name) {
    loginBtn.style.display = 'none';

    const rawName = String(state.user.name || '');
    const initials = rawName.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    const pill = document.createElement('span');
    pill.className = 'user-pill';

    const avatar = document.createElement('span');
    avatar.className = 'avatar-sm';
    avatar.textContent = initials;

    const nameNode = document.createTextNode('\u00A0' + rawName);

    const signOut = document.createElement('button');
    signOut.className = 'nav-btn btn-ghost';
    signOut.textContent = 'Sign Out';
    signOut.addEventListener('click', logoutUser);

    pill.appendChild(avatar);
    pill.appendChild(nameNode);
    pillSpan.innerHTML = '';
    pillSpan.appendChild(pill);
    pillSpan.appendChild(signOut);
  } else {
    loginBtn.style.display = '';
    pillSpan.innerHTML = '';
  }
}

function showErr(el, msg) {
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

async function loginAdmin() {
  const email = document.getElementById('a-email').value.trim();
  const pass = document.getElementById('a-pass').value;
  const errEl = document.getElementById('admin-err');

  if (!email || !pass) {
    showErr(errEl, 'Please fill in all fields.');
    return;
  }

  try {
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pass })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    errEl.classList.add('hidden');
    state.isAdmin = true;
    closeModal('admin');
    loadAdminData();
    goPage('admin');
  } catch (err) {
    showErr(errEl, err.message || 'Invalid credentials.');
  }
}

function logoutAdmin() {
  state.isAdmin = false;
  goPage('home');
}

function selectLang(lang) {
  state.lang = lang;

  document.querySelectorAll('.lang-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('lc-' + lang);
  if (card) card.classList.add('selected');

  const startRow = document.getElementById('start-row');
  if (startRow) startRow.style.display = '';

  const sel = document.getElementById('code-lang-select');
  if (sel) sel.value = lang;
}

function getSeenQuestions(userKey, lang) {
  const seen = getData('ciq_seen') || {};
  const key = `${userKey}_${lang}`;
  return seen[key] || [];
}

function recordSeenQuestions(userKey, lang, questions) {
  const seen = getData('ciq_seen') || {};
  const key = `${userKey}_${lang}`;
  const existing = seen[key] || [];
  const newTexts = questions.map(q => q.question);
  seen[key] = [...existing, ...newTexts].slice(-80);
  setData('ciq_seen', seen);
}

async function startQuiz() {
  if (!state.lang) { alert('Please select a language first.'); return; }
  state.isCodeQuiz = false;
  await loadQuestions(state.lang, null);
}

async function startCodeQuiz() {
  const code = document.getElementById('user-code-input').value.trim();
  if (!code) { alert('Please paste your code first.'); return; }

  if (!state.user) {
    document.getElementById('code-login-warn').style.display = 'flex';
    openModal('user');
    return;
  }

  const lang = document.getElementById('code-lang-select').value;
  state.isCodeQuiz = true;
  state.lang = lang;
  await loadQuestions(lang, code);
}

async function loadQuestions(lang, code) {
  state.questions = [];
  state.current = 0;
  state.answers = [];

  goPage('quiz');

  document.getElementById('quiz-lang-tag').textContent = lang;
  document.getElementById('quiz-type-tag').textContent = code ? 'Code Quiz' : 'Standard';
  document.getElementById('quiz-prog-fill').style.width = '0%';
  document.getElementById('quiz-counter').textContent = '…';

  renderLoading();

  const today = todayKey();
  const visits = getData('ciq_visits') || {};
  if (visits[today]) {
    if (code) visits[today].codeQuizzes = (visits[today].codeQuizzes || 0) + 1;
    if (lang) visits[today].langs[lang] = (visits[today].langs[lang] || 0) + 1;
    setData('ciq_visits', visits);
  }

  const userKey = state.user ? state.user.email : 'guest';
  const seenQuestions = getSeenQuestions(userKey, lang);

  try {
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, code, seenQuestions })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Server error');
    }

    const data = await response.json();

    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('No questions returned');
    }

    state.questions = data.questions;
    recordSeenQuestions(userKey, lang, data.questions);

    if (state.user) {
      const users = getData('ciq_users') || [];
      const idx = users.findIndex(u => u.email === state.user.email);
      if (idx > -1) {
        users[idx].quizzes = (users[idx].quizzes || 0) + 1;
        state.user = users[idx];
        setData('ciq_users', users);
      }
    }

    const activity = getData('ciq_activity') || [];
    activity.unshift({
      user: state.user ? state.user.name : 'Guest',
      email: state.user ? state.user.email : '',
      lang,
      type: code ? 'Code' : 'Standard',
      score: '',
      time: new Date().toISOString(),
    });
    setData('ciq_activity', activity.slice(0, 100));

    renderQuestion();

  } catch (err) {
    console.error(err);
    document.getElementById('quiz-body').innerHTML =
      `<div style="text-align:center;padding:4rem 2rem">
        <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
        <h3>Failed to load questions</h3>
        <p style="color:#666;font-size:.85rem;margin-bottom:1.2rem;background:#f3f4f6;display:inline-block;padding:6px 14px;border-radius:8px">${escHtml(err.message)}</p>
        <button class="btn-large btn-outline" onclick="goPage('lang')" style="padding:10px 22px;margin-top:.5rem">Go Back</button>
      </div>`;
  }
}

function renderLoading() {
  document.getElementById('quiz-body').innerHTML = `
    <div class="quiz-loading">
      <div class="spinner"></div>
      <h3>Generating your quiz…</h3>
      <p>Creating fresh questions for you</p>
    </div>`;
}

function renderQuestion() {
  const q = state.questions[state.current];
  const total = state.questions.length;
  const pct = Math.round((state.current / total) * 100);

  document.getElementById('quiz-prog-fill').style.width = pct + '%';
  document.getElementById('quiz-counter').textContent = `${state.current + 1} / ${total}`;

  const letters = ['A', 'B', 'C', 'D'];
  const optionsHtml = q.options.map((opt, i) => `
    <button class="opt-btn" onclick="selectAnswer(${i})" id="opt-${i}">
      <span class="opt-letter">${letters[i]}</span>
      <span>${escHtml(opt)}</span>
    </button>`).join('');

  const codeHtml = q.code && q.code.trim()
    ? `<div class="code-snippet"><code>${escHtml(q.code)}</code></div>`
    : '';

  document.getElementById('quiz-body').innerHTML = `
    <div class="q-card">
      <div class="q-top-row">
        <span class="q-num-badge">Question ${state.current + 1}</span>
      </div>
      <div class="q-text">${escHtml(q.question)}</div>
      ${codeHtml}
      <div class="options">${optionsHtml}</div>
      <div class="explanation-box" id="expl-box"></div>
    </div>`;
}

function selectAnswer(chosenIdx) {
  const q = state.questions[state.current];
  const opts = document.querySelectorAll('.opt-btn');

  opts.forEach(o => (o.disabled = true));

  state.answers.push({
    question: q.question,
    options: q.options,
    chosen: chosenIdx,
    correct: q.correct,
    explanation: q.explanation,
  });

  opts[q.correct].classList.add('correct');
  if (chosenIdx !== q.correct) opts[chosenIdx].classList.add('wrong');

  const explBox = document.getElementById('expl-box');
  explBox.innerHTML = `<strong>Explanation:</strong> ${escHtml(q.explanation)}`;
  explBox.style.display = 'block';

  const qCard = document.querySelector('.q-card');
  const isLast = state.current >= state.questions.length - 1;
  const nextLabel = isLast ? 'See Results →' : 'Next Question →';
  const nextDiv = document.createElement('div');
  nextDiv.className = 'quiz-next-row';
  nextDiv.innerHTML = `<button class="btn-large btn-primary" onclick="nextQuestion()" style="padding:10px 24px">${nextLabel}</button>`;
  qCard.appendChild(nextDiv);
}

function nextQuestion() {
  if (state.current < state.questions.length - 1) {
    state.current++;
    renderQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  const correct = state.answers.filter(a => a.chosen === a.correct).length;
  const total = state.answers.length;
  const pct = Math.round((correct / total) * 100);

  const activity = getData('ciq_activity') || [];
  if (activity[0] && !activity[0].score) activity[0].score = `${correct}/${total}`;
  setData('ciq_activity', activity);

  goPage('results');

  document.getElementById('score-frac').textContent = `${correct}/${total}`;
  document.getElementById('score-pct').textContent = `${pct}%`;

  const circumference = 2 * Math.PI * 50;
  const arc = document.getElementById('score-ring-arc');
  const offset = circumference * (1 - pct / 100);
  setTimeout(() => { arc.style.strokeDashoffset = offset.toFixed(1); }, 100);

  const msgEl = document.getElementById('score-msg');
  if (pct >= 80) {
    msgEl.textContent = '🎉 Excellent work!';
    msgEl.className = 'score-message msg-great';
  } else if (pct >= 50) {
    msgEl.textContent = '👍 Good effort! Keep practicing.';
    msgEl.className = 'score-message msg-ok';
  } else {
    msgEl.textContent = '📚 Keep going — review and try again!';
    msgEl.className = 'score-message msg-low';
  }

  const itemsEl = document.getElementById('result-items');
  itemsEl.innerHTML = state.answers.map((a, i) => {
    const ok = a.chosen === a.correct;
    const badge = ok
      ? `<span class="r-badge badge-ok">Correct</span>`
      : `<span class="r-badge badge-bad">Wrong</span>`;
    const detail = !ok
      ? `<div class="r-item-detail">Your: ${escHtml(a.options[a.chosen])} → Correct: ${escHtml(a.options[a.correct])}</div>`
      : '';
    return `
      <div class="r-item ${ok ? 'ok' : 'bad'}">
        <div class="r-item-top">
          <div class="r-item-q">Q${i + 1}. ${escHtml(a.question)}</div>
          ${badge}
        </div>
        ${detail}
      </div>`;
  }).join('');
}

function loadAdminData() {
  const users = getData('ciq_users') || [];
  const activity = getData('ciq_activity') || [];
  const visits = getData('ciq_visits') || {};
  const today = todayKey();

  document.getElementById('stat-users').textContent = users.length;
  document.getElementById('stat-today').textContent = (visits[today]?.count || 0);
  document.getElementById('stat-today-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  document.getElementById('stat-quizzes').textContent = activity.length;
  document.getElementById('stat-code').textContent = activity.filter(a => a.type === 'Code').length;

  const ubody = document.getElementById('admin-users-body');
  ubody.innerHTML = users.length
    ? users.map(u => {
        const joinedDate = u.joined ? new Date(u.joined).toLocaleDateString('en-IN') : '—';
        return `
        <tr>
          <td><strong>${escHtml(u.name)}</strong></td>
          <td>${escHtml(u.email)}</td>
          <td>${escHtml(u.phone)}</td>
          <td>${escHtml(joinedDate)}</td>
          <td><span class="badge badge-blue">${parseInt(u.quizzes) || 0}</span></td>
          <td><span class="badge badge-green">Active</span></td>
        </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="6">No users yet</td></tr>';

  const vbody = document.getElementById('admin-visits-body');
  const sortedDates = Object.keys(visits).sort().reverse();
  vbody.innerHTML = sortedDates.length
    ? sortedDates.map(d => {
        const v = visits[d];
        const langs = v.langs || {};
        const topLang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
        return `
          <tr>
            <td>${escHtml(d)}</td>
            <td>${v.count}</td>
            <td>${v.newUsers || 0}</td>
            <td>${v.codeQuizzes || 0}</td>
            <td><span class="badge badge-purple">${escHtml(topLang)}</span></td>
          </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="5">No data yet</td></tr>';

  const abody = document.getElementById('admin-activity-body');
  abody.innerHTML = activity.length
    ? activity.slice(0, 25).map(a => `
        <tr>
          <td>${escHtml(a.user)}</td>
          <td><span class="badge badge-purple">${escHtml(a.lang)}</span></td>
          <td>${escHtml(a.score) || '—'}</td>
          <td><span class="badge ${a.type === 'Code' ? 'badge-orange' : 'badge-blue'}">${escHtml(a.type)}</span></td>
          <td style="font-size:.82rem">${new Date(a.time).toLocaleString('en-IN')}</td>
        </tr>`).join('')
    : '<tr class="empty-row"><td colspan="5">No activity yet</td></tr>';
}

function adminTab(name, el) {
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  ['users', 'visits', 'activity'].forEach(tab => {
    const panel = document.getElementById('atab-panel-' + tab);
    if (panel) {
      if (tab === name) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

document.addEventListener('DOMContentLoaded', init);

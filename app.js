/* ===========================
 * 日経TEST対策クイズ - app.js（中断機能改良版）
 * 改善点：
 *  ① トップメニュー確実に非表示
 *  ② 「ここまでの回答を見て終了」位置修正＆挙動修正
 *  ③ 「トップページに戻る」即復帰
 * =========================== */

const CHUNK_SIZE = 5;

const FILE_MAP = {
  finance:  'data/questions_finance.json',
  strategy: 'data/questions_strategy.json',
  marketing:'data/questions_marketing.json',
  law:      'data/questions_law.json',
  economy:  'data/questions_economy.json',
  current:  'data/questions_current.json'
};

// --- DOM取得 ---
const mainMenu        = document.getElementById('mainMenu');
const btnSelectGenre  = document.getElementById('btnSelectGenre');
const btnMixedMode    = document.getElementById('btnMixedMode');
const genreMenu       = document.getElementById('genreMenu');
const questionCountMenu = document.getElementById('questionCountMenu');
const quizForm        = document.getElementById('quizForm');
const questionsBox    = document.getElementById('questions');
const submitBtn       = document.getElementById('submitBtn');
const resultBox       = document.getElementById('result');

// --- 状態管理 ---
let selectedCategory = '';
let allQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let totalCorrect = 0;
let totalAnswered = 0;
let questionCount = 10;
let userAnswers = [];

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
  btnSelectGenre?.addEventListener('click', () => toggleGenreMenu());

  btnMixedMode?.addEventListener('click', async () => {
    selectedCategory = 'mixed';
    hideGenreMenuInstant();
    await preloadCategory('mixed');
    showOnly(questionCountMenu);
  });

  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      selectedCategory = btn.dataset.category || '';
      await preloadCategory(selectedCategory);
      showOnly(questionCountMenu);
    });
  });

  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      questionCount = parseInt(btn.dataset.count);
      startQuiz();
    });
  });

  quizForm?.addEventListener('submit', e => {
    e.preventDefault();
    savePageAnswers();
  });
});

// --- 表示制御 ---
function showOnly(target) {
  [mainMenu, genreMenu, questionCountMenu, quizForm, resultBox].forEach(hide);
  show(target);
}
function show(el) {
  if (!el) return;
  el.classList.remove('hidden');
  if (el.classList.contains('collapsible'))
    requestAnimationFrame(() => el.classList.add('show'));
}
function hide(el) {
  if (!el) return;
  if (el.classList.contains('collapsible')) {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 400);
  } else el.classList.add('hidden');
}
function toggleGenreMenu() {
  if (!genreMenu) return;
  if (genreMenu.classList.contains('hidden')) {
    genreMenu.classList.remove('hidden');
    setTimeout(() => genreMenu.classList.add('show'), 10);
  } else {
    genreMenu.classList.remove('show');
    setTimeout(() => genreMenu.classList.add('hidden'), 400);
  }
}
function hideGenreMenuInstant() {
  if (!genreMenu) return;
  genreMenu.classList.remove('show');
  genreMenu.classList.add('hidden');
}

// --- データ読み込み ---
async function preloadCategory(category) {
  if (category === 'mixed') {
    const paths = Object.values(FILE_MAP);
    const dataSets = await Promise.all(paths.map(p => fetchJsonSafe(p)));
    allQuestions = dataSets.flat();
  } else {
    const path = FILE_MAP[category];
    if (!path) {
      allQuestions = [];
      console.warn('未対応カテゴリ:', category);
      return;
    }
    allQuestions = await fetchJsonSafe(path);
  }
}

async function fetchJsonSafe(path) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`❌ 読み込み失敗: ${path}`, err);
    return [];
  }
}

// --- クイズ開始 ---
function startQuiz() {
  if (!selectedCategory) {
    alert('ジャンルを選択してください。');
    showOnly(mainMenu);
    return;
  }
  if (!allQuestions.length) {
    alert('問題ファイルが読み込まれていません。');
    showOnly(mainMenu);
    return;
  }

  filteredQuestions = shuffle(allQuestions).slice(0, questionCount);
  userAnswers = new Array(filteredQuestions.length).fill(null);
  currentIndex = 0;

  // ✅ トップメニューを確実に非表示
  hide(mainMenu);
  hide(genreMenu);

  renderQuestionsPage();
  showOnly(quizForm);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 問題表示 ---
function renderQuestionsPage() {
  questionsBox.innerHTML = '';
  hide(resultBox);
  show(quizForm);

  const pageQuestions = filteredQuestions.slice(currentIndex, currentIndex + CHUNK_SIZE);
  if (!pageQuestions.length) return calculateFinalScore();

  // 出題表示
  pageQuestions.forEach((q, idx) => {
    const num = currentIndex + idx + 1;
    const div = document.createElement('div');
    div.className = 'questionBlock';
    div.innerHTML = `
      <div class="question"><b>Q${num}.</b> ${escapeHtml(q.q)}</div>
      <div class="options">
        ${q.options.map((opt, i) => {
          const checked = userAnswers[num - 1] === i ? 'checked' : '';
          return `<label><input type="radio" name="q${idx}" value="${i}" ${checked}> ${escapeHtml(opt)}</label>`;
        }).join('<br>')}
      </div>
    `;
    questionsBox.appendChild(div);
  });

  // ボタン群をまとめて表示
  const isLastPage = currentIndex + CHUNK_SIZE >= filteredQuestions.length;
  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'buttonWrapper';
  buttonWrapper.innerHTML = `
    <button type="submit" id="nextBtn" class="submitBtn">${isLastPage ? '結果を見る' : '次の5問へ'}</button>
    <div class="quiz-controls">
      <button type="button" class="smallBtn" onclick="quitAndShowResults()">ここまでの回答を見て終了</button>
      <button type="button" class="smallBtn" onclick="returnToTop()">トップページに戻る</button>
    </div>
  `;
  questionsBox.appendChild(buttonWrapper);
}

// --- 回答保存と次ページ ---
function savePageAnswers() {
  const pageQuestions = filteredQuestions.slice(currentIndex, currentIndex + CHUNK_SIZE);
  pageQuestions.forEach((q, idx) => {
    const radios = quizForm.querySelectorAll(`input[name="q${idx}"]`);
    const checked = Array.from(radios).find(r => r.checked);
    const globalIndex = currentIndex + idx;
    userAnswers[globalIndex] = checked ? parseInt(checked.value) : null;
  });

  currentIndex += CHUNK_SIZE;
  if (currentIndex >= filteredQuestions.length) {
    calculateFinalScore();
  } else {
    renderQuestionsPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// --- 中断して結果を見る ---
function quitAndShowResults() {
  if (confirm('ここまでの回答結果を表示して終了しますか？')) {
    calculateFinalScore();
  }
}

// --- トップページに戻る ---
function returnToTop() {
  if (confirm('トップページに戻りますか？（進行状況は失われます）')) {
    restart();
  }
}

// --- 一括採点 ---
function calculateFinalScore() {
  totalCorrect = 0;
  totalAnswered = 0;
  const feedbackParts = [];

  filteredQuestions.forEach((q, idx) => {
    const userIdx = userAnswers[idx];
    const answered = userIdx !== null;
    if (answered) totalAnswered++;

    const correct = userIdx === q.answer;
    if (correct) totalCorrect++;

    const optionsList = q.options.map((opt, i) => {
      const isAns = i === q.answer;
      const isUser = i === userIdx;
      const style = isAns ? 'style="font-weight:bold;color:#2e7d32;"' : '';
      const tag = isAns ? '✅ 正解' : (isUser ? '（あなたの選択）' : '');
      return `<li ${style}>${escapeHtml(opt)} ${tag}</li>`;
    }).join('');

    feedbackParts.push(`
      <div class="explanation">
        <h3 class="${correct ? 'correct' : 'wrong'}">${correct ? '✅ 正解' : '❌ 不正解'}</h3>
        <p><b>Q${idx + 1}:</b> ${escapeHtml(q.q)}</p>
        <ul>${optionsList}</ul>
        ${q.explanation_short ? `<p><b>解説:</b> ${escapeHtml(q.explanation_short)}</p>` : ''}
      </div>
    `);
  });

  const accuracy = totalAnswered
    ? ((totalCorrect / totalAnswered) * 100).toFixed(1)
    : '0.0';

  hide(quizForm);
  resultBox.innerHTML = `
    <h2>結果</h2>
    <p>ジャンル: ${labelCategory(selectedCategory)}</p>
    <p>出題数: ${questionCount}問</p>
    <p>正答率: ${accuracy}%（${totalCorrect}/${totalAnswered}）</p>
    <hr>
    ${feedbackParts.join('')}
    <div style="margin-top:16px;">
      <button class="restartBtn" onclick="restart()">トップページに戻る</button>
    </div>
  `;
  show(resultBox);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 再スタート ---
function restart() {
  selectedCategory = '';
  allQuestions = [];
  filteredQuestions = [];
  currentIndex = 0;
  totalCorrect = 0;
  totalAnswered = 0;
  userAnswers = [];
  hideGenreMenuInstant();
  showOnly(mainMenu);
  mainMenu.classList.remove('hidden');
}

// --- ユーティリティ ---
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function labelCategory(cat) {
  return {
    finance: '財務・会計',
    strategy: '経営戦略',
    marketing: 'マーケティング',
    law: '会計・法務',
    economy: '経済・金融',
    current: '時事・応用',
    mixed: '総合演習'
  }[cat] || '未選択';
}
function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
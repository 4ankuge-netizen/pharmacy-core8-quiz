// このファイルは「画面の切り替え」と「クイズの進行」を担当します。
// 問題そのもの(疾患名・設問・選択肢など)は data.js に入っています。

const QUESTIONS_PER_QUIZ = 10; // 1回のクイズで出す問題数

// 今のクイズの状態をまとめて覚えておく箱
const state = {
  diseaseId: null,
  level: null,
  questions: [], // 今回出題する問題(選択肢の順番もシャッフル済み)を入れる配列
  currentIndex: 0,
  score: 0,
  answered: false, // 今の問題にすでに答えたかどうか
  userAnswers: [], // 振り返り画面用に、選んだ答えを記録しておく
};

const LEVEL_LABELS = {
  beginner: { title: "初級", desc: "基本の薬の名前・使いみちを確認" },
  intermediate: { title: "中級", desc: "注意点・相互作用・副作用を確認" },
  advanced: { title: "上級", desc: "ガイドラインに基づく治療の考え方を確認" },
};

// ----- 画面の要素をまとめて取得 -----
const screens = {
  disease: document.getElementById("screen-disease"),
  level: document.getElementById("screen-level"),
  quiz: document.getElementById("screen-quiz"),
  result: document.getElementById("screen-result"),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

// ----- 配列の中身をランダムな順番に並べ替える(トランプを切るイメージ) -----
function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ===== 画面1: 疾患選択 =====
function renderDiseaseGrid() {
  const grid = document.getElementById("disease-grid");
  grid.innerHTML = "";
  Object.entries(QUIZ_DATA).forEach(([diseaseId, disease]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "disease-card";
    btn.innerHTML = `<span class="disease-icon">${disease.icon}</span>${disease.name}`;
    btn.addEventListener("click", () => openLevelScreen(diseaseId));
    grid.appendChild(btn);
  });
}

// ===== 画面2: レベル選択 =====
function openLevelScreen(diseaseId) {
  state.diseaseId = diseaseId;
  const disease = QUIZ_DATA[diseaseId];
  document.getElementById("level-disease-name").textContent = `${disease.icon} ${disease.name}`;

  const grid = document.getElementById("level-grid");
  grid.innerHTML = "";
  Object.entries(LEVEL_LABELS).forEach(([levelId, label]) => {
    const pool = disease.levels[levelId] || [];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `level-card level-${levelId}`;
    const outOf = Math.min(QUESTIONS_PER_QUIZ, pool.length);
    btn.innerHTML = `
      <span class="level-title">${label.title}</span>
      <span class="level-desc">${label.desc}(問題プール${pool.length}問中${outOf}問を出題)</span>
    `;
    btn.disabled = pool.length === 0;
    btn.addEventListener("click", () => startQuiz(diseaseId, levelId));
    grid.appendChild(btn);
  });

  showScreen("level");
}

document.getElementById("back-to-disease").addEventListener("click", () => showScreen("disease"));

// ===== 画面3: クイズ本体 =====
function startQuiz(diseaseId, levelId) {
  state.diseaseId = diseaseId;
  state.level = levelId;
  state.currentIndex = 0;
  state.score = 0;
  state.userAnswers = [];

  const pool = QUIZ_DATA[diseaseId].levels[levelId] || [];
  const picked = shuffle(pool).slice(0, Math.min(QUESTIONS_PER_QUIZ, pool.length));

  // 出題順だけでなく、選択肢の並び順もシャッフルしておく
  // (正解の位置を覚えられてしまわないようにするため)
  state.questions = picked.map((q) => {
    const orderedIndexes = shuffle([0, 1, 2, 3]);
    return {
      q: q.q,
      exp: q.exp,
      src: q.src,
      choices: orderedIndexes.map((i) => q.choices[i]),
      answerIndex: orderedIndexes.indexOf(q.a),
    };
  });

  showScreen("quiz");
  renderQuestion();
}

function renderQuestion() {
  state.answered = false;
  const total = state.questions.length;
  const current = state.questions[state.currentIndex];

  document.getElementById("quiz-progress").textContent = `問題 ${state.currentIndex + 1} / ${total}`;
  document.getElementById("quiz-score").textContent = `正解 ${state.score}`;
  document.getElementById("progress-fill").style.width = `${(state.currentIndex / total) * 100}%`;

  document.getElementById("question-text").textContent = current.q;

  const choicesBox = document.getElementById("choices");
  choicesBox.innerHTML = "";
  current.choices.forEach((choiceText, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.textContent = choiceText;
    btn.addEventListener("click", () => selectAnswer(index));
    choicesBox.appendChild(btn);
  });

  document.getElementById("feedback").hidden = true;
}

function selectAnswer(chosenIndex) {
  if (state.answered) return; // 一度答えたら、もう選び直せないようにする
  state.answered = true;

  const current = state.questions[state.currentIndex];
  const isCorrect = chosenIndex === current.answerIndex;
  if (isCorrect) state.score += 1;

  state.userAnswers.push({
    q: current.q,
    choices: current.choices,
    answerIndex: current.answerIndex,
    chosenIndex,
    exp: current.exp,
    src: current.src,
    isCorrect,
  });

  // 選んだボタン・正解のボタンに色をつける
  const buttons = document.querySelectorAll("#choices .choice-btn");
  buttons.forEach((btn, index) => {
    btn.disabled = true;
    if (index === current.answerIndex) btn.classList.add("correct");
    else if (index === chosenIndex) btn.classList.add("wrong");
  });

  const feedback = document.getElementById("feedback");
  const resultEl = document.getElementById("feedback-result");
  resultEl.textContent = isCorrect ? "○ 正解です" : "× 不正解です";
  resultEl.className = `feedback-result ${isCorrect ? "is-correct" : "is-wrong"}`;
  document.getElementById("feedback-explanation").textContent = current.exp;
  document.getElementById("feedback-source").textContent = `出題材料: ${current.src}`;
  feedback.hidden = false;

  document.getElementById("quiz-score").textContent = `正解 ${state.score}`;
}

document.getElementById("next-btn").addEventListener("click", () => {
  state.currentIndex += 1;
  if (state.currentIndex >= state.questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
});

// ===== 画面4: 結果・振り返り =====
function showResult() {
  document.getElementById("progress-fill").style.width = "100%";

  const total = state.questions.length;
  const disease = QUIZ_DATA[state.diseaseId];
  const levelLabel = LEVEL_LABELS[state.level].title;

  document.getElementById("result-heading").textContent = `${disease.icon} ${disease.name}(${levelLabel})の結果`;
  document.getElementById("result-score").textContent = `${state.score} / ${total} 問 正解`;

  const list = document.getElementById("review-list");
  list.innerHTML = "";
  state.userAnswers.forEach((answer, i) => {
    const item = document.createElement("div");
    item.className = `review-item ${answer.isCorrect ? "is-correct" : "is-wrong"}`;

    const yourAnswerText = answer.choices[answer.chosenIndex];
    const correctAnswerText = answer.choices[answer.answerIndex];

    item.innerHTML = `
      <p class="review-q">Q${i + 1}. ${answer.q}</p>
      <p class="review-your-answer ${answer.isCorrect ? "" : "is-wrong"}">あなたの回答: ${yourAnswerText}</p>
      ${answer.isCorrect ? "" : `<p class="review-correct-answer">正解: ${correctAnswerText}</p>`}
      <p class="review-explanation">${answer.exp}</p>
      <p class="review-source">出題材料: ${answer.src}</p>
    `;
    list.appendChild(item);
  });

  showScreen("result");
}

document.getElementById("retry-btn").addEventListener("click", () => {
  startQuiz(state.diseaseId, state.level);
});

document.getElementById("change-level-btn").addEventListener("click", () => {
  openLevelScreen(state.diseaseId);
});

document.getElementById("change-disease-btn").addEventListener("click", () => {
  showScreen("disease");
});

// ----- 起動時の初期表示 -----
renderDiseaseGrid();
showScreen("disease");

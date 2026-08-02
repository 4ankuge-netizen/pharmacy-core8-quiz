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
  profile: document.getElementById("screen-profile"),
  disease: document.getElementById("screen-disease"),
  level: document.getElementById("screen-level"),
  quiz: document.getElementById("screen-quiz"),
  result: document.getElementById("screen-result"),
  history: document.getElementById("screen-history"),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

// ----- 進行状況を「錠剤シート(PTPシート)」の丸10個で表示する -----
// クイズが始まるタイミングで、問題数と同じ数だけ丸(blister-cell)を作る。
function renderBlisterStrip(total) {
  const strip = document.getElementById("blister-strip");
  strip.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const cell = document.createElement("span");
    cell.className = "blister-cell";
    strip.appendChild(cell);
  }
}

// 「今どの問題を解いているか」を、丸に青いリングをつけて示す
function markBlisterCurrent(index) {
  const cells = document.querySelectorAll("#blister-strip .blister-cell");
  cells.forEach((cell, i) => {
    cell.classList.toggle("is-current", i === index);
  });
}

// 答え終わった問題の丸を、正解なら緑・不正解なら赤に塗りつぶす
function markBlisterAnswered(index, isCorrect) {
  const cells = document.querySelectorAll("#blister-strip .blister-cell");
  const cell = cells[index];
  if (!cell) return;
  cell.classList.remove("is-current");
  cell.classList.add(isCorrect ? "is-correct" : "is-wrong");
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

// ===================================================================
// プロフィール(ニックネーム)・解答履歴
//
// このアプリはサーバーを持たない静的サイトなので、ログインの代わりに
// 「ニックネーム」だけをキーにして、ブラウザのlocalStorage(この端末・
// このブラウザだけに残る保存領域)に解答履歴を分けて記録します。
// 同じ端末を複数人で使う場合でも、ニックネームを選び直せば履歴が混ざりません。
// ただし別の端末には自動で引き継がれないため、エクスポート/インポート機能で
// JSONファイルとして持ち運べるようにしています。
// ===================================================================
const STORAGE_KEY = "quiz_app_data_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currentProfile: null, profiles: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { currentProfile: null, profiles: {} };
    if (!parsed.profiles || typeof parsed.profiles !== "object") parsed.profiles = {};
    return parsed;
  } catch (e) {
    return { currentProfile: null, profiles: {} };
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    // 保存領域の上限などで失敗しても、アプリ自体は動き続けられるようにする
    console.warn("解答履歴の保存に失敗しました", e);
  }
}

const store = loadStore();

function ensureProfile(name) {
  if (!store.profiles[name]) {
    store.profiles[name] = { createdAt: new Date().toISOString(), history: [] };
  }
  store.currentProfile = name;
  saveStore();
}

function getCurrentHistory() {
  if (!store.currentProfile || !store.profiles[store.currentProfile]) return [];
  return store.profiles[store.currentProfile].history;
}

function addHistoryRecord(record) {
  if (!store.currentProfile) return;
  ensureProfile(store.currentProfile);
  store.profiles[store.currentProfile].history.unshift(record);
  saveStore();
}

function makeRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ----- プロフィール表示バー(現在のニックネーム・履歴/切替ボタン) -----
function updateProfileBadge() {
  const bar = document.getElementById("profile-bar");
  const nameEl = document.getElementById("profile-bar-name");
  if (store.currentProfile) {
    bar.hidden = false;
    nameEl.textContent = `👤 ${store.currentProfile}`;
  } else {
    bar.hidden = true;
  }
}

// ===== 画面0: プロフィール(ニックネーム)選択 =====
function renderProfileScreen() {
  const wrap = document.getElementById("profile-list-wrap");
  const list = document.getElementById("profile-list");
  list.innerHTML = "";

  const names = Object.keys(store.profiles);
  wrap.hidden = names.length === 0;

  names.forEach((name) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "profile-btn";

    const nameEl = document.createElement("span");
    nameEl.className = "profile-name";
    nameEl.textContent = name; // textContentなのでHTMLとして解釈されず安全

    const metaEl = document.createElement("span");
    metaEl.className = "profile-meta";
    const count = store.profiles[name].history.length;
    metaEl.textContent = `解答履歴 ${count}件`;

    btn.appendChild(nameEl);
    btn.appendChild(metaEl);
    btn.addEventListener("click", () => selectProfile(name));
    list.appendChild(btn);
  });
}

function selectProfile(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  ensureProfile(trimmed);
  updateProfileBadge();
  showScreen("disease");
}

document.getElementById("profile-create-btn").addEventListener("click", () => {
  const input = document.getElementById("profile-name-input");
  if (!input.value.trim()) {
    input.focus();
    return;
  }
  selectProfile(input.value);
  input.value = "";
});

document.getElementById("profile-name-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("profile-create-btn").click();
  }
});

document.getElementById("switch-profile-btn").addEventListener("click", () => {
  renderProfileScreen();
  showScreen("profile");
});

// ===== 画面5: 解答履歴 =====
function renderHistoryScreen() {
  document.getElementById("history-profile-label").textContent = store.currentProfile
    ? `プロフィール: ${store.currentProfile}`
    : "プロフィールが未設定です";

  const history = getCurrentHistory();
  document.getElementById("history-empty").hidden = history.length !== 0;

  const list = document.getElementById("history-list");
  list.innerHTML = "";
  history.forEach((rec) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const line1 = document.createElement("p");
    line1.className = "history-line1";
    line1.textContent = `${rec.diseaseIcon} ${rec.diseaseName}(${rec.levelLabel})`;

    const line2 = document.createElement("p");
    line2.className = "history-line2";
    const d = new Date(rec.ts);
    const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    line2.textContent = `${rec.score} / ${rec.total} 問正解 ・ ${dateStr}`;

    item.appendChild(line1);
    item.appendChild(line2);
    list.appendChild(item);
  });
}

document.getElementById("view-history-btn").addEventListener("click", () => {
  renderHistoryScreen();
  showScreen("history");
});

document.getElementById("back-from-history").addEventListener("click", () => showScreen("disease"));

// ----- エクスポート(現在のプロフィールの履歴をJSONファイルとして保存) -----
document.getElementById("export-history-btn").addEventListener("click", () => {
  if (!store.currentProfile) return;
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: store.currentProfile,
    history: getCurrentHistory(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quiz-history-${store.currentProfile}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ----- インポート(別の端末で書き出したJSONファイルを読み込んで合流) -----
document.getElementById("import-history-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload || !Array.isArray(payload.history)) throw new Error("invalid format");

      const targetName = typeof payload.profile === "string" && payload.profile.trim()
        ? payload.profile.trim()
        : "インポート";
      ensureProfile(targetName);

      const existingIds = new Set(store.profiles[targetName].history.map((h) => h.id));
      let added = 0;
      payload.history.forEach((rec) => {
        if (rec && rec.id && !existingIds.has(rec.id)) {
          store.profiles[targetName].history.push(rec);
          existingIds.add(rec.id);
          added += 1;
        }
      });
      store.profiles[targetName].history.sort((a, b) => b.ts - a.ts);
      store.currentProfile = targetName;
      saveStore();

      updateProfileBadge();
      renderHistoryScreen();
      alert(`「${targetName}」の履歴に${added}件を追加しました(重複分は除いています)。`);
    } catch (err) {
      alert("読み込みに失敗しました。このアプリの「エクスポート」で保存したJSONファイルを選択してください。");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

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
      <span class="level-desc">${label.desc}(問題プール<span class="mono-num">${pool.length}</span>問中<span class="mono-num">${outOf}</span>問を出題)</span>
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

  renderBlisterStrip(state.questions.length); // 錠剤シートの丸を、問題数ぶん新しく並べ直す

  showScreen("quiz");
  renderQuestion();
}

function renderQuestion() {
  state.answered = false;
  const total = state.questions.length;
  const current = state.questions[state.currentIndex];

  // 数字の部分だけ mono-num クラスで等幅フォントにする(検査値の印字のような見た目にするため)
  document.getElementById("quiz-progress").innerHTML =
    `問題 <span class="mono-num">${state.currentIndex + 1}</span> / <span class="mono-num">${total}</span>`;
  document.getElementById("quiz-score").innerHTML =
    `正解 <span class="mono-num">${state.score}</span>`;
  markBlisterCurrent(state.currentIndex);

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
  markBlisterAnswered(state.currentIndex, isCorrect); // シートの丸を正解=緑/不正解=赤に塗る

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

  document.getElementById("quiz-score").innerHTML = `正解 <span class="mono-num">${state.score}</span>`;
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
  const total = state.questions.length;
  const disease = QUIZ_DATA[state.diseaseId];
  const levelLabel = LEVEL_LABELS[state.level].title;

  document.getElementById("result-heading").textContent = `${disease.icon} ${disease.name}(${levelLabel})の結果`;
  document.getElementById("result-score").innerHTML =
    `<span class="mono-num">${state.score}</span> / <span class="mono-num">${total}</span> 問 正解`;

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

  addHistoryRecord({
    id: makeRecordId(),
    ts: Date.now(),
    diseaseId: state.diseaseId,
    diseaseName: disease.name,
    diseaseIcon: disease.icon,
    level: state.level,
    levelLabel: levelLabel,
    score: state.score,
    total: total,
  });
  updateProfileBadge();

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
updateProfileBadge();
if (store.currentProfile) {
  showScreen("disease");
} else {
  renderProfileScreen();
  showScreen("profile");
}

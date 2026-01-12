/* =========================================================
   UNO Online — Lightweight browser table with bots
   - Human vs 3 bots, full UNO deck, draw/skip/reverse/wild effects
   - Simple turn engine with direction + pending draw handling
   - Theme toggle + keyboard shortcuts (D for theme, Space to draw)
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;

  /* ---------- Elements ---------- */
  const themeBtn = $("#themeBtn");
  const newGameBtn = $("#newGameBtn");
  const startBtn = $("#startBtn");
  const drawBtn = $("#drawBtn");
  const passBtn = $("#passBtn");
  const drawPile = $("#drawPile");
  const drawCount = $("#drawCount");
  const topCardEl = $("#topCard");
  const currentColorDot = $("#currentColor");
  const currentTurnEl = $("#currentTurn");
  const directionLabel = $("#directionLabel");
  const opponentsEl = $("#opponents");
  const handEl = $("#hand");
  const logList = $("#logList");
  const clearLogBtn = $("#clearLog");
  const gameStatus = $("#gameStatus");
  const colorChooser = $("#colorChooser");
  const colorButtons = colorChooser.querySelectorAll("button");

  /* ---------- State ---------- */
  const colors = ["red", "yellow", "green", "blue"];
  const numbers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const actions = ["skip", "reverse", "draw2"];

  const state = {
    players: [],
    deck: [],
    discard: [],
    currentPlayer: 0,
    direction: 1,
    currentColor: null,
    pendingDraw: 0,
    started: false,
    winner: null,
  };

  let pendingWild = null;

  /* ---------- Helpers ---------- */
  function $(s) {
    return document.querySelector(s);
  }
  function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved) root.setAttribute("data-theme", saved);
  }
  function toggleTheme() {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }
  function setStatus(text) {
    gameStatus.textContent = text;
  }
  function log(msg) {
    const li = document.createElement("li");
    li.textContent = msg;
    logList.appendChild(li);
    logList.scrollTop = logList.scrollHeight;
  }
  function createDeck() {
    const deck = [];
    for (const c of colors) {
      deck.push({ color: c, value: "0" });
      numbers.slice(1).forEach((n) => {
        deck.push({ color: c, value: n });
        deck.push({ color: c, value: n });
      });
      actions.forEach((a) => {
        deck.push({ color: c, value: a });
        deck.push({ color: c, value: a });
      });
    }
    for (let i = 0; i < 4; i++) {
      deck.push({ color: "wild", value: "wild" });
      deck.push({ color: "wild", value: "wild4" });
    }
    return deck;
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function drawCard() {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) return null;
      const top = state.discard.pop();
      const rest = state.discard;
      state.discard = [top];
      shuffle(rest);
      state.deck = rest;
    }
    return state.deck.pop() || null;
  }
  function drawCards(player, count) {
    for (let i = 0; i < count; i++) {
      const card = drawCard();
      if (card) player.hand.push(card);
    }
  }
  function deal() {
    logList.innerHTML = "";
    hideChooser();
    pendingWild = null;
    state.players = [
      { name: "You", type: "human", hand: [] },
      { name: "Bot Alpha", type: "bot", hand: [] },
      { name: "Bot Beta", type: "bot", hand: [] },
      { name: "Bot Gamma", type: "bot", hand: [] },
    ];
    state.deck = shuffle(createDeck());
    state.discard = [];
    state.winner = null;
    state.pendingDraw = 0;
    state.direction = 1;
    for (let i = 0; i < 7; i++) state.players.forEach((p) => drawCards(p, 1));

    let starter;
    do {
      starter = drawCard();
    } while (starter && starter.value === "wild4");
    state.discard.push(starter);
    state.currentColor =
      starter.color === "wild"
        ? colors[Math.floor(Math.random() * colors.length)]
        : starter.color;
    state.currentPlayer = 0;
    state.started = true;
    log("New match started!");
    log(`${state.players[state.currentPlayer].name} begins.`);
    render();
    continueGame();
  }
  function topCard() {
    return state.discard[state.discard.length - 1];
  }
  function playable(card) {
    const tc = topCard();
    if (!tc) return true;
    const colorMatch = card.color === state.currentColor;
    const valueMatch = card.value === tc.value;
    return colorMatch || valueMatch || card.color === "wild";
  }
  function nextPlayer() {
    const len = state.players.length;
    state.currentPlayer = (state.currentPlayer + state.direction + len) % len;
  }
  function colorToHex(c) {
    const map = {
      red: "#ff4d4d",
      yellow: "#ffd93b",
      green: "#45e26b",
      blue: "#4da3ff",
    };
    return map[c] || "#b6c0d1";
  }
  function formatValue(v) {
    if (v === "draw2") return "+2";
    if (v === "wild4") return "+4";
    if (v === "skip") return "Skip";
    if (v === "reverse") return "Reverse";
    if (v === "wild") return "Wild";
    return v;
  }
  function renderCard(card) {
    const div = document.createElement("button");
    div.type = "button";
    div.className = "uno-card";
    div.dataset.color = card.color;
    div.innerHTML = `<span class="value">${formatValue(
      card.value
    )}</span><span class="value small">${
      card.color === "wild" ? "wild" : card.color
    }</span>`;
    return div;
  }
  function render() {
    directionLabel.textContent =
      state.direction === 1 ? "Clockwise" : "Counter-clockwise";
    currentTurnEl.textContent = state.players[state.currentPlayer]?.name || "—";
    drawCount.textContent = state.deck.length || 0;

    const tc = topCard();
    if (tc) {
      topCardEl.querySelector("strong").textContent = formatValue(tc.value);
      topCardEl.style.setProperty(
        "--card-color",
        colorToHex(tc.activeColor || tc.color)
      );
      currentColorDot.style.setProperty("--c", colorToHex(state.currentColor));
    } else {
      topCardEl.querySelector("strong").textContent = "—";
      topCardEl.style.removeProperty("--card-color");
      currentColorDot.style.removeProperty("--c");
    }

    if (!state.players.length) {
      opponentsEl.innerHTML = "";
      handEl.innerHTML = "";
      return;
    }

    opponentsEl.innerHTML = "";
    state.players.forEach((p, idx) => {
      if (p.type === "bot") {
        const card = document.createElement("div");
        card.className = "opponent card";
        card.innerHTML = `
          <div class="opponent-top">
            <span class="dot"></span>
            <strong>${p.name}</strong>
          </div>
          <p class="muted small">${p.hand.length} cards</p>
        `;
        if (idx === state.currentPlayer) card.classList.add("active");
        opponentsEl.appendChild(card);
      }
    });

    handEl.innerHTML = "";
    const you = state.players[0];
    you.hand.forEach((card, idx) => {
      const btn = renderCard(card);
      const canPlay = playable(card) && state.currentPlayer === 0 && !state.winner;
      if (canPlay) btn.classList.add("playable");
      btn.addEventListener("click", () => {
        if (state.currentPlayer !== 0 || state.winner) return;
        if (!playable(card)) return;
        if (card.color === "wild") {
          pendingWild = { idx, card };
          showChooser();
          return;
        }
        playCard(0, idx, card.color);
      });
      handEl.appendChild(btn);
    });

    if (state.winner) {
      setStatus(`${state.winner} wins the match!`);
    } else if (state.started) {
      setStatus(`Playing… ${state.players[state.currentPlayer].name}'s turn.`);
    }
  }
  function showChooser() {
    colorChooser.classList.remove("hidden");
  }
  function hideChooser() {
    colorChooser.classList.add("hidden");
  }

  colorButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!pendingWild) return;
      const color = btn.dataset.color;
      playCard(0, pendingWild.idx, color);
      pendingWild = null;
      hideChooser();
    });
  });

  function playCard(playerIndex, handIndex, chosenColor) {
    const player = state.players[playerIndex];
    const card = player.hand.splice(handIndex, 1)[0];
    if (card.color === "wild") {
      state.currentColor =
        chosenColor || colors[Math.floor(Math.random() * colors.length)];
      card.activeColor = state.currentColor;
    } else {
      state.currentColor = card.color;
      card.activeColor = card.color;
    }
    state.discard.push(card);
    log(`${player.name} plays ${formatValue(card.value)} (${state.currentColor})`);

    let skipCount = 0;
    if (card.value === "skip") skipCount = 1;
    if (card.value === "reverse") {
      state.direction *= -1;
      if (state.players.length === 2) skipCount = 1;
    }
    if (card.value === "draw2") {
      state.pendingDraw = 2;
    } else if (card.value === "wild4") {
      state.pendingDraw = 4;
    }

    if (player.hand.length === 0) {
      state.winner = player.name;
    }

    if (!state.winner) {
      for (let i = 0; i <= skipCount; i++) nextPlayer();
    }
    continueGame();
  }

  function handlePendingDraw() {
    if (state.pendingDraw > 0) {
      const player = state.players[state.currentPlayer];
      drawCards(player, state.pendingDraw);
      log(
        `${player.name} draws ${state.pendingDraw} card${
          state.pendingDraw > 1 ? "s" : ""
        }.`
      );
      state.pendingDraw = 0;
      nextPlayer();
      render();
      return true;
    }
    return false;
  }

  function pickBotColor(hand) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    hand.forEach((c) => {
      if (colors.includes(c.color)) counts[c.color]++;
    });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best?.[0] || colors[Math.floor(Math.random() * colors.length)];
  }

  function botTurn() {
    if (state.winner) return;
    if (handlePendingDraw()) {
      setTimeout(() => continueGame(), 350);
      return;
    }
    const bot = state.players[state.currentPlayer];
    const playableIdx = bot.hand
      .map((c, i) => ({ c, i }))
      .filter((x) => playable(x.c));

    if (playableIdx.length) {
      const choice = playableIdx[0];
      const chosenColor =
        choice.c.color === "wild" ? pickBotColor(bot.hand) : choice.c.color;
      playCard(state.currentPlayer, choice.i, chosenColor);
      return;
    }

    drawCards(bot, 1);
    log(`${bot.name} draws a card.`);

    const newPlayable = bot.hand
      .map((c, i) => ({ c, i }))
      .filter((x) => playable(x.c));
    if (newPlayable.length) {
      const choice = newPlayable[0];
      const chosenColor =
        choice.c.color === "wild" ? pickBotColor(bot.hand) : choice.c.color;
      playCard(state.currentPlayer, choice.i, chosenColor);
      return;
    }

    log(`${bot.name} passes.`);
    nextPlayer();
    continueGame();
  }

  function continueGame(delay = 350) {
    render();
    if (state.winner) return;

    if (state.currentPlayer === 0) {
      if (handlePendingDraw()) {
        setTimeout(() => continueGame(), 350);
        return;
      }
      return;
    }
    setTimeout(botTurn, delay);
  }

  /* ---------- User actions ---------- */
  function drawForPlayer() {
    if (!state.started || state.winner) return;
    if (state.currentPlayer !== 0) return;
    drawCards(state.players[0], 1);
    log("You draw a card.");
    render();
  }
  function passTurn() {
    if (!state.started || state.winner) return;
    if (state.currentPlayer !== 0) return;
    nextPlayer();
    continueGame();
  }

  newGameBtn.addEventListener("click", deal);
  startBtn.addEventListener("click", deal);
  drawBtn.addEventListener("click", drawForPlayer);
  passBtn.addEventListener("click", passTurn);
  drawPile.addEventListener("click", drawForPlayer);
  themeBtn.addEventListener("click", toggleTheme);
  clearLogBtn.addEventListener("click", () => (logList.innerHTML = ""));

  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "d") toggleTheme();
    if (e.key === " ") {
      if (state.currentPlayer === 0) {
        e.preventDefault();
        drawForPlayer();
      }
    }
  });

  /* ---------- Init ---------- */
  initTheme();
  setStatus("Waiting to start…");
  render();
});

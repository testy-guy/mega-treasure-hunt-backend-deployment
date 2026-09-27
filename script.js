const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const API_URL = "http://127.0.0.1:8000/";

const DIFFICULTY = {
  easy: { time: 80, playerSpeed: 5, sharkSpeed: 1.6, sharkPerLevel: 1, coinBase: 3, chaseChance: 0.15 },
  medium: { time: 60, playerSpeed: 4.5, sharkSpeed: 2.4, sharkPerLevel: 1, coinBase: 6, chaseChance: 0.35 },
  hard: { time: 45, playerSpeed: 4.2, sharkSpeed: 3.2, sharkPerLevel: 2, coinBase: 12, chaseChance: 0.6 }
};

const LEVEL_THEMES = [
  "#2f8fe0",
  "#2678c4",
  "#1d5fa3",
  "#164a82",
  "#3a2f6b",
  "#241b4d"
];

let difficulty = "medium";
let settings = DIFFICULTY[difficulty];

let state = "menu";

let player = { x: 300, y: 190, size: 30, speed: 4.5 };
let coins = [];
let sharks = [];
let powerups = [];
let particles = [];

let score = 0;
let combo = 1;
let bestComboThisRun = 1;
let lastCoinTime = 0;
const COMBO_WINDOW = 1300;

let lives = 3;
let level = 1;
let timeLeft = 60;
let coinsThisRun = 0;

let shieldUntil = 0;
let speedBoostUntil = 0;
let magnetUntil = 0;
let freezeUntil = 0;
let lastPowerupSpawn = 0;

let shakeUntil = 0;
let shakeStrength = 0;

let soundOn = true;

let keys = {};
let gameLoopInterval;
let timerInterval;

let highScores = {
  easy: Number(localStorage.getItem("treasureHighScore_easy") || 0),
  medium: Number(localStorage.getItem("treasureHighScore_medium") || 0),
  hard: Number(localStorage.getItem("treasureHighScore_hard") || 0)
};

let stats = {
  gamesPlayed: Number(localStorage.getItem("treasureGamesPlayed") || 0),
  totalCoins: Number(localStorage.getItem("treasureTotalCoins") || 0),
  bestCombo: Number(localStorage.getItem("treasureBestCombo") || 1),
  deepestLevel: Number(localStorage.getItem("treasureDeepestLevel") || 1)
};

function refreshStatsPanel() {
  document.getElementById("statGames").innerText = stats.gamesPlayed;
  document.getElementById("statCoins").innerText = stats.totalCoins;
  document.getElementById("statCombo").innerText = "x" + stats.bestCombo;
  document.getElementById("statLevel").innerText = stats.deepestLevel;
}

document.getElementById("menuHighscore").innerText = highScores[difficulty];
document.querySelector('.diffBtn[data-diff="medium"]').classList.add("active");
refreshStatsPanel();

function selectDifficulty(diff) {
  difficulty = diff;
  settings = DIFFICULTY[diff];
  document.querySelectorAll(".diffBtn").forEach(b => b.classList.remove("active"));
  document.querySelector('.diffBtn[data-diff="' + diff + '"]').classList.add("active");
  document.getElementById("selectedDiffText").innerText = "selected: " + diff.toUpperCase();
  document.getElementById("menuHighscore").innerText = highScores[diff];
}

let audioCtx;
function playBeep(freq, duration, type) {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}
function coinSound() { playBeep(880, 0.1, "square"); }
function chestSound() { playBeep(1200, 0.2, "triangle"); }
function hitSound() { playBeep(120, 0.3, "sawtooth"); }
function levelUpSound() { playBeep(660, 0.15, "sine"); setTimeout(() => playBeep(990, 0.2, "sine"), 150); }
function powerupSound() { playBeep(1500, 0.15, "sine"); }
function shieldHitSound() { playBeep(500, 0.1, "triangle"); }
function bossSound() { playBeep(200, 0.25, "sawtooth"); setTimeout(() => playBeep(160, 0.3, "sawtooth"), 200); }

function toggleSound() {
  soundOn = !soundOn;
  document.getElementById("soundIcon").innerText = soundOn ? "🔊" : "🔇";
  if (soundOn) powerupSound();
}

function randomPos(size) {
  size = size || 30;
  return {
    x: Math.random() * (canvas.width - size),
    y: Math.random() * (canvas.height - size)
  };
}

function makeCoins() {
  coins = [];
  let numCoins = settings.coinBase + level;
  for (let i = 0; i < numCoins; i++) {
    let pos = randomPos(24);
    let isChest = Math.random() < 0.15;
    coins.push({ x: pos.x, y: pos.y, size: isChest ? 26 : 20, grabbed: false, isChest: isChest });
  }
}

function isBossLevel() {
  return level % 3 === 0;
}

function makeSharks() {
  sharks = [];
  let numSharks = settings.sharkPerLevel * level;
  let baseSpeed = settings.sharkSpeed + level * 0.15;

  for (let i = 0; i < numSharks; i++) {
    let pos = randomPos(30);
    sharks.push({
      x: pos.x,
      y: pos.y,
      size: 30,
      dx: (Math.random() < 0.5 ? -1 : 1) * baseSpeed,
      dy: (Math.random() < 0.5 ? -1 : 1) * baseSpeed * 0.75,
      isBoss: false
    });
  }

  if (isBossLevel()) {
    let pos = randomPos(50);
    sharks.push({
      x: pos.x,
      y: pos.y,
      size: 50,
      dx: (Math.random() < 0.5 ? -1 : 1) * (baseSpeed + 1),
      dy: (Math.random() < 0.5 ? -1 : 1) * (baseSpeed + 0.5),
      isBoss: true
    });
    bossSound();
    showBossWarning();
  }
}

function showBossWarning() {
  let el = document.getElementById("bossWarning");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2500);
}

function maybeSpawnPowerup(now) {
  if (powerups.length > 0) return;
  if (now - lastPowerupSpawn < 6000) return;
  if (Math.random() < 0.02) {
    let pos = randomPos(24);
    let roll = Math.random();
    let type = roll < 0.28 ? "star" : roll < 0.52 ? "shield" : roll < 0.74 ? "magnet" : roll < 0.9 ? "freeze" : "clock";
    powerups.push({ x: pos.x, y: pos.y, size: 24, type: type, spawnedAt: now });
    lastPowerupSpawn = now;
  }
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4 - 1,
      life: 30,
      color: color
    });
  }
}

function triggerShake(strength, duration) {
  shakeStrength = strength;
  shakeUntil = Date.now() + duration;
}

document.addEventListener("keydown", function(e) {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " " && state === "playing") togglePause();
  if (e.key === " " && state === "paused") togglePause();
});
document.addEventListener("keyup", function(e) {
  keys[e.key.toLowerCase()] = false;
});

document.querySelectorAll(".touchBtn").forEach(btn => {
  const k = btn.getAttribute("data-key");
  const press = e => { e.preventDefault(); keys[k] = true; };
  const release = e => { e.preventDefault(); keys[k] = false; };
  btn.addEventListener("touchstart", press);
  btn.addEventListener("touchend", release);
  btn.addEventListener("touchcancel", release);
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
});

if ("ontouchstart" in window) {
  document.getElementById("touchControls").classList.remove("hidden");
}

function movePlayer() {
  let now = Date.now();
  let spd = now < speedBoostUntil ? player.speed * 1.8 : player.speed;

  if (keys["arrowup"] || keys["w"]) player.y -= spd;
  if (keys["arrowdown"] || keys["s"]) player.y += spd;
  if (keys["arrowleft"] || keys["a"]) player.x -= spd;
  if (keys["arrowright"] || keys["d"]) player.x += spd;

  if (player.x < 0) player.x = 0;
  if (player.y < 0) player.y = 0;
  if (player.x > canvas.width - player.size) player.x = canvas.width - player.size;
  if (player.y > canvas.height - player.size) player.y = canvas.height - player.size;
}

function moveSharks() {
  let now = Date.now();
  if (now < freezeUntil) return;

  sharks.forEach(shark => {
    let chaseFactor = shark.isBoss ? settings.chaseChance * 1.6 : settings.chaseChance;
    if (Math.random() < 0.02 * chaseFactor * 10) {
      shark.dx = shark.x < player.x ? Math.abs(shark.dx) : -Math.abs(shark.dx);
      shark.dy = shark.y < player.y ? Math.abs(shark.dy) : -Math.abs(shark.dy);
    }
    shark.x += shark.dx;
    shark.y += shark.dy;
    if (shark.x < 0 || shark.x > canvas.width - shark.size) shark.dx *= -1;
    if (shark.y < 0 || shark.y > canvas.height - shark.size) shark.dy *= -1;
  });
}

function applyMagnet(now) {
  if (now >= magnetUntil) return;
  coins.forEach(coin => {
    if (coin.grabbed) return;
    let dx = (player.x + player.size / 2) - (coin.x + coin.size / 2);
    let dy = (player.y + player.size / 2) - (coin.y + coin.size / 2);
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 160 && dist > 1) {
      coin.x += (dx / dist) * 4;
      coin.y += (dy / dist) * 4;
    }
  });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function hits(a, b) {
  return a.x < b.x + b.size &&
         a.x + a.size > b.x &&
         a.y < b.y + b.size &&
         a.y + a.size > b.y;
}

function checkCollisions() {
  let now = Date.now();

  coins.forEach(coin => {
    if (!coin.grabbed && hits(player, coin)) {
      coin.grabbed = true;
      coinsThisRun++;

      if (now - lastCoinTime < COMBO_WINDOW) {
        combo = Math.min(combo + 1, 5);
      } else {
        combo = 1;
      }
      bestComboThisRun = Math.max(bestComboThisRun, combo);
      lastCoinTime = now;
      document.getElementById("combo").innerText = "x" + combo;

      let base = coin.isChest ? 50 : 10;
      let gained = base * combo;
      score += gained;

      if (coin.isChest) {
        chestSound();
        spawnParticles(coin.x, coin.y, "gold", 14);
        showMsg("+" + gained + " CHEST! 🧰", "gold");
      } else {
        coinSound();
        spawnParticles(coin.x, coin.y, "#ffe066", 8);
      }
      document.getElementById("score").innerText = score;
    }
  });

  powerups.forEach((p, idx) => {
    if (hits(player, p)) {
      powerupSound();
      if (p.type === "star") {
        speedBoostUntil = now + 5000;
        spawnParticles(p.x, p.y, "cyan", 12);
        showMsg("⭐ SPEED BOOST!", "cyan");
      } else if (p.type === "shield") {
        shieldUntil = now + 6000;
        spawnParticles(p.x, p.y, "#66ccff", 12);
        showMsg("🛡️ SHIELD UP!", "#66ccff");
      } else if (p.type === "magnet") {
        magnetUntil = now + 6000;
        spawnParticles(p.x, p.y, "#ff66cc", 12);
        showMsg("🧲 MAGNET ON!", "#ff66cc");
      } else if (p.type === "freeze") {
        freezeUntil = now + 4000;
        spawnParticles(p.x, p.y, "#aeeeff", 12);
        showMsg("❄️ SHARKS FROZEN!", "#aeeeff");
      } else if (p.type === "clock") {
        timeLeft += 15;
        document.getElementById("time").innerText = timeLeft;
        spawnParticles(p.x, p.y, "#c9ff66", 12);
        showMsg("⏱️ +15 SECONDS!", "#c9ff66");
      }
      powerups.splice(idx, 1);
    } else if (now - p.spawnedAt > 6000) {
      powerups.splice(idx, 1);
    }
  });

  sharks.forEach(shark => {
    if (hits(player, shark)) {
      if (now < shieldUntil) {
        shieldHitSound();
        let pos = randomPos(shark.size);
        shark.x = pos.x;
        shark.y = pos.y;
        return;
      }
      lives -= shark.isBoss ? 2 : 1;
      combo = 1;
      document.getElementById("combo").innerText = "x1";
      hitSound();
      triggerShake(6, 250);
      spawnParticles(player.x, player.y, "red", 16);
      updateLivesDisplay();

      let pos = randomPos(shark.size);
      shark.x = pos.x;
      shark.y = pos.y;
      player.x = canvas.width / 2 - 15;
      player.y = canvas.height / 2 - 15;

      shieldUntil = now + 2000;

      if (lives <= 0) {
        endGame(false);
      } else {
        showMsg(shark.isBoss ? "BOSS HIT U! -2 LIVES" : "OUCH! " + lives + " lives left", "#ff6666");
      }
    }
  });

  if (coins.every(c => c.grabbed) && state === "playing") {
    levelUp();
  }
}

function levelUp() {
  level += 1;
  levelUpSound();
  showMsg("LEVEL " + level + "!! hang on tight", "cyan");
  document.getElementById("level").innerText = level;
  timeLeft += 15;
  makeCoins();
  makeSharks();
}

function updateLivesDisplay() {
  let hearts = "";
  for (let i = 0; i < lives; i++) hearts += "💗";
  document.getElementById("lives").innerText = hearts || "💔";
}

function showMsg(text, color) {
  let box = document.getElementById("msgBox");
  box.innerText = text;
  box.style.color = color || "#7CFC00";
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => {
    if (box.innerText === text) box.innerText = "";
  }, 1400);
}

function draw() {
  let now = Date.now();
  ctx.save();

  if (now < shakeUntil) {
    let dx = (Math.random() - 0.5) * shakeStrength;
    let dy = (Math.random() - 0.5) * shakeStrength;
    ctx.translate(dx, dy);
  }

  let themeIndex = Math.min(level - 1, LEVEL_THEMES.length - 1);
  ctx.fillStyle = LEVEL_THEMES[themeIndex];
  ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 45 + i * 75);
    ctx.lineTo(canvas.width, 45 + i * 75);
    ctx.stroke();
  }

  coins.forEach(coin => {
    if (!coin.grabbed) {
      ctx.font = (coin.isChest ? "28px" : "22px") + " Arial";
      ctx.fillText(coin.isChest ? "🧰" : "💰", coin.x, coin.y + 20);
    }
  });

  powerups.forEach(p => {
    let icon = p.type === "star" ? "⭐" : p.type === "shield" ? "🛡️" : p.type === "magnet" ? "🧲" : p.type === "freeze" ? "❄️" : "⏱️";
    ctx.font = "26px Arial";
    ctx.fillText(icon, p.x, p.y + 20);
  });

  sharks.forEach(shark => {
    ctx.font = (shark.isBoss ? "46px" : "28px") + " Arial";
    ctx.fillText(shark.isBoss ? "🦈👑" : "🦈", shark.x, shark.y + (shark.isBoss ? 36 : 20));
  });

  if (now < shieldUntil) {
    ctx.beginPath();
    ctx.arc(player.x + 15, player.y + 15, 22, 0, Math.PI * 2);
    ctx.strokeStyle = "#66ccff";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (now < speedBoostUntil) {
    ctx.beginPath();
    ctx.arc(player.x + 15, player.y + 15, 19, 0, Math.PI * 2);
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (now < magnetUntil) {
    ctx.beginPath();
    ctx.arc(player.x + 15, player.y + 15, 25, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff66cc";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.font = "28px Arial";
  ctx.fillText("🏴‍☠️", player.x, player.y + 20);

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(p.life / 30, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  if (now < freezeUntil) {
    ctx.fillStyle = "rgba(150, 220, 255, 0.12)";
    ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);
  }

  ctx.restore();
}

function gameLoop() {
  if (state !== "playing") return;
  let now = Date.now();
  movePlayer();
  moveSharks();
  maybeSpawnPowerup(now);
  applyMagnet(now);
  checkCollisions();
  updateParticles();
  draw();
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    document.getElementById("pauseOverlay").classList.remove("hidden");
  } else if (state === "paused") {
    state = "playing";
    document.getElementById("pauseOverlay").classList.add("hidden");
  }
}

function buildAchievements(won) {
  let msgs = [];
  if (bestComboThisRun >= 5) msgs.push("🔥 COMBO MASTER - hit max combo!");
  if (coinsThisRun >= 20) msgs.push("💰 TREASURE HOARDER - grabbed 20+ treasure!");
  if (level >= 4) msgs.push("🌊 DEEP DIVER - reached level " + level + "!");
  if (won && lives === 3) msgs.push("🛟 UNTOUCHABLE - survived with full lives!");
  return msgs;
}

function endGame(won) {
  clearInterval(timerInterval);
  clearInterval(gameLoopInterval);
  state = "gameover";

  stats.gamesPlayed++;
  stats.totalCoins += coinsThisRun;
  stats.bestCombo = Math.max(stats.bestCombo, bestComboThisRun);
  stats.deepestLevel = Math.max(stats.deepestLevel, level);
  localStorage.setItem("treasureGamesPlayed", stats.gamesPlayed);
  localStorage.setItem("treasureTotalCoins", stats.totalCoins);
  localStorage.setItem("treasureBestCombo", stats.bestCombo);
  localStorage.setItem("treasureDeepestLevel", stats.deepestLevel);
  refreshStatsPanel();

  let isNewHigh = score > highScores[difficulty];
  if (isNewHigh) {
    highScores[difficulty] = score;
    localStorage.setItem("treasureHighScore_" + difficulty, score);
    document.getElementById("highscore").innerText = score;
  }

  addScore(score);
  loadLeaderBoard();

  document.getElementById("gameOverTitle").innerText = won ? "TIME UP!" : "GAME OVER";
  document.getElementById("gameOverStats").innerHTML =
    "you scored <b>" + score + "</b> points and reached level <b>" + level + "</b> on " + difficulty.toUpperCase() +
    (isNewHigh ? "<br>🏆 NEW HIGH SCORE!!" : "<br>best on " + difficulty + ": " + highScores[difficulty]);

  let achievements = buildAchievements(won);
  document.getElementById("achievementBox").innerHTML = achievements.join("<br>");

  document.getElementById("gameOverOverlay").classList.remove("hidden");
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("controls").classList.add("hidden");
  document.getElementById("touchControls").classList.add("hidden");
}

function backToMenu() {
  clearInterval(timerInterval);
  clearInterval(gameLoopInterval);
  state = "menu";
  document.getElementById("gameOverOverlay").classList.add("hidden");
  document.getElementById("pauseOverlay").classList.add("hidden");
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("controls").classList.add("hidden");
  document.getElementById("touchControls").classList.add("hidden");
  document.getElementById("menuOverlay").classList.remove("hidden");
  document.getElementById("menuHighscore").innerText = highScores[difficulty];
  refreshStatsPanel();
}

function startGame() {
  document.getElementById("menuOverlay").classList.add("hidden");
  document.getElementById("gameOverOverlay").classList.add("hidden");
  document.getElementById("pauseOverlay").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  document.getElementById("controls").classList.remove("hidden");
  if ("ontouchstart" in window) document.getElementById("touchControls").classList.remove("hidden");

  score = 0;
  combo = 1;
  bestComboThisRun = 1;
  coinsThisRun = 0;
  lives = 3;
  level = 1;
  timeLeft = settings.time;
  shieldUntil = 0;
  speedBoostUntil = 0;
  magnetUntil = 0;
  freezeUntil = 0;
  lastPowerupSpawn = 0;
  powerups = [];
  particles = [];
  player.speed = settings.playerSpeed;
  player.x = canvas.width / 2 - 15;
  player.y = canvas.height / 2 - 15;

  document.getElementById("score").innerText = score;
  document.getElementById("combo").innerText = "x1";
  document.getElementById("level").innerText = level;
  document.getElementById("time").innerText = timeLeft;
  document.getElementById("highscore").innerText = highScores[difficulty];
  updateLivesDisplay();

  makeCoins();
  makeSharks();

  clearInterval(gameLoopInterval);
  clearInterval(timerInterval);

  state = "playing";
  gameLoopInterval = setInterval(gameLoop, 30);
  timerInterval = setInterval(function() {
    if (state !== "playing") return;
    timeLeft--;
    document.getElementById("time").innerText = timeLeft;
    if (timeLeft <= 0) {
      endGame(true);
    }
  }, 1000);

  showMsg("GO GO GO!!", "#7CFC00");
}

async function getLeaderBoardData(){
  try {
    let request = await fetch(API_URL+"top10/");

    let data = await request.json();

    return data;

  }
  catch(e){
    console.log("an error occured: " + e);
    return null;
  }
}

async function getPrLeaderBoardData() {
  try {
    let request = await fetch(API_URL+"top5pr/"+localStorage.getItem("username"));

    let data = await request.json();

    console.log(data);

    return data;
  }
  catch(e) {
    console.log("an error has occured: " + e);
    return null;
  }
}

async function loadLeaderBoard(){
  let data = await getLeaderBoardData();

  if (data === null){
    let leaderBoardHtml = `
    <div class="no-records">
      No records yet :(
    </div>`;
    document.getElementById("leaderBoard").innerHTML = leaderBoardHtml;
    return;
  } 

  let leaderBoardHtml = "";

  leaderBoardHtml += `
    <h1>Leader Board</h1>
  `

  for (let i = 0; i < data.length; i++){
    leaderBoardHtml += `
      <div class="leaderBoardScore">
        <span class="rank ${i==0 ? "first" :( ((i == 1) ? "second" : ((i==2) ? "third" : "" )))}">${i+1}-</span>
        <span class="scoreUsername">${data[i].username}: </span>
        <span class="scoreScore">${data[i].score}</span>
        <span class="scoreDifficulty ${data[i].difficulty}">${data[i].difficulty}</span>
      </div>
    `;
  }

  leaderBoardHtml += `
    <p>want to know how they got there? read thier notes <a href="notes.html">here!</a></p>
  `

  document.getElementById("leaderBoard").innerHTML = leaderBoardHtml;
  return;
}

async function loadPrLeaderBoard() {
  let data = await getPrLeaderBoardData();

  if (data === null){
    let leaderBoardHtml =
    `
    <div>
      No personal records yet :(
    </div>
    `;
    document.getElementById("prLeaderBoard").innerHTML = leaderBoardHtml;
    return;
  }

  let leaderBoardHtml = "";

  leaderBoardHtml += "<h1>Pr Leader Board</h1>"

  for (let i = 0; i < data.length; i++){
    leaderBoardHtml += `
    <div class="leaderBoardScore">
      <span class="rank ${i == 1 ? "first": i == 2 ? "second": i == 3 ? "third" : ""}">${i+1}-</span>
      <span class=scoreScore>${data[i].score}</span>
      <span class="scoreDifficulty ${data[i].difficulty}">${data[i].difficulty}</span>
    </div>
    `;
  }

  document.getElementById("prLeaderBoard").innerHTML = leaderBoardHtml;
  return;
}

function checkName(){
  if (localStorage.getItem("username")){
    document.getElementById("nameForm").classList.add("hidden");
    document.getElementById("main").classList.remove("hidden")
  }
}

function confirmUsername(){
  let name = document.getElementById("nameInput").value.trim();
  if (name.length < 3) {
    document.getElementById("msg").innerHTML = "Name must be atleast 3 characters long";
    return;
  }
  if (name.length > 20) {
    document.getElementById("msg").innerHTML = "Name must be atmost 20 characters long";
    return;
  }

  localStorage.setItem("username", name);
  checkName();
}

async function addScore(score){
  try {
    let request = await fetch(API_URL+"add_score/", {
      method: "POST",
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        username: localStorage.getItem("username"),
        score: score,
        difficulty: difficulty
      })
    });

    let data = await request.json()
  }
  catch(e){
    console.log("an error has occured: ", e)
  }
}

document.addEventListener("DOMContentLoaded", async function (e){
  e.preventDefault();
  checkName();
  await loadLeaderBoard();
  await loadPrLeaderBoard();
})

draw();
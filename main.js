"use strict";

const video = document.getElementById("camera");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

const ui = {
  levelState: document.getElementById("levelState"),
  score: document.getElementById("score"),
  health: document.getElementById("health"),
  shieldState: document.getElementById("shieldState"),
  timeLeft: document.getElementById("timeLeft"),
  weaponState: document.getElementById("weaponState"),
  comboState: document.getElementById("comboState"),
  bestState: document.getElementById("bestState"),
  trackingState: document.getElementById("trackingState"),
  notice: document.getElementById("notice"),
  startBtn: document.getElementById("startBtn"),
  difficultySelect: document.getElementById("difficultySelect"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  calibrateBtn: document.getElementById("calibrateBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  restartBtn: document.getElementById("restartBtn"),
  levelOverlay: document.getElementById("levelOverlay"),
  summaryTitle: document.getElementById("summaryTitle"),
  summaryStats: document.getElementById("summaryStats"),
  summaryCountdown: document.getElementById("summaryCountdown"),
  upgradeChoices: document.getElementById("upgradeChoices"),
  nextLevelBtn: document.getElementById("nextLevelBtn"),
};

const CDN = {
  hands: "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
  assets: "https://cdn.jsdelivr.net/npm/@mediapipe/hands/",
};

const GAME = {
  attackRadius: 74,
  playerRadius: 82,
  maxLevel: 10,
  maxHealth: 100,
  maxShield: 30,
  shieldRecoverDelayMs: 2000,
  shieldRecoverPerSecond: 11,
  roundSeconds: 180,
  difficultySeconds: {
    easy: 60,
    normal: 180,
    hard: 300,
  },
  intermissionSeconds: 30,
  calibrationSeconds: 5,
  gunGap: 62,
  defenseLineOffset: 132,
  weaponDurationMs: 12000,
  maxMonsters: 38,
  maxBullets: 96,
  maxEnemyBullets: 80,
  maxParticles: 380,
  maxFloatingTexts: 60,
  comboWindowMs: 1800,
  aimAssistRadius: 68,
  nearHitBonus: 14,
};

const DIFFICULTY_ENEMY_ATTACK = {
  easy: { cooldown: 1.45, damage: 0.68, speed: 0.82 },
  normal: { cooldown: 1.12, damage: 0.9, speed: 0.92 },
  hard: { cooldown: 0.86, damage: 1.18, speed: 1.02 },
};

const ENEMY_ATTACKS = {
  grunt: { cooldown: 3300, damage: 3, speed: 205, radius: 5, color: "#b8ff8a", spread: 0, volley: 1 },
  fast: { cooldown: 1950, damage: 2, speed: 270, radius: 4, color: "#59c8f2", spread: 0, volley: 1 },
  charger: { cooldown: 2350, damage: 5, speed: 245, radius: 7, color: "#ffab62", spread: 0, volley: 1 },
  tank: { cooldown: 3650, damage: 7, speed: 190, radius: 9, color: "#ff7979", spread: 0.08, volley: 2 },
  dodger: { cooldown: 2150, damage: 3, speed: 255, radius: 5, color: "#c78dff", spread: 0, volley: 1 },
  boss: { cooldown: 1350, damage: 6, speed: 230, radius: 8, color: "#ff5b7e", spread: 0.11, volley: 3 },
};

const SPRITE_SHEET = {
  src: "./assets/alien_sprites.png",
  rects: {
    grunt: { x: 52, y: 70, w: 250, h: 170 },
    fast: { x: 382, y: 64, w: 260, h: 192 },
    charger: { x: 712, y: 70, w: 240, h: 196 },
    tank: { x: 42, y: 382, w: 282, h: 204 },
    dodger: { x: 382, y: 400, w: 278, h: 194 },
    boss: { x: 30, y: 704, w: 314, h: 190 },
    weapon: { x: 420, y: 710, w: 210, h: 184 },
    health: { x: 742, y: 704, w: 210, h: 202 },
  },
};

const spriteSheet = new Image();
let spriteSheetReady = false;
spriteSheet.onload = () => {
  spriteSheetReady = true;
};
spriteSheet.onerror = () => {
  spriteSheetReady = false;
};
spriteSheet.src = SPRITE_SHEET.src;

const PLAYER_WEAPON_SHEET = {
  src: "./assets/player_weapon.png",
  base: { x: 54, y: 1242, w: 268, h: 170 },
  turrets: {
    normal: { x: 430, y: 64, w: 160, h: 270, drawW: 58, drawH: 112 },
    rapid: { x: 418, y: 462, w: 190, h: 214, drawW: 70, drawH: 96 },
    spread: { x: 744, y: 452, w: 150, h: 218, drawW: 74, drawH: 98 },
    laser: { x: 120, y: 820, w: 164, h: 250, drawW: 70, drawH: 108 },
    flame: { x: 442, y: 820, w: 160, h: 250, drawW: 72, drawH: 108 },
    double: { x: 744, y: 830, w: 220, h: 238, drawW: 84, drawH: 108 },
  },
};

const playerWeaponSheet = new Image();
let playerWeaponSheetReady = false;
playerWeaponSheet.onload = () => {
  playerWeaponSheetReady = true;
};
playerWeaponSheet.onerror = () => {
  playerWeaponSheetReady = false;
};
playerWeaponSheet.src = PLAYER_WEAPON_SHEET.src;

const WEAPONS = {
  normal: {
    id: "normal",
    label: "普通 N",
    icon: "N",
    fireEveryMs: 145,
    damage: 12,
    bulletSpeed: 690,
    bulletRadius: 6,
    color: "#56d5e2",
    pellets: [0],
  },
  rapid: {
    id: "rapid",
    label: "机枪 M",
    icon: "M",
    fireEveryMs: 78,
    damage: 8,
    bulletSpeed: 790,
    bulletRadius: 4,
    color: "#f4f8fb",
    pellets: [0],
  },
  spread: {
    id: "spread",
    label: "散弹 S",
    icon: "S",
    fireEveryMs: 235,
    damage: 7,
    bulletSpeed: 640,
    bulletRadius: 5,
    color: "#f6c84c",
    pellets: [-0.18, -0.09, 0, 0.09, 0.18],
  },
  laser: {
    id: "laser",
    label: "激光 L",
    icon: "L",
    fireEveryMs: 275,
    damage: 32,
    bulletSpeed: 910,
    bulletRadius: 5,
    color: "#6bf2ff",
    pellets: [0],
    beam: true,
    pierce: 2,
  },
  flame: {
    id: "flame",
    label: "火焰 F",
    icon: "F",
    fireEveryMs: 210,
    damage: 22,
    bulletSpeed: 560,
    bulletRadius: 13,
    color: "#ff884d",
    pellets: [0],
    splashRadius: 34,
  },
  double: {
    id: "double",
    label: "双发 D",
    icon: "D",
    fireEveryMs: 150,
    damage: 11,
    bulletSpeed: 720,
    bulletRadius: 6,
    color: "#b68cff",
    pellets: [0],
    sideOffsets: [-10, 10],
  },
};

const DROP_WEAPONS = ["rapid", "spread", "laser", "flame", "double"];

const LEVEL_THEMES = [
  { name: "训练", bias: { grunt: 0.76, fast: 0.12, tank: 0.08, charger: 0.04, dodger: 0 }, hp: 0.9, speed: 0.88, weapon: 1.05, health: 1.2 },
  { name: "高速", bias: { grunt: 0.44, fast: 0.38, tank: 0.06, charger: 0.08, dodger: 0.04 }, hp: 0.95, speed: 1.08, weapon: 1, health: 1 },
  { name: "重甲", bias: { grunt: 0.42, fast: 0.1, tank: 0.36, charger: 0.08, dodger: 0.04 }, hp: 1.18, speed: 0.92, weapon: 1.12, health: 0.95 },
  { name: "突进", bias: { grunt: 0.36, fast: 0.16, tank: 0.12, charger: 0.28, dodger: 0.08 }, hp: 1.04, speed: 1.12, weapon: 1, health: 1 },
  { name: "母舰 I", bias: { grunt: 0.42, fast: 0.22, tank: 0.16, charger: 0.1, dodger: 0.1 }, hp: 1.12, speed: 1.02, weapon: 1.15, health: 1.12 },
  { name: "补给", bias: { grunt: 0.46, fast: 0.22, tank: 0.14, charger: 0.1, dodger: 0.08 }, hp: 1.05, speed: 1.05, weapon: 1.5, health: 1.08 },
  { name: "闪避", bias: { grunt: 0.34, fast: 0.16, tank: 0.12, charger: 0.08, dodger: 0.3 }, hp: 1.08, speed: 1.12, weapon: 1.05, health: 0.98 },
  { name: "短缺", bias: { grunt: 0.38, fast: 0.2, tank: 0.18, charger: 0.16, dodger: 0.08 }, hp: 1.1, speed: 1.08, weapon: 0.92, health: 0.62 },
  { name: "混战", bias: { grunt: 0.3, fast: 0.2, tank: 0.2, charger: 0.18, dodger: 0.12 }, hp: 1.16, speed: 1.14, weapon: 1, health: 0.9 },
  { name: "母舰 II", bias: { grunt: 0.24, fast: 0.22, tank: 0.22, charger: 0.18, dodger: 0.14 }, hp: 1.22, speed: 1.18, weapon: 1.12, health: 0.9 },
];

const UPGRADES = [
  { id: "maxHealth", title: "生命上限 +10", desc: "立即提高最大生命，并恢复 10 点。", apply: (game) => { game.playerMods.maxHealthBonus += 10; game.health = Math.min(game.getMaxHealth(), game.health + 10); } },
  { id: "normalDamage", title: "普通弹伤害 +2", desc: "普通武器更适合稳定击毁小型舰船。", apply: (game) => { game.playerMods.normalDamage += 2; } },
  { id: "weaponTime", title: "武器时间 +3 秒", desc: "武器包持续更久。", apply: (game) => { game.playerMods.weaponDurationBonus += 3000; } },
  { id: "heal", title: "医疗恢复 +10", desc: "每个医疗包恢复更多生命。", apply: (game) => { game.playerMods.healthBonus += 10; } },
  { id: "fireRate", title: "炮塔射速 +8%", desc: "所有武器开火间隔降低。", apply: (game) => { game.playerMods.fireRateMultiplier *= 0.92; } },
  { id: "bossDamage", title: "母舰伤害 +15%", desc: "所有子弹打母舰更痛。", apply: (game) => { game.playerMods.bossDamageMultiplier += 0.15; } },
  { id: "aimAssist", title: "辅助瞄准 +12", desc: "子弹更容易贴近敌舰。", apply: (game) => { game.playerMods.aimAssistBonus += 12; } },
];

function getLevelConfig(level, adaptive = {}) {
  const t = (level - 1) / (GAME.maxLevel - 1);
  const pressure = adaptive.pressure || 1;
  const help = adaptive.help || 1;
  const theme = LEVEL_THEMES[level - 1] || LEVEL_THEMES[LEVEL_THEMES.length - 1];
  return {
    level,
    theme,
    spawnEvery: Math.max(0.28, (0.95 - t * 0.58) / pressure),
    spawnJitter: Math.max(0.14, 0.5 - t * 0.25),
    speedBase: (56 + level * 7) * pressure * theme.speed,
    speedJitter: 48 + level * 5,
    enemyHp: (18 + (level - 1) * 7) * theme.hp,
    enemyDamage: 6 + Math.floor((level - 1) * 2.4),
    weaponChance: clamp((0.12 - t * 0.03) * theme.weapon, 0.06, 0.18),
    healthChance: clamp((0.09 - t * 0.03) * help * theme.health, 0.035, 0.2),
    eliteChance: clamp(0.04 + t * 0.24, 0.04, 0.28),
    maxMonsters: Math.round(GAME.maxMonsters * clamp(pressure, 0.82, 1.28)),
  };
}

function randomDropWeapon(exclude = "normal") {
  const choices = DROP_WEAPONS.filter((id) => id !== exclude);
  return choices[Math.floor(Math.random() * choices.length)] || "rapid";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizePoint(point, width, height) {
  return { x: point.x / width, y: point.y / height };
}

function toCanvasPoint(point, width, height) {
  return { x: point.x * width, y: point.y * height };
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function timeout(ms, message) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ms);
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function readBestRecord() {
  try {
    return JSON.parse(localStorage.getItem("bodyFightBestRecord") || "{}");
  } catch (error) {
    return {};
  }
}

function writeBestRecord(record) {
  try {
    localStorage.setItem("bodyFightBestRecord", JSON.stringify(record));
  } catch (error) {
    // 浏览器可能禁用本地存储，不影响游戏运行。
  }
}

function segmentCircleHit(start, end, circle, radius) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fx = start.x - circle.x;
  const fy = start.y - circle.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  const t = [t1, t2].filter((value) => value >= 0 && value <= 1).sort((x, y) => x - y)[0];
  if (t === undefined) return null;
  return {
    t,
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
}

function segmentMayHitCircle(start, end, circle, radius) {
  return circle.x >= Math.min(start.x, end.x) - radius
    && circle.x <= Math.max(start.x, end.x) + radius
    && circle.y >= Math.min(start.y, end.y) - radius
    && circle.y <= Math.max(start.y, end.y) + radius;
}

class SoundFx {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }

  enable() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.enabled = true;
  }

  tone(freq, duration, type = "sine", volume = 0.035, endFreq = null) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  shoot(weaponId) {
    const sounds = {
      normal: [520, 0.045, "square", 0.025, 330],
      rapid: [720, 0.032, "square", 0.018, 460],
      spread: [360, 0.06, "sawtooth", 0.03, 180],
      laser: [980, 0.07, "sine", 0.028, 540],
      flame: [190, 0.085, "triangle", 0.04, 90],
      double: [610, 0.055, "square", 0.026, 360],
    };
    this.tone(...(sounds[weaponId] || sounds.normal));
  }

  hit() {
    this.tone(150, 0.07, "triangle", 0.03, 70);
  }

  explosion(strong = false) {
    const baseVolume = strong ? 0.13 : 0.09;
    this.tone(strong ? 82 : 112, strong ? 0.3 : 0.2, "sawtooth", baseVolume, strong ? 32 : 48);
    window.setTimeout(() => this.tone(44, strong ? 0.24 : 0.16, "triangle", baseVolume * 0.82, 24), 42);
    window.setTimeout(() => this.tone(170, strong ? 0.09 : 0.06, "square", baseVolume * 0.35, 80), 22);
  }

  kill() {
    this.tone(260, 0.055, "square", 0.025, 120);
  }

  boss() {
    this.tone(120, 0.16, "sawtooth", 0.04, 72);
    window.setTimeout(() => this.tone(180, 0.18, "sawtooth", 0.035, 90), 150);
  }

  pickup() {
    this.tone(660, 0.08, "sine", 0.035, 990);
  }

  level() {
    this.tone(440, 0.08, "sine", 0.03, 660);
    window.setTimeout(() => this.tone(660, 0.12, "sine", 0.03, 880), 90);
  }
}

class HandTracker {
  constructor(source) {
    this.source = source;
    this.hands = null;
    this.ready = false;
    this.busy = false;
    this.recovering = false;
    this.lastSendAt = 0;
    this.sendStartedAt = 0;
    this.lastResultAt = 0;
    this.resultIntervalMs = 0;
    this.handCount = 0;
    this.resultCount = 0;
    this.firstHandAt = 0;
    this.errorCount = 0;
    this.status = "未启动";
    this.handsState = {
      Left: this.createHandState("Left"),
      Right: this.createHandState("Right"),
    };
    this.onAttack = null;
  }

  createHandState(handId) {
    return {
      handId,
      currentGesture: "no_hand",
      previousStableGesture: "no_hand",
      pendingGesture: "no_hand",
      pendingGestureFrames: 0,
      lastSeenAt: 0,
      lastAttackAt: 0,
      lastShotAt: 0,
      attackPulseUntil: 0,
      palmCenter: null,
      smoothPalmCenter: null,
      canAttack: false,
    };
  }

  async startCamera() {
    if (this.source.srcObject && this.source.readyState >= 2) {
      this.status = "摄像头已开启";
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("当前浏览器不支持摄像头 API。请使用 Chrome、Edge 或 Safari 新版本。");
    }
    if (!window.isSecureContext) {
      throw new Error("请通过 localhost 或 https 打开页面，否则浏览器会阻止摄像头。");
    }

    this.status = "请求摄像头权限";
    const stream = await Promise.race([
      navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      }),
      timeout(12000, "摄像头请求超时，请检查权限"),
    ]);
    this.source.srcObject = stream;
    this.status = "等待摄像头画面";
    try {
      await Promise.race([
        this.source.play(),
        timeout(3500, "video.play timeout"),
      ]);
    } catch (error) {
      if (this.source.readyState < 2) {
        await Promise.race([
          new Promise((resolve) => {
            this.source.onloadedmetadata = resolve;
          }),
          timeout(3500, "摄像头画面超时"),
        ]);
      }
    }
    await delay(120);
    this.status = this.source.videoWidth ? `摄像头已开启 ${this.source.videoWidth}x${this.source.videoHeight}` : "摄像头已开启";
  }

  async initModel() {
    if (this.ready && this.hands) return;
    this.status = "模型加载中";
    if (typeof window.Hands !== "function") {
      throw new Error(`MediaPipe Hands 未加载。需要 CDN：${CDN.hands}`);
    }

    this.hands = new window.Hands({
      locateFile: (file) => `${CDN.assets}${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.38,
      minTrackingConfidence: 0.38,
    });
    this.hands.onResults((results) => this.handleResults(results));
    this.ready = true;
    this.status = "模型已加载，等待首帧";
  }

  async rebuildModel() {
    if (this.recovering) return;
    this.recovering = true;
    this.ready = false;
    this.busy = false;
    this.status = "识别模块重启中";
    try {
      if (this.hands && typeof this.hands.close === "function") {
        await this.hands.close();
      }
    } catch (error) {
      console.warn(error);
    }
    this.hands = null;
    window.setTimeout(async () => {
      try {
        await this.initModel();
        this.errorCount = 0;
        this.status = "模型已重启";
      } catch (error) {
        console.error(error);
        this.status = `重启失败：${error && error.message ? error.message.slice(0, 18) : "unknown"}`;
      } finally {
        this.recovering = false;
      }
    }, 650);
  }

  async start() {
    await this.startCamera();
    await this.initModel();
  }

  update(now) {
    if (!this.ready || this.recovering || this.source.readyState < 2) return;
    if (!this.source.videoWidth || !this.source.videoHeight) {
      this.status = "等待摄像头画面";
      return;
    }
    if (this.busy && now - this.sendStartedAt > 900) {
      this.busy = false;
      this.status = "识别超时，正在重试";
    }
    if (this.busy) return;
    if (now - this.lastSendAt < 45) return;
    this.lastSendAt = now;
    this.sendStartedAt = now;
    this.busy = true;
    this.hands.send({ image: this.source })
      .catch((error) => {
        console.error(error);
        this.errorCount += 1;
        const message = error && error.message ? error.message : "unknown";
        this.status = `识别异常${this.errorCount}：${message.slice(0, 18)}`;
        this.lastSendAt = now + 240;
        if (this.errorCount >= 2) this.rebuildModel();
      })
      .finally(() => {
        this.busy = false;
      });
  }

  handleResults(results) {
    const now = performance.now();
    if (this.lastResultAt) this.resultIntervalMs = now - this.lastResultAt;
    this.lastResultAt = now;
    const landmarksList = results.multiHandLandmarks || [];
    const handednessList = results.multiHandedness || [];
    this.resultCount += 1;
    this.handCount = landmarksList.length;
    this.status = this.handCount > 0 ? `检测到 ${this.handCount} 只手` : "未检测到手";
    if (this.handCount > 0 && !this.firstHandAt) this.firstHandAt = now;
    const seen = new Set();

    landmarksList.forEach((landmarks, index) => {
      const handId = this.resolveHandId(handednessList[index], landmarks);
      const state = this.handsState[handId];
      seen.add(handId);
      state.palmCenter = this.getPalmCenter(landmarks);
      if (!state.smoothPalmCenter) state.smoothPalmCenter = { ...state.palmCenter };
      state.lastSeenAt = now;
      this.updateGestureState(state, this.classifyGesture(landmarks), now);
      if (state.currentGesture === "no_hand") state.currentGesture = "unknown";
    });

    for (const handId of ["Left", "Right"]) {
      if (!seen.has(handId)) this.handleMissingHand(this.handsState[handId], now);
    }
  }

  resolveHandId(handedness, landmarks) {
    const rawLabel = handedness && (handedness.label || (handedness.classification && handedness.classification[0] && handedness.classification[0].label));
    // MediaPipe Hands 的 handedness 默认按自拍镜像输入解释；当前模型输入是原始摄像头画面，
    // 所以这里交换标签，保证 Left/Right 表示玩家本人真实左右手。
    if (rawLabel === "Left") return "Right";
    if (rawLabel === "Right") return "Left";
    const center = this.getPalmCenter(landmarks);
    // 没有 handedness 时才用屏幕位置兜底。
    return center.x < 0.5 ? "Left" : "Right";
  }

  getPalmCenter(landmarks) {
    // 摄像头预览使用镜像显示，光标坐标也同步镜像，保证光标贴着画面里的手。
    const ids = [0, 5, 9, 13, 17];
    const sum = ids.reduce((acc, id) => {
      acc.x += 1 - landmarks[id].x;
      acc.y += landmarks[id].y;
      return acc;
    }, { x: 0, y: 0 });
    return {
      x: clamp(sum.x / ids.length, 0, 1),
      y: clamp(sum.y / ids.length, 0, 1),
    };
  }

  classifyGesture(landmarks) {
    const palm = this.getPalmCenterRaw(landmarks);
    const wrist = landmarks[0];
    const palmSize = Math.max(0.001, Math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y));
    const fingers = [
      { tip: 8, pip: 6, mcp: 5 },
      { tip: 12, pip: 10, mcp: 9 },
      { tip: 16, pip: 14, mcp: 13 },
      { tip: 20, pip: 18, mcp: 17 },
    ];

    let extended = 0;
    let folded = 0;
    for (const finger of fingers) {
      const tip = landmarks[finger.tip];
      const pip = landmarks[finger.pip];
      const mcp = landmarks[finger.mcp];
      const tipToPalm = Math.hypot(tip.x - palm.x, tip.y - palm.y);
      const pipToPalm = Math.hypot(pip.x - palm.x, pip.y - palm.y);
      const mcpToPalm = Math.hypot(mcp.x - palm.x, mcp.y - palm.y);

      const clearlyExtended = tip.y < pip.y - palmSize * 0.08 && tipToPalm > pipToPalm * 1.08;
      const nearPalm = tipToPalm < Math.max(mcpToPalm * 1.28, palmSize * 0.82);
      const belowJoint = tip.y > pip.y + palmSize * 0.06;
      if (clearlyExtended) extended += 1;
      if (nearPalm || belowJoint) folded += 1;
    }

    if (extended >= 3) return "open_palm";
    if (folded >= 3) return "fist";
    return "unknown";
  }

  getPalmCenterRaw(landmarks) {
    const ids = [0, 5, 9, 13, 17];
    const sum = ids.reduce((acc, id) => {
      acc.x += landmarks[id].x;
      acc.y += landmarks[id].y;
      return acc;
    }, { x: 0, y: 0 });
    return { x: sum.x / ids.length, y: sum.y / ids.length };
  }

  updateGestureState(state, rawGesture, now) {
    if (rawGesture === state.pendingGesture) {
      state.pendingGestureFrames += 1;
    } else {
      state.pendingGesture = rawGesture;
      state.pendingGestureFrames = 1;
    }

    // 连续两帧相同才确认，减少单帧误判。
    if (state.pendingGestureFrames < 2) {
      state.currentGesture = now < state.attackPulseUntil ? "attack_triggered" : state.currentGesture;
      return;
    }

    const nextGesture = state.pendingGesture;
    const cooledDown = now - state.lastAttackAt > 420;
    if (state.canAttack && state.previousStableGesture === "open_palm" && nextGesture === "fist" && cooledDown) {
      state.lastAttackAt = now;
      state.attackPulseUntil = now + 220;
      state.currentGesture = "attack_triggered";
      state.previousStableGesture = "fist";
      state.canAttack = false;
      return;
    }

    if (nextGesture === "open_palm") state.canAttack = true;
    state.currentGesture = now < state.attackPulseUntil ? "attack_triggered" : nextGesture;
    state.previousStableGesture = nextGesture;
  }

  handleMissingHand(state, now) {
    if (now - state.lastSeenAt <= 280) return;
    state.currentGesture = "no_hand";
    state.pendingGesture = "no_hand";
    state.pendingGestureFrames = 0;
    state.palmCenter = null;
    state.smoothPalmCenter = null;
    state.canAttack = false;
    state.previousStableGesture = "no_hand";
  }

  smoothHands(dt) {
    const alpha = 1 - Math.exp(-dt * 22);
    for (const handId of ["Left", "Right"]) {
      const state = this.handsState[handId];
      if (!state.palmCenter) continue;
      if (!state.smoothPalmCenter) {
        state.smoothPalmCenter = { ...state.palmCenter };
        continue;
      }
      state.smoothPalmCenter.x += (state.palmCenter.x - state.smoothPalmCenter.x) * alpha;
      state.smoothPalmCenter.y += (state.palmCenter.y - state.smoothPalmCenter.y) * alpha;
    }
  }
}

class MonsterManager {
  constructor() {
    this.monsters = [];
    this.spawnTimer = 0;
    this.bossSpawnedLevel = 0;
  }

  reset() {
    this.monsters.length = 0;
    this.spawnTimer = 0;
    this.bossSpawnedLevel = 0;
  }

  update(dt, width, height, levelConfig, onReachPlayer) {
    if ((levelConfig.level === 5 || levelConfig.level === 10) && this.bossSpawnedLevel !== levelConfig.level) {
      this.spawnBoss(width, height, levelConfig);
      this.bossSpawnedLevel = levelConfig.level;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.monsters.length < levelConfig.maxMonsters) {
      this.spawn(width, height, levelConfig);
      this.spawnTimer = levelConfig.spawnEvery + Math.random() * levelConfig.spawnJitter;
    }

    const playerZone = { x: width / 2, y: height - 76 };
    for (const monster of this.monsters) {
      if (monster.dead) continue;
      if (monster.variant === "boss") {
        const hpRatio = monster.hp / monster.maxHp;
        const phaseBoost = hpRatio < 0.2 ? 1.75 : hpRatio < 0.4 ? 1.38 : hpRatio < 0.7 ? 1.16 : 1;
        monster.phaseTime += dt;
        monster.x += Math.sin(monster.phaseTime * monster.swaySpeed * phaseBoost) * monster.swayWidth * phaseBoost * dt;
        monster.y += monster.vy * dt * (monster.y < height * 0.2 ? 1 : 0.35);
        monster.x = clamp(monster.x, monster.r + 12, width - monster.r - 12);
        if (monster.summonCooldown > 0) monster.summonCooldown -= dt;
        if (monster.summonCooldown <= 0 && this.monsters.length < levelConfig.maxMonsters) {
          this.spawnMinion(width, height, levelConfig, monster);
          monster.summonCooldown = (3.4 - Math.min(1.2, levelConfig.level * 0.08)) / phaseBoost;
        }
        if (hpRatio < 0.2 && !monster.desperationUsed) {
          monster.desperationUsed = true;
          monster.warningUntil = performance.now() + 900;
          const target = { x: width / 2, y: height - 76 };
          const angle = Math.atan2(target.y - monster.y, target.x - monster.x);
          monster.vx = Math.cos(angle) * levelConfig.speedBase * 1.8;
          monster.vy = Math.sin(angle) * levelConfig.speedBase * 1.8;
        }
        if (monster.desperationUsed && performance.now() > monster.warningUntil) {
          monster.x += monster.vx * dt;
          monster.y += monster.vy * dt;
        }
      } else if (monster.variant === "dodger") {
        monster.phaseTime += dt;
        monster.x += (monster.vx + Math.sin(monster.phaseTime * 5.5) * 48) * dt;
        monster.y += monster.vy * dt;
      } else if (monster.variant === "charger" && monster.y > height * 0.36) {
        monster.x += monster.vx * dt * 1.35;
        monster.y += monster.vy * dt * 1.55;
      } else {
        monster.x += monster.vx * dt;
        monster.y += monster.vy * dt;
      }
      if (monster.type === "enemy" && !monster.reached && distance(monster, playerZone) < GAME.playerRadius) {
        monster.reached = true;
        onReachPlayer(monster);
      }
    }
    this.monsters = this.monsters.filter((monster) => {
      const inside = monster.y < height + monster.r + 60 && monster.x > -monster.r - 80 && monster.x < width + monster.r + 80;
      return !monster.dead && !monster.reached && inside;
    });
  }

  spawn(width, height, levelConfig) {
    const roll = Math.random();
    const type = roll < levelConfig.weaponChance ? "weapon" : roll < levelConfig.weaponChance + levelConfig.healthChance ? "health" : "enemy";
    const fromLeftFront = Math.random() < 0.5;
    const start = {
      x: width * (fromLeftFront ? 0.08 + Math.random() * 0.3 : 0.62 + Math.random() * 0.3),
      y: -42,
    };
    const target = {
      x: width * (0.42 + Math.random() * 0.16),
      y: height - 74,
    };
    const angle = Math.atan2(target.y - start.y, target.x - start.x);
    const variant = this.chooseEnemyVariant(levelConfig);
    const speed = type === "enemy"
      ? (levelConfig.speedBase + Math.random() * levelConfig.speedJitter) * variant.speed
      : 42 + Math.random() * 28;
    const weaponId = type === "weapon" ? randomDropWeapon() : null;
    const color = type === "weapon"
      ? WEAPONS[weaponId].color
      : type === "health"
        ? "#64e389"
        : variant.color;
    const enemyHp = Math.round(levelConfig.enemyHp * variant.hp);
    const enemyDamage = Math.round(levelConfig.enemyDamage * variant.damage);
    this.monsters.push({
      type,
      variant: type === "enemy" ? variant.id : type,
      weaponId,
      x: start.x,
      y: start.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: type === "enemy" ? (22 + Math.random() * 10) * variant.radius : 20,
      hp: type === "enemy" ? enemyHp : 1,
      maxHp: type === "enemy" ? enemyHp : 1,
      damage: type === "enemy" ? enemyDamage : 0,
      score: type === "enemy" ? variant.score : 0,
      phaseTime: Math.random() * Math.PI * 2,
      dead: false,
      reached: false,
      color,
      flashUntil: 0,
      label: type === "enemy" ? variant.label : "",
      nextAttackAt: performance.now() + 700 + Math.random() * 1300,
    });
  }

  chooseEnemyVariant(levelConfig) {
    const roll = Math.random();
    const bias = levelConfig.theme.bias;
    const eliteBoost = clamp(0.65 + levelConfig.eliteChance * 1.5, 0.65, 1.08);
    const chargerLimit = (bias.charger || 0) * eliteBoost;
    const dodgerLimit = chargerLimit + (bias.dodger || 0) * eliteBoost;
    const tankLimit = dodgerLimit + (bias.tank || 0) * eliteBoost;
    const fastLimit = tankLimit + (bias.fast || 0) * eliteBoost;
    if (roll < chargerLimit) {
      return { id: "charger", label: "突", hp: 1.25, damage: 1.75, speed: 1.18, radius: 1.02, score: 170, color: "#ff8b4a" };
    }
    if (roll < dodgerLimit) {
      return { id: "dodger", label: "碟", hp: 0.92, damage: 1.05, speed: 1.2, radius: 0.92, score: 150, color: "#c78dff" };
    }
    if (roll < tankLimit) {
      return { id: "tank", label: "甲", hp: 2.25, damage: 1.45, speed: 0.72, radius: 1.18, score: 190, color: "#f36d6d" };
    }
    if (roll < fastLimit) {
      return { id: "fast", label: "截", hp: 0.72, damage: 0.85, speed: 1.42, radius: 0.82, score: 130, color: "#59c8f2" };
    }
    return { id: "grunt", label: "侦", hp: 1, damage: 1, speed: 1, radius: 1, score: 100, color: ["#8be36f", "#f2c94c", "#f08d6d"][Math.floor(Math.random() * 3)] };
  }

  spawnBoss(width, height, levelConfig) {
    const bossLevel = levelConfig.level === 10 ? 2 : 1;
    const hp = Math.round(levelConfig.enemyHp * (bossLevel === 2 ? 24 : 15));
    this.monsters.push({
      type: "enemy",
      variant: "boss",
      x: width / 2,
      y: -80,
      vx: 0,
      vy: 24 + levelConfig.level * 1.6,
      r: bossLevel === 2 ? 78 : 64,
      hp,
      maxHp: hp,
      damage: Math.round(levelConfig.enemyDamage * (bossLevel === 2 ? 3.4 : 2.6)),
      score: bossLevel === 2 ? 2400 : 1400,
      phaseTime: 0,
      swaySpeed: bossLevel === 2 ? 1.45 : 1.15,
      swayWidth: bossLevel === 2 ? 58 : 42,
      summonCooldown: 2.2,
      dead: false,
      reached: false,
      color: bossLevel === 2 ? "#ff5b7e" : "#d89cff",
      flashUntil: 0,
      label: bossLevel === 2 ? "母舰 II" : "母舰",
      warningUntil: 0,
      desperationUsed: false,
      nextAttackAt: performance.now() + 900,
    });
  }

  spawnMinion(width, height, levelConfig, boss) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const start = { x: boss.x + side * (boss.r + 28), y: boss.y + boss.r * 0.3 };
    const target = { x: width * (0.45 + Math.random() * 0.1), y: height - 74 };
    const angle = Math.atan2(target.y - start.y, target.x - start.x);
    const speed = levelConfig.speedBase * 1.08;
    const hp = Math.round(levelConfig.enemyHp * 0.82);
    this.monsters.push({
      type: "enemy",
      variant: "fast",
      x: clamp(start.x, 24, width - 24),
      y: start.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 18,
      hp,
      maxHp: hp,
      damage: Math.round(levelConfig.enemyDamage * 0.78),
      score: 90,
      phaseTime: Math.random() * Math.PI * 2,
      dead: false,
      reached: false,
      color: "#59c8f2",
      flashUntil: 0,
      label: "截",
      nextAttackAt: performance.now() + 500 + Math.random() * 850,
    });
  }

}

class Game {
  constructor() {
    this.width = 1280;
    this.height = 720;
    this.phase = "idle";
    this.running = false;
    this.paused = false;
    this.level = 1;
    this.score = 0;
    this.playerMods = this.createPlayerMods();
    this.health = this.getMaxHealth();
    this.shield = GAME.maxShield;
    this.lastPlayerDamageAt = 0;
    this.timeLeft = GAME.roundSeconds;
    this.levelStartScore = 0;
    this.levelKills = 0;
    this.totalKills = 0;
    this.levelDamageTaken = 0;
    this.levelShots = 0;
    this.levelHits = 0;
    this.totalShots = 0;
    this.totalHits = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastKillAt = 0;
    this.screenShake = 0;
    this.calibrationBounds = { minX: 0.08, maxX: 0.92, minY: 0.06, maxY: 0.9 };
    this.calibrationDraft = null;
    this.calibrationDeadline = 0;
    this.calibrationCountdownStarted = false;
    this.cursorConfirmedAt = 0;
    this.bestRecord = readBestRecord();
    this.pendingUpgradeChoices = [];
    this.pendingNextLevel = 1;
    this.difficulty = ui.difficultySelect ? ui.difficultySelect.value : "normal";
    this.calibrationMode = "newGame";
    this.calibrationPreviousPhase = "idle";
    this.weaponBanner = null;
    this.frameFps = 0;
    this.intermissionLeft = 0;
    this.intermissionDeadline = 0;
    this.lastFrameAt = performance.now();
    this.particles = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.weaponType = "normal";
    this.weaponUntil = 0;
    this.lastShootSoundAt = 0;
    this.floatingTexts = [];
    this.sound = new SoundFx();
    this.tracker = new HandTracker(video);
    this.monsters = new MonsterManager();
    this.bind();
    this.resize();
    requestAnimationFrame((time) => this.loop(time));
  }

  bind() {
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("fullscreenchange", () => {
      ui.fullscreenBtn.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
      this.resize();
    });
    ui.startBtn.addEventListener("click", () => this.start());
    ui.fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    ui.difficultySelect.addEventListener("change", () => this.updateDifficulty());
    ui.calibrateBtn.addEventListener("click", () => this.beginCalibration(this.phase === "playing" ? "resume" : "newGame"));
    ui.pauseBtn.addEventListener("click", () => this.togglePause());
    ui.restartBtn.addEventListener("click", () => this.restart());
  }

  createPlayerMods() {
    return {
      maxHealthBonus: 0,
      normalDamage: 0,
      weaponDurationBonus: 0,
      healthBonus: 0,
      fireRateMultiplier: 1,
      bossDamageMultiplier: 1,
      aimAssistBonus: 0,
    };
  }

  updateDifficulty() {
    this.difficulty = ui.difficultySelect ? ui.difficultySelect.value : "normal";
    if (this.phase === "idle" || this.phase === "calibrating") {
      this.timeLeft = this.getRoundSeconds();
      this.updateHud();
    }
    const seconds = this.getRoundSeconds();
    ui.notice.textContent = `难度已设置为${this.getDifficultyLabel()}，每关 ${Math.round(seconds / 60)} 分钟。`;
  }

  getRoundSeconds() {
    return GAME.difficultySeconds[this.difficulty] || GAME.roundSeconds;
  }

  getDifficultyLabel() {
    const labels = { easy: "简单", normal: "中等", hard: "困难" };
    return labels[this.difficulty] || "中等";
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await stage.requestFullscreen();
        ui.fullscreenBtn.textContent = "退出全屏";
      } else {
        await document.exitFullscreen();
        ui.fullscreenBtn.textContent = "全屏";
      }
      window.setTimeout(() => this.resize(), 80);
    } catch (error) {
      console.error(error);
      ui.notice.textContent = "当前浏览器没有允许进入全屏。";
    }
  }

  resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async start() {
    try {
      this.updateDifficulty();
      this.sound.enable();
      ui.notice.textContent = "正在启动摄像头和 MediaPipe Hands...";
      await this.tracker.start();
      this.beginCalibration();
      ui.startBtn.disabled = true;
      ui.calibrateBtn.disabled = false;
      ui.pauseBtn.disabled = true;
      ui.restartBtn.disabled = false;
      ui.notice.textContent = "请举起手，等屏幕出现手部光标后才会开始校准倒计时。";
    } catch (error) {
      console.error(error);
      ui.notice.textContent = error.message || "摄像头启动失败。请检查权限。";
    }
  }

  restart() {
    this.beginCalibration("newGame");
  }

  resetGame() {
    this.updateDifficulty();
    this.score = 0;
    this.playerMods = this.createPlayerMods();
    this.health = this.getMaxHealth();
    this.shield = GAME.maxShield;
    this.lastPlayerDamageAt = 0;
    this.level = 1;
    this.totalKills = 0;
    this.totalShots = 0;
    this.totalHits = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.hideLevelOverlay();
    this.startLevel(1);
  }

  beginCalibration(mode = "newGame") {
    this.calibrationMode = mode;
    this.calibrationPreviousPhase = mode === "resume" ? this.phase : "idle";
    if (mode === "newGame") {
      this.monsters.reset();
      this.bullets.length = 0;
      this.enemyBullets.length = 0;
      this.particles.length = 0;
      this.floatingTexts.length = 0;
    }
    this.phase = "calibrating";
    this.running = false;
    this.paused = false;
    this.calibrationDraft = { minX: 1, maxX: 0, minY: 1, maxY: 0, samples: 0 };
    this.calibrationDeadline = 0;
    this.calibrationCountdownStarted = false;
    this.cursorConfirmedAt = 0;
    ui.pauseBtn.textContent = "暂停";
    ui.pauseBtn.disabled = true;
    ui.restartBtn.disabled = false;
    this.showLevelOverlay({
      title: mode === "resume" ? "重新校准" : "操作范围校准",
      countdown: "等待屏幕出现手部光标",
      button: mode === "resume" ? "完成并继续" : "跳过校准并开始",
      buttonDisabled: false,
      onButton: () => this.finishCalibration(),
      rank: "",
      stats: [
        ["动作", "移动双手"],
        ["目标", "覆盖常用范围"],
        ["识别样本", "0"],
      ],
    });
  }

  updateCalibration(now) {
    const activeHands = this.getActiveHands();
    for (const hand of activeHands) {
      const point = hand.palmCenter;
      if (!point) continue;
      this.calibrationDraft.minX = Math.min(this.calibrationDraft.minX, point.x);
      this.calibrationDraft.maxX = Math.max(this.calibrationDraft.maxX, point.x);
      this.calibrationDraft.minY = Math.min(this.calibrationDraft.minY, point.y);
      this.calibrationDraft.maxY = Math.max(this.calibrationDraft.maxY, point.y);
      this.calibrationDraft.samples += 1;
    }
    const cursorVisible = activeHands.some((hand) => hand.palmCenter && hand.currentGesture !== "no_hand");
    if (cursorVisible && !this.cursorConfirmedAt) this.cursorConfirmedAt = now;
    const cursorStable = this.cursorConfirmedAt > 0 && now - this.cursorConfirmedAt >= 450;
    if (cursorStable && this.calibrationDraft.samples > 0 && !this.calibrationCountdownStarted) {
      this.calibrationCountdownStarted = true;
      this.calibrationDeadline = now + GAME.calibrationSeconds * 1000;
      ui.notice.textContent = "已识别到手部光标，请继续移动双手完成校准。";
    }
    const left = this.calibrationCountdownStarted ? Math.max(0, Math.ceil((this.calibrationDeadline - now) / 1000)) : GAME.calibrationSeconds;
    ui.summaryCountdown.textContent = this.calibrationCountdownStarted
      ? (this.calibrationMode === "resume" ? `${left} 秒后继续游戏` : `${left} 秒后开始第 1 关`)
      : "等待屏幕出现手部光标";
    if (ui.summaryStats) {
      ui.summaryStats.innerHTML = [
        ["动作", "移动双手"],
        ["目标", "覆盖常用范围"],
        ["识别样本", this.calibrationDraft.samples],
      ].map(([label, value]) => `<div class="summary-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
    }
    if (this.calibrationCountdownStarted && now >= this.calibrationDeadline) this.finishCalibration();
  }

  finishCalibration() {
    const draft = this.calibrationDraft;
    if (draft && draft.samples >= 8 && draft.maxX - draft.minX > 0.12 && draft.maxY - draft.minY > 0.12) {
      this.calibrationBounds = {
        minX: clamp(draft.minX - 0.04, 0, 0.92),
        maxX: clamp(draft.maxX + 0.04, 0.08, 1),
        minY: clamp(draft.minY - 0.04, 0, 0.92),
        maxY: clamp(draft.maxY + 0.04, 0.08, 1),
      };
    }
    if (this.calibrationMode === "resume") {
      this.phase = this.calibrationPreviousPhase === "playing" ? "playing" : "summary";
      this.running = this.phase === "playing";
      this.paused = false;
      this.hideLevelOverlay();
      ui.pauseBtn.disabled = this.phase !== "playing";
      ui.notice.textContent = "校准已更新。";
      return;
    }
    this.resetGame();
  }

  startLevel(level) {
    this.updateDifficulty();
    this.level = level;
    this.timeLeft = this.getRoundSeconds();
    this.levelStartScore = this.score;
    this.levelKills = 0;
    this.levelDamageTaken = 0;
    this.levelShots = 0;
    this.levelHits = 0;
    this.combo = 0;
    this.shield = GAME.maxShield;
    this.particles.length = 0;
    this.bullets.length = 0;
    this.enemyBullets.length = 0;
    this.floatingTexts.length = 0;
    this.weaponType = "normal";
    this.weaponUntil = 0;
    this.monsters.reset();
    this.weaponBanner = null;
    this.phase = "playing";
    this.running = true;
    this.paused = false;
    this.hideLevelOverlay();
    ui.pauseBtn.textContent = "暂停";
    ui.pauseBtn.disabled = false;
    ui.restartBtn.disabled = false;
    const theme = LEVEL_THEMES[this.level - 1] || LEVEL_THEMES[0];
    ui.notice.textContent = (this.level === 5 || this.level === 10)
      ? `第 ${this.level} 关开始。母舰已出现，优先压低它的血量。`
      : `第 ${this.level} 关：${theme.name}。击中武器包可临时切换武器。`;
    this.sound.level();
    if (this.level === 5 || this.level === 10) this.sound.boss();
  }

  finishGameOver(message) {
    this.phase = "gameover";
    this.running = false;
    this.paused = false;
    this.bullets.length = 0;
    this.enemyBullets.length = 0;
    ui.pauseBtn.textContent = "暂停";
    ui.pauseBtn.disabled = true;
    ui.restartBtn.disabled = false;
    ui.notice.textContent = message;
    this.saveBestRecord(false);
    this.showLevelOverlay({
      title: "游戏结束",
      countdown: "点击重新开始再来一局。",
      button: "重新开始",
      buttonDisabled: false,
      onButton: () => this.restart(),
      rank: this.getRank(),
      stats: [
        ["到达关卡", `${this.level}/${GAME.maxLevel}`],
        ["总分", this.score],
        ["击毁敌舰", this.totalKills],
        ["命中率", `${this.getAccuracy()}%`],
        ["最高连击", this.bestCombo],
        ["剩余生命", this.health],
      ],
    });
  }

  completeLevel(now) {
    this.phase = this.level >= GAME.maxLevel ? "complete" : "summary";
    this.running = false;
    this.paused = false;
    this.bullets.length = 0;
    this.enemyBullets.length = 0;
    this.monsters.reset();
    ui.pauseBtn.textContent = "暂停";
    ui.pauseBtn.disabled = true;
    const scoreGain = this.score - this.levelStartScore;
    const levelAccuracy = this.levelShots > 0 ? Math.round((this.levelHits / this.levelShots) * 100) : 0;
    this.saveBestRecord(false);
    if (this.level >= GAME.maxLevel) {
      ui.notice.textContent = "全部 10 关完成。";
      this.saveBestRecord(true);
      this.showLevelOverlay({
        title: "通关完成",
        countdown: "点击重新开始可以从第 1 关再来。",
        button: "重新开始",
        buttonDisabled: false,
        onButton: () => this.restart(),
        rank: this.getRank(true),
        stats: [
          ["总分", this.score],
          ["击毁敌舰", this.totalKills],
          ["命中率", `${this.getAccuracy()}%`],
          ["最高连击", this.bestCombo],
          ["剩余生命", this.health],
          ["本关得分", scoreGain],
        ],
      });
      this.sound.level();
      return;
    }

    this.pendingNextLevel = this.level + 1;
    this.pendingUpgradeChoices = this.pickUpgradeChoices();
    this.intermissionLeft = 0;
    this.intermissionDeadline = 0;
    ui.notice.textContent = `第 ${this.level} 关完成，请选择一个升级后进入下一关。`;
    this.showLevelOverlay({
      title: `第 ${this.level} 关完成`,
      countdown: `请选择一个升级后进入第 ${this.level + 1} 关`,
      button: "请选择一个升级",
      buttonDisabled: true,
      onButton: () => this.applyUpgradeAndStart(null),
      rank: this.getRank(),
      stats: [
        ["本关得分", scoreGain],
        ["击毁敌舰", this.levelKills],
        ["本关命中率", `${levelAccuracy}%`],
        ["最高连击", this.bestCombo],
        ["承受伤害", this.levelDamageTaken],
        ["剩余生命", this.health],
      ],
    });
    this.renderUpgradeChoices();
    this.sound.level();
  }

  togglePause() {
    if (this.phase !== "playing") return;
    this.paused = !this.paused;
    ui.pauseBtn.textContent = this.paused ? "继续" : "暂停";
  }

  showLevelOverlay({ title, countdown, button, buttonDisabled, onButton, stats, rank = "" }) {
    ui.summaryTitle.innerHTML = rank ? `<span class="summary-rank">${rank}</span><br>${title}` : title;
    ui.summaryCountdown.textContent = countdown;
    ui.nextLevelBtn.textContent = button;
    ui.nextLevelBtn.disabled = Boolean(buttonDisabled);
    ui.nextLevelBtn.onclick = onButton;
    ui.summaryStats.innerHTML = stats.map(([label, value]) => (
      `<div class="summary-stat"><span>${label}</span><strong>${value}</strong></div>`
    )).join("");
    if (ui.upgradeChoices) {
      ui.upgradeChoices.hidden = true;
      ui.upgradeChoices.innerHTML = "";
    }
    ui.levelOverlay.hidden = false;
  }

  hideLevelOverlay() {
    ui.levelOverlay.hidden = true;
  }

  pickUpgradeChoices() {
    const pool = [...UPGRADES];
    const choices = [];
    while (choices.length < 3 && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    return choices;
  }

  renderUpgradeChoices() {
    if (!ui.upgradeChoices) return;
    ui.upgradeChoices.hidden = false;
    ui.upgradeChoices.innerHTML = this.pendingUpgradeChoices.map((upgrade) => (
      `<button class="upgrade-choice" type="button" data-upgrade="${upgrade.id}"><strong>${upgrade.title}</strong><span>${upgrade.desc}</span></button>`
    )).join("");
    ui.upgradeChoices.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const upgrade = this.pendingUpgradeChoices.find((item) => item.id === button.dataset.upgrade);
        this.applyUpgradeAndStart(upgrade);
      });
    });
  }

  applyUpgradeAndStart(upgrade) {
    const selected = upgrade || null;
    if (!selected) {
      ui.notice.textContent = "请先选择一个升级。";
      return;
    }
    selected.apply(this);
    ui.notice.textContent = `已选择升级：${selected.title}`;
    this.spawnFloatingText(this.width / 2, this.height / 2, selected.title, "#f6c84c");
    this.pendingUpgradeChoices = [];
    this.startLevel(this.pendingNextLevel);
  }

  getAccuracy() {
    return this.totalShots > 0 ? Math.round((this.totalHits / this.totalShots) * 100) : 0;
  }

  getMaxHealth() {
    return GAME.maxHealth + ((this.playerMods && this.playerMods.maxHealthBonus) || 0);
  }

  getRank(completed = false) {
    const accuracy = this.getAccuracy();
    if (completed && this.health >= 70 && accuracy >= 50) return "S";
    if (this.score >= 9000 || (completed && accuracy >= 42)) return "A";
    if (this.score >= 4200 || accuracy >= 32) return "B";
    return "C";
  }

  saveBestRecord(completed) {
    const previous = this.bestRecord || {};
    const wins = Number(previous.wins || 0) + (completed ? 1 : 0);
    const record = {
      score: Math.max(Number(previous.score || 0), this.score),
      level: Math.max(Number(previous.level || 0), this.level),
      combo: Math.max(Number(previous.combo || 0), this.bestCombo),
      wins,
    };
    this.bestRecord = record;
    writeBestRecord(record);
  }

  spawnParticle(x, y) {
    if (this.particles.length >= GAME.maxParticles) this.particles.splice(0, this.particles.length - GAME.maxParticles + 1);
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 180;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.35,
      size: 4 + Math.random() * 4,
      color: "#f6c84c",
    });
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastFrameAt) / 1000);
    this.lastFrameAt = now;
    if (dt > 0) {
      const fps = 1 / dt;
      this.frameFps = this.frameFps ? this.frameFps * 0.92 + fps * 0.08 : fps;
    }

    this.tracker.update(now);
    this.tracker.smoothHands(dt);
    if (this.phase === "calibrating") {
      this.updateCalibration(now);
    }

    if (this.phase === "summary" && this.pendingUpgradeChoices.length > 0 && this.pendingNextLevel > this.level) {
      ui.summaryCountdown.textContent = `请选择一个升级后进入第 ${this.pendingNextLevel} 关`;
    }

    if (this.phase === "playing" && !this.paused && this.health > 0 && this.timeLeft > 0) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft === 0) {
        this.completeLevel(now);
        this.render(now);
        this.updateHud();
        requestAnimationFrame((time) => this.loop(time));
        return;
      }
      this.fireFromHands(now);
      this.updateBullets(dt);
      const levelConfig = this.getCurrentLevelConfig();
      this.monsters.update(dt, this.width, this.height, levelConfig, (monster) => {
        this.damagePlayer(monster.damage || 6, this.width / 2, this.height - 76, monster.color || "#f36d6d", monster.variant === "boss");
      });
      if (this.phase === "playing") {
        this.fireFromEnemies(now, levelConfig);
        this.updateEnemyBullets(dt);
        this.updateShield(dt, now);
      }
    }

    if (!this.paused) {
      this.updateParticles(dt);
      this.updateFloatingTexts(dt);
      this.screenShake = Math.max(0, this.screenShake - dt * 24);
    }

    this.render(now);
    this.updateHud();
    requestAnimationFrame((time) => this.loop(time));
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  spawnFloatingText(x, y, text, color) {
    if (this.floatingTexts.length >= GAME.maxFloatingTexts) this.floatingTexts.shift();
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 0.9,
      vy: -34,
    });
  }

  updateFloatingTexts(dt) {
    for (const item of this.floatingTexts) {
      item.y += item.vy * dt;
      item.life -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter((item) => item.life > 0);
  }

  getEnemyAttackDifficulty() {
    return DIFFICULTY_ENEMY_ATTACK[this.difficulty] || DIFFICULTY_ENEMY_ATTACK.normal;
  }

  getEnemyAttackProfile(monster, levelConfig) {
    const base = ENEMY_ATTACKS[monster.variant] || ENEMY_ATTACKS.grunt;
    const difficulty = this.getEnemyAttackDifficulty();
    const levelBoost = 1 + (levelConfig.level - 1) * 0.045;
    return {
      cooldown: Math.max(420, base.cooldown * difficulty.cooldown * clamp(1.05 - levelConfig.level * 0.018, 0.78, 1.05)),
      damage: Math.max(1, Math.round((base.damage + (levelConfig.level - 1) * 0.32) * difficulty.damage * levelBoost)),
      speed: base.speed * difficulty.speed * (1 + levelConfig.level * 0.014),
      radius: base.radius,
      color: base.color,
      spread: base.spread || 0,
      volley: base.volley || 1,
      warningMs: monster.variant === "boss" ? 760 : monster.variant === "tank" ? 720 : 580,
    };
  }

  getEnemyTargetPoint(monster) {
    const left = this.getGunPosition("Left");
    const right = this.getGunPosition("Right");
    const defenseY = this.getDefenseLineY();
    if (monster.variant === "boss" && Math.random() < 0.2) {
      return { x: this.width / 2, y: defenseY };
    }
    const gun = Math.abs(monster.x - left.x) < Math.abs(monster.x - right.x) ? left : right;
    return { x: gun.x, y: defenseY };
  }

  getDefenseLineY() {
    return this.height - GAME.defenseLineOffset;
  }

  fireFromEnemies(now, levelConfig) {
    for (const monster of this.monsters.monsters) {
      if (monster.dead || monster.type !== "enemy") continue;
      const canAttackY = monster.variant === "boss" ? monster.y > 0 : monster.y > this.height * 0.18;
      if (!canAttackY || monster.y > this.getDefenseLineY() - 46) continue;
      if (this.enemyBullets.length >= GAME.maxEnemyBullets) break;

      if (monster.attackWarningUntil && now >= monster.attackWarningUntil) {
        const profile = monster.pendingAttackProfile || this.getEnemyAttackProfile(monster, levelConfig);
        const baseAngle = monster.pendingAttackAngle || Math.atan2(this.getDefenseLineY() - monster.y, this.width / 2 - monster.x);
        for (let i = 0; i < profile.volley && this.enemyBullets.length < GAME.maxEnemyBullets; i += 1) {
          const offset = (i - (profile.volley - 1) / 2) * profile.spread;
          this.createEnemyBullet(monster, baseAngle + offset, profile);
        }
        monster.nextAttackAt = now + profile.cooldown * (0.86 + Math.random() * 0.34);
        monster.attackPulseUntil = now + 150;
        monster.attackWarningUntil = 0;
        monster.pendingAttackAngle = 0;
        monster.pendingAttackProfile = null;
        continue;
      }

      if (monster.attackWarningUntil || now < (monster.nextAttackAt || 0)) continue;
      const profile = this.getEnemyAttackProfile(monster, levelConfig);
      const target = this.getEnemyTargetPoint(monster);
      monster.pendingAttackAngle = Math.atan2(target.y - monster.y, target.x - monster.x);
      monster.pendingAttackProfile = profile;
      monster.attackWarningUntil = now + profile.warningMs;
    }
  }

  createEnemyBullet(monster, angle, profile) {
    const muzzleDistance = monster.variant === "boss" ? monster.r * 0.52 : monster.r * 0.72;
    const x = monster.x + Math.cos(angle) * muzzleDistance;
    const y = monster.y + Math.sin(angle) * muzzleDistance;
    this.enemyBullets.push({
      x,
      y,
      prevX: x,
      prevY: y,
      vx: Math.cos(angle) * profile.speed,
      vy: Math.sin(angle) * profile.speed,
      damage: profile.damage,
      radius: profile.radius,
      color: profile.color,
      variant: monster.variant,
      dead: false,
    });
  }

  updateEnemyBullets(dt) {
    const defenseY = this.getDefenseLineY();
    for (const bullet of this.enemyBullets) {
      bullet.prevX = bullet.x;
      bullet.prevY = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.prevY < defenseY && bullet.y >= defenseY) {
        const t = (defenseY - bullet.prevY) / Math.max(1, bullet.y - bullet.prevY);
        const hitX = bullet.prevX + (bullet.x - bullet.prevX) * t;
        bullet.dead = true;
        if (hitX >= -bullet.radius && hitX <= this.width + bullet.radius) {
          this.damagePlayer(bullet.damage, clamp(hitX, 0, this.width), defenseY, bullet.color, bullet.variant === "boss" || bullet.variant === "tank");
        }
      }
    }
    this.enemyBullets = this.enemyBullets.filter((bullet) => {
      const inside = bullet.x > -50 && bullet.x < this.width + 50 && bullet.y > -50 && bullet.y < this.height + 50;
      return !bullet.dead && inside;
    });
  }

  damagePlayer(damage, x, y, color, strong = false) {
    if (this.health <= 0 || this.phase !== "playing") return;
    const actualDamage = Math.max(1, Math.round(damage));
    this.lastPlayerDamageAt = performance.now();
    const shieldDamage = Math.min(this.shield, actualDamage);
    this.shield = Math.max(0, this.shield - shieldDamage);
    const healthDamage = actualDamage - shieldDamage;
    this.health = Math.max(0, this.health - healthDamage);
    this.levelDamageTaken += actualDamage;
    this.spawnExplosion(x, y, color || "#f36d6d", strong ? 44 : 26);
    if (shieldDamage > 0) {
      this.spawnFloatingText(x, y - 26, `护盾 -${shieldDamage}`, "#6bf2ff");
    }
    if (healthDamage > 0) {
      this.spawnFloatingText(x, y - 52, `生命 -${healthDamage}`, "#ff7979");
    }
    this.screenShake = Math.max(this.screenShake, strong ? 12 : 5);
    if (strong) this.sound.explosion(true);
    else this.sound.hit();
    if (this.health === 0) {
      this.finishGameOver("生命值耗尽。点击重新开始再试一次。");
    }
  }

  updateShield(dt, now) {
    if (this.shield >= GAME.maxShield) return;
    if (now - this.lastPlayerDamageAt < GAME.shieldRecoverDelayMs) return;
    this.shield = Math.min(GAME.maxShield, this.shield + GAME.shieldRecoverPerSecond * dt);
  }

  fireFromHands(now) {
    const weapon = this.getCurrentWeapon(now);
    for (const handId of ["Left", "Right"]) {
      const targetHand = this.getHandForGun(handId);
      if (!targetHand) continue;
      const gunState = this.tracker.handsState[handId];
      if (now - gunState.lastShotAt < weapon.fireEveryMs) continue;
      this.shoot(handId, targetHand, weapon, now);
    }
  }

  getCurrentWeapon(now = performance.now()) {
    if (this.weaponType !== "normal" && now >= this.weaponUntil) {
      this.weaponType = "normal";
    }
    const base = WEAPONS[this.weaponType] || WEAPONS.normal;
    return {
      ...base,
      fireEveryMs: Math.max(45, base.fireEveryMs * this.playerMods.fireRateMultiplier),
      damage: base.damage + (base.id === "normal" ? this.playerMods.normalDamage : 0),
    };
  }

  getCurrentLevelConfig() {
    const accuracy = this.totalShots > 0 ? this.totalHits / this.totalShots : 0.45;
    const healthRatio = this.health / this.getMaxHealth();
    const pressure = clamp(1 + (accuracy - 0.45) * 0.45 + Math.min(this.combo, 18) * 0.012 - (healthRatio < 0.3 ? 0.22 : 0), 0.78, 1.28);
    const help = healthRatio < 0.35 ? 1.85 : healthRatio < 0.55 ? 1.32 : 1;
    return getLevelConfig(this.level, { pressure, help });
  }

  toGamePoint(point) {
    const bounds = this.calibrationBounds;
    const x = clamp((point.x - bounds.minX) / Math.max(0.08, bounds.maxX - bounds.minX), 0, 1);
    const y = clamp((point.y - bounds.minY) / Math.max(0.08, bounds.maxY - bounds.minY), 0, 1);
    return toCanvasPoint({ x, y }, this.width, this.height);
  }

  isHandActive(hand) {
    return Boolean(hand.smoothPalmCenter || hand.palmCenter) && hand.currentGesture !== "no_hand";
  }

  getActiveHands() {
    return ["Left", "Right"]
      .map((handId) => this.tracker.handsState[handId])
      .filter((hand) => this.isHandActive(hand));
  }

  getHandForGun(handId) {
    const ownHand = this.tracker.handsState[handId];
    const activeHands = this.getActiveHands();
    if (activeHands.length === 1) return activeHands[0];
    if (this.isHandActive(ownHand)) return ownHand;
    return null;
  }

  getGunPosition(handId) {
    const offset = handId === "Left" ? -GAME.gunGap : GAME.gunGap;
    return { x: this.width / 2 + offset, y: this.height - 70 };
  }

  getGunAim(handId, targetHand) {
    const origin = this.getGunPosition(handId);
    const target = this.toGamePoint(targetHand.smoothPalmCenter || targetHand.palmCenter);
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return {
      origin,
      ux: dx / length,
      uy: dy / length,
    };
  }

  shoot(gunId, targetHand, weapon, now) {
    const aim = this.getGunAim(gunId, targetHand);
    const muzzle = {
      x: aim.origin.x + aim.ux * 78,
      y: aim.origin.y + aim.uy * 78,
    };

    const sideOffsets = weapon.sideOffsets || [0];
    let created = 0;
    for (const sideOffset of sideOffsets) {
      for (const angleOffset of weapon.pellets) {
        if (this.bullets.length >= GAME.maxBullets) continue;
        const cos = Math.cos(angleOffset);
        const sin = Math.sin(angleOffset);
        const vx = aim.ux * cos - aim.uy * sin;
        const vy = aim.ux * sin + aim.uy * cos;
        this.createBullet(muzzle, vx, vy, gunId, sideOffset, weapon);
        created += 1;
      }
    }
    this.levelShots += created;
    this.totalShots += created;
    const gunState = this.tracker.handsState[gunId];
    gunState.lastShotAt = now;
    gunState.attackPulseUntil = now + 90;
    if (now - this.lastShootSoundAt > 55) {
      this.lastShootSoundAt = now;
      this.sound.shoot(weapon.id);
    }
  }

  createBullet(origin, ux, uy, gunId, sideOffset, weapon) {
    const px = -uy;
    const py = ux;
    const x = origin.x + px * sideOffset;
    const y = origin.y + py * sideOffset;
    this.bullets.push({
      x,
      y,
      prevX: x,
      prevY: y,
      vx: ux * weapon.bulletSpeed,
      vy: uy * weapon.bulletSpeed,
      damage: weapon.damage,
      radius: weapon.bulletRadius,
      color: weapon.color,
      weaponId: weapon.id,
      beam: Boolean(weapon.beam),
      splashRadius: weapon.splashRadius || 0,
      pierceRemaining: weapon.pierce || 0,
      assistCooldown: Math.random() * 0.035,
      handId: gunId,
      dead: false,
    });
  }

  updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.assistCooldown = Math.max(0, (bullet.assistCooldown || 0) - dt);
      if (bullet.assistCooldown <= 0) {
        this.applyAimAssist(bullet, dt);
        bullet.assistCooldown = bullet.weaponId === "rapid" ? 0.06 : 0.04;
      }
      bullet.prevX = bullet.x;
      bullet.prevY = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const start = { x: bullet.prevX, y: bullet.prevY };
      const end = { x: bullet.x, y: bullet.y };
      let nearest = null;
      for (const monster of this.monsters.monsters) {
        if (monster.dead || bullet.dead) continue;
        const nearPlayerBonus = monster.y > this.height * 0.62 ? GAME.nearHitBonus : 0;
        const radius = monster.r + bullet.radius + nearPlayerBonus;
        if (!segmentMayHitCircle(start, end, monster, radius)) continue;
        const hit = segmentCircleHit(start, end, monster, radius);
        if (hit && (!nearest || hit.t < nearest.hit.t)) {
          nearest = { kind: "monster", target: monster, hit };
        }
      }
      for (const enemyBullet of this.enemyBullets) {
        if (enemyBullet.dead || bullet.dead) continue;
        const radius = enemyBullet.radius + bullet.radius + 5;
        if (!segmentMayHitCircle(start, end, enemyBullet, radius)) continue;
        const hit = segmentCircleHit(start, end, enemyBullet, radius);
        if (hit && (!nearest || hit.t < nearest.hit.t)) {
          nearest = { kind: "enemyBullet", target: enemyBullet, hit };
        }
      }
      if (nearest) {
        bullet.dead = bullet.pierceRemaining <= 0 || (nearest.kind === "monster" && nearest.target.type !== "enemy");
        bullet.pierceRemaining = Math.max(0, bullet.pierceRemaining - 1);
        bullet.x = nearest.hit.x;
        bullet.y = nearest.hit.y;
        if (nearest.kind === "enemyBullet") {
          this.handleEnemyBulletIntercept(nearest.target, bullet, nearest.hit.x, nearest.hit.y);
        } else {
          this.handleTargetHit(nearest.target, bullet, nearest.hit.x, nearest.hit.y);
        }
        if (!bullet.dead) {
          const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
          const targetRadius = nearest.kind === "monster" ? nearest.target.r : nearest.target.radius;
          bullet.x += (bullet.vx / speed) * (targetRadius + bullet.radius + 6);
          bullet.y += (bullet.vy / speed) * (targetRadius + bullet.radius + 6);
        }
      }
    }
    this.bullets = this.bullets.filter((bullet) => {
      const inside = bullet.x > -40 && bullet.x < this.width + 40 && bullet.y > -40 && bullet.y < this.height + 40;
      return !bullet.dead && inside;
    });
  }

  applyAimAssist(bullet, dt) {
    if (bullet.dead) return;
    const speed = Math.hypot(bullet.vx, bullet.vy);
    if (speed <= 0) return;
    const radius = GAME.aimAssistRadius + this.playerMods.aimAssistBonus;
    const dir = { x: bullet.vx / speed, y: bullet.vy / speed };
    let best = null;
    for (const monster of this.monsters.monsters) {
      if (monster.dead || monster.type !== "enemy") continue;
      const dx = monster.x - bullet.x;
      const dy = monster.y - bullet.y;
      if (Math.abs(dx) > 240 || Math.abs(dy) > 240) continue;
      const ahead = dx * dir.x + dy * dir.y;
      if (ahead < 0 || ahead > 180) continue;
      const side = Math.abs(dx * -dir.y + dy * dir.x);
      if (side > radius + monster.r) continue;
      if (!best || ahead < best.ahead) best = { monster, ahead };
    }
    if (!best) return;
    const dx = best.monster.x - bullet.x;
    const dy = best.monster.y - bullet.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const tx = dx / len;
    const ty = dy / len;
    const blend = clamp(dt * 3.2, 0, 0.16);
    const nx = dir.x * (1 - blend) + tx * blend;
    const ny = dir.y * (1 - blend) + ty * blend;
    const nLen = Math.max(1, Math.hypot(nx, ny));
    bullet.vx = (nx / nLen) * speed;
    bullet.vy = (ny / nLen) * speed;
  }

  handleTargetHit(target, bullet, x, y) {
    const now = performance.now();
    this.levelHits += 1;
    this.totalHits += 1;
    target.flashUntil = now + 90;
    if (target.type === "weapon") {
      target.dead = true;
      this.weaponType = target.weaponId || randomDropWeapon(this.weaponType);
      this.weaponUntil = performance.now() + GAME.weaponDurationMs + this.playerMods.weaponDurationBonus;
      this.spawnHitParticles(x, y, WEAPONS[this.weaponType].color);
      this.spawnFloatingText(x, y - 18, WEAPONS[this.weaponType].label, WEAPONS[this.weaponType].color);
      this.weaponBanner = { text: WEAPONS[this.weaponType].label, color: WEAPONS[this.weaponType].color, until: performance.now() + 1400 };
      ui.notice.textContent = `武器切换：${WEAPONS[this.weaponType].label}，持续 ${GAME.weaponDurationMs / 1000} 秒。`;
      this.sound.pickup();
      return;
    }
    if (target.type === "health") {
      target.dead = true;
      const before = this.health;
      this.health = Math.min(this.getMaxHealth(), this.health + 20 + this.playerMods.healthBonus);
      this.spawnHitParticles(x, y, "#64e389");
      this.spawnFloatingText(x, y - 18, `+${this.health - before}`, "#64e389");
      ui.notice.textContent = "生命恢复。";
      this.sound.pickup();
      return;
    }

    const actualDamage = Math.round(bullet.damage * (target.variant === "boss" ? this.playerMods.bossDamageMultiplier : 1));
    target.hp -= actualDamage;
    target.flashUntil = now + 90;
    this.spawnHitParticles(x, y, bullet.color || target.color);
    this.spawnFloatingText(x, y, `-${actualDamage}`, bullet.color || "#f4f8fb");
    this.screenShake = Math.max(this.screenShake, bullet.weaponId === "flame" ? 4 : 2);

    if (bullet.splashRadius > 0) {
      for (const other of this.monsters.monsters) {
        if (other === target || other.dead || other.type !== "enemy") continue;
        if (distance(other, { x, y }) <= bullet.splashRadius + other.r) {
          other.hp -= Math.round(bullet.damage * 0.45);
          this.spawnHitParticles(other.x, other.y, bullet.color);
        }
      }
    }

    const killed = [target, ...this.monsters.monsters.filter((monster) => monster !== target && monster.type === "enemy" && monster.hp <= 0 && !monster.dead)];
    for (const monster of killed) {
      if (monster.dead || monster.hp > 0) continue;
      monster.dead = true;
      this.score += monster.score || 100;
      this.levelKills += 1;
      this.totalKills += 1;
      this.combo = now - this.lastKillAt <= GAME.comboWindowMs ? this.combo + 1 : 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.lastKillAt = now;
      if (this.combo >= 3) {
        const comboBonus = this.combo * 12;
        this.score += comboBonus;
        this.spawnFloatingText(monster.x, monster.y - 38, `连击 +${comboBonus}`, "#ffffff");
      }
      this.spawnExplosion(monster.x, monster.y, monster.color, monster.variant === "tank" ? 34 : 24);
      this.spawnFloatingText(monster.x, monster.y - 18, `+${monster.score || 100}`, "#f6c84c");
      this.screenShake = Math.max(this.screenShake, monster.variant === "boss" ? 16 : 5);
      if (monster.variant === "boss") this.sound.boss();
      else this.sound.kill();
    }
    this.sound.hit();
  }

  handleEnemyBulletIntercept(target, bullet, x, y) {
    const now = performance.now();
    target.dead = true;
    this.levelHits += 1;
    this.totalHits += 1;
    const reward = target.variant === "boss" || target.variant === "tank" ? 12 : 8;
    this.score += reward;
    this.combo = Math.max(1, this.combo);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastKillAt = now;
    this.spawnHitParticles(x, y, target.color || bullet.color || "#f4f8fb");
    this.spawnFloatingText(x, y - 14, `拦截 +${reward}`, "#6bf2ff");
    this.sound.hit();
  }

  spawnHitParticles(x, y, color) {
    const count = Math.min(14, GAME.maxParticles - this.particles.length);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 220;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.34 + Math.random() * 0.38,
        size: 3 + Math.random() * 5,
        color,
      });
    }
  }

  spawnExplosion(x, y, color, count) {
    const actualCount = Math.min(count, GAME.maxParticles - this.particles.length);
    for (let i = 0; i < actualCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 110 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.45,
        size: 4 + Math.random() * 8,
        color,
      });
    }
  }

  updateHud() {
    const weapon = this.getCurrentWeapon();
    const remain = this.weaponType === "normal" ? "" : ` ${Math.ceil(Math.max(0, this.weaponUntil - performance.now()) / 1000)}s`;
    setText(ui.levelState, `${this.level}/${GAME.maxLevel}`);
    setText(ui.score, String(this.score));
    setText(ui.health, `${this.health}/${this.getMaxHealth()}`);
    setText(ui.shieldState, `${Math.ceil(this.shield)}/${GAME.maxShield}`);
    setText(ui.timeLeft, String(Math.ceil(this.timeLeft)));
    setText(ui.weaponState, `${weapon.label}${remain}`);
    setText(ui.comboState, String(this.combo));
    setText(ui.bestState, `${Math.max(this.bestRecord.score || 0, this.score)}`);
    setText(ui.trackingState, this.tracker.status || "未启动");
  }

  render(now) {
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    }
    this.drawBackdrop();
    this.drawDefenseLine();
    this.drawPlayerZone();
    this.drawGuns(now);
    this.drawMonsters(now);
    this.drawBullets();
    this.drawEnemyBullets();
    this.drawParticles();
    this.drawFloatingTexts();
    this.drawWeaponBanner(now);
    if (this.phase === "idle") this.drawStartHint();
    if (this.phase === "calibrating") this.drawCalibrationHint();
    this.drawCrosshairs(now);
    ctx.restore();
  }

  drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#172128");
    gradient.addColorStop(0.55, "#0d1419");
    gradient.addColorStop(1, "#05080b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
  }

  drawPlayerZone() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height - 76, GAME.playerRadius, 0, Math.PI * 2);
    ctx.stroke();
    const barWidth = 190;
    const ratio = clamp(this.health / this.getMaxHealth(), 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(this.width / 2 - barWidth / 2, this.height - 28, barWidth, 8);
    ctx.fillStyle = ratio > 0.35 ? "#64e389" : "#ff7979";
    ctx.fillRect(this.width / 2 - barWidth / 2, this.height - 28, barWidth * ratio, 8);
    const shieldRatio = clamp(this.shield / GAME.maxShield, 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(this.width / 2 - barWidth / 2, this.height - 42, barWidth, 7);
    ctx.fillStyle = "#6bf2ff";
    ctx.fillRect(this.width / 2 - barWidth / 2, this.height - 42, barWidth * shieldRatio, 7);
  }

  drawDefenseLine() {
    const y = this.getDefenseLineY();
    const shieldRatio = clamp(this.shield / GAME.maxShield, 0, 1);
    ctx.save();
    ctx.strokeStyle = shieldRatio > 0 ? "rgba(107, 242, 255, 0.65)" : "rgba(255, 121, 121, 0.72)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(this.width - 24, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.18 + shieldRatio * 0.18;
    ctx.fillStyle = shieldRatio > 0 ? "#6bf2ff" : "#ff7979";
    ctx.fillRect(0, y, this.width, Math.max(2, this.height - y));
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#aeb9c2";
    ctx.font = "700 13px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("防线", 32, y - 10);
    ctx.restore();
  }

  drawGuns(now) {
    const weapon = this.getCurrentWeapon(now);
    for (const handId of ["Left", "Right"]) {
      const gunState = this.tracker.handsState[handId];
      const targetHand = this.getHandForGun(handId);
      const origin = this.getGunPosition(handId);
      const aim = targetHand
        ? this.getGunAim(handId, targetHand)
        : { origin, ux: 0, uy: -1 };
      const active = Boolean(targetHand);
      const firing = now < gunState.attackPulseUntil;

      const bodyColor = active ? weapon.color : "rgba(168, 180, 190, 0.55)";
      const glowColor = active ? weapon.color : "rgba(255, 255, 255, 0.18)";
      const angle = Math.atan2(aim.uy, aim.ux);

      if (this.drawPlayerWeaponSprite(origin, angle, weapon, active, firing, now)) {
        continue;
      }

      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = active ? 18 : 6;
      ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
      ctx.beginPath();
      ctx.ellipse(0, 19, 42, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      const baseGradient = ctx.createRadialGradient(-8, -8, 6, 0, 0, 34);
      baseGradient.addColorStop(0, "rgba(92, 105, 116, 0.98)");
      baseGradient.addColorStop(0.58, "rgba(34, 43, 51, 0.98)");
      baseGradient.addColorStop(1, "rgba(12, 17, 22, 0.98)");
      ctx.fillStyle = baseGradient;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 31, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 21, -Math.PI * 0.88, Math.PI * 0.2);
      ctx.stroke();

      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(angle);
      ctx.shadowBlur = active ? 10 : 0;
      const barrelGradient = ctx.createLinearGradient(-6, -12, 72, 12);
      barrelGradient.addColorStop(0, "rgba(19, 27, 34, 0.98)");
      barrelGradient.addColorStop(0.32, bodyColor);
      barrelGradient.addColorStop(0.72, "rgba(215, 226, 235, 0.78)");
      barrelGradient.addColorStop(1, "rgba(17, 23, 29, 0.98)");
      ctx.fillStyle = barrelGradient;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-9, -12, 78, 24, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(244, 248, 251, 0.42)";
      ctx.beginPath();
      ctx.roundRect(3, -8, 40, 5, 2);
      ctx.fill();

      ctx.fillStyle = firing ? "#ffe199" : "#d9e3ea";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(57, -9, 20, 18, 5);
      ctx.fill();
      ctx.stroke();

      if (firing) {
        const pulse = clamp(1 - (gunState.attackPulseUntil - now) / 90, 0, 1);
        const flashScale = 1 + Math.sin(pulse * Math.PI) * 0.35;
        const flashGradient = ctx.createRadialGradient(75, 0, 2, 90, 0, 24 * flashScale);
        flashGradient.addColorStop(0, "rgba(255, 255, 255, 0.96)");
        flashGradient.addColorStop(0.28, "rgba(255, 230, 142, 0.9)");
        flashGradient.addColorStop(0.62, "rgba(255, 129, 59, 0.55)");
        flashGradient.addColorStop(1, "rgba(255, 94, 38, 0)");
        ctx.fillStyle = flashGradient;
        ctx.beginPath();
        ctx.arc(88, 0, 27 * flashScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 231, 139, 0.82)";
        ctx.beginPath();
        ctx.moveTo(72, 0);
        ctx.lineTo(104, -15 * flashScale);
        ctx.lineTo(94, -4);
        ctx.lineTo(112, 0);
        ctx.lineTo(94, 4);
        ctx.lineTo(104, 15 * flashScale);
        ctx.closePath();
        ctx.fill();
      }

      if (active && weapon.id === "laser") {
        ctx.strokeStyle = "rgba(107, 242, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(78, 0);
        ctx.lineTo(116, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawPlayerWeaponSprite(origin, angle, weapon, active, firing, now) {
    const turret = PLAYER_WEAPON_SHEET.turrets[weapon.id] || PLAYER_WEAPON_SHEET.turrets.normal;
    const base = PLAYER_WEAPON_SHEET.base;
    if (!playerWeaponSheetReady || !turret || !base) return false;

    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.globalAlpha = active ? 1 : 0.62;
    ctx.shadowColor = active ? weapon.color : "rgba(255, 255, 255, 0.18)";
    ctx.shadowBlur = active ? 14 : 4;
    ctx.drawImage(
      playerWeaponSheet,
      base.x,
      base.y,
      base.w,
      base.h,
      -50,
      -22,
      100,
      64,
    );

    ctx.rotate(angle + Math.PI / 2);
    ctx.drawImage(
      playerWeaponSheet,
      turret.x,
      turret.y,
      turret.w,
      turret.h,
      -turret.drawW / 2,
      -turret.drawH + 28,
      turret.drawW,
      turret.drawH,
    );
    ctx.restore();

    if (firing) {
      this.drawSpriteMuzzleFlash(origin, angle, weapon.color, now);
    }
    return true;
  }

  drawSpriteMuzzleFlash(origin, angle, color, now) {
    const pulse = 0.74 + Math.sin(now * 0.05) * 0.18;
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(255, 246, 190, 0.88)";
    ctx.beginPath();
    ctx.moveTo(74, 0);
    ctx.lineTo(106, -11 * pulse);
    ctx.lineTo(96, 0);
    ctx.lineTo(106, 11 * pulse);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(86, 0, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMonsters(now) {
    for (const monster of this.monsters.monsters) {
      ctx.save();
      ctx.translate(monster.x, monster.y);
      const isFlashing = now < (monster.flashUntil || 0);
      if (monster.type === "weapon") {
        if (!this.drawSpriteAsset("weapon", monster.r * 2.5, monster.r * 2.15, isFlashing)) {
          this.drawSupplyPod(monster, isFlashing, "weapon");
        }
      } else if (monster.type === "health") {
        if (!this.drawSpriteAsset("health", monster.r * 2.25, monster.r * 2.25, isFlashing)) {
          this.drawSupplyPod(monster, isFlashing, "health");
        }
      } else {
        if (!this.drawAlienSprite(monster, isFlashing, now)) {
          this.drawAlienShip(monster, isFlashing, now);
        }
        if (monster.maxHp > 1) {
          this.drawEnemyHealthBar(monster);
        }
      }
      ctx.restore();
    }
  }

  drawAlienSprite(monster, isFlashing, now) {
    const key = SPRITE_SHEET.rects[monster.variant] ? monster.variant : "grunt";
    const width = monster.variant === "boss" ? monster.r * 2.7 : monster.r * 2.55;
    const height = monster.variant === "boss" ? monster.r * 1.8 : monster.r * 2.05;
    const drawn = this.drawSpriteAsset(key, width, height, isFlashing, Math.PI);
    if (!drawn) return false;
    this.drawAttackWarning(monster, now);
    return true;
  }

  drawSpriteAsset(key, width, height, isFlashing, rotation = 0) {
    const rect = SPRITE_SHEET.rects[key];
    if (!spriteSheetReady || !rect) return false;
    ctx.save();
    if (rotation) ctx.rotate(rotation);
    if (isFlashing) {
      ctx.globalAlpha = 0.95;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 18;
    }
    ctx.drawImage(
      spriteSheet,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      -width / 2,
      -height / 2,
      width,
      height,
    );
    if (isFlashing) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(-width / 2, -height / 2, width, height);
    }
    ctx.restore();
    return true;
  }

  drawAttackWarning(monster, now) {
    if (!(monster.attackWarningUntil && now < monster.attackWarningUntil)) return;
    const profile = monster.pendingAttackProfile || ENEMY_ATTACKS[monster.variant] || ENEMY_ATTACKS.grunt;
    const left = clamp((monster.attackWarningUntil - now) / Math.max(1, profile.warningMs || 600), 0, 1);
    const pulse = 1 - left;
    ctx.save();
    ctx.rotate(monster.pendingAttackAngle || Math.PI / 2);
    ctx.strokeStyle = `rgba(255, 76, 76, ${0.28 + pulse * 0.5})`;
    ctx.lineWidth = 2 + pulse * 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(monster.r * 0.62, 0);
    ctx.lineTo(this.height, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 76, 76, ${0.35 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(monster.r * 0.52, 0, monster.r * (0.16 + pulse * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSupplyPod(monster, isFlashing, kind) {
    const r = monster.r;
    const bodyColor = isFlashing ? "#ffffff" : monster.color;
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.52)";
    if (kind === "weapon") {
      const gradient = ctx.createLinearGradient(-r, -r, r, r);
      gradient.addColorStop(0, "#f4f8fb");
      gradient.addColorStop(0.38, bodyColor);
      gradient.addColorStop(1, "#16212a");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1);
      ctx.lineTo(r * 1.05, -r * 0.28);
      ctx.lineTo(r * 0.78, r * 0.92);
      ctx.lineTo(-r * 0.78, r * 0.92);
      ctx.lineTo(-r * 1.05, -r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(8, 12, 16, 0.82)";
      ctx.beginPath();
      ctx.roundRect(-r * 0.52, -r * 0.18, r * 1.04, r * 0.58, 5);
      ctx.fill();
      ctx.fillStyle = "#f4f8fb";
      ctx.font = "900 15px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(WEAPONS[monster.weaponId] ? WEAPONS[monster.weaponId].icon : "W", 0, r * 0.12);
    } else {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(-r * 0.74, -r, r * 1.48, r * 2, r * 0.42);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(244, 248, 251, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.34, r * 0.42, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111820";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, r * 0.28);
      ctx.lineTo(r * 0.42, r * 0.28);
      ctx.moveTo(0, -r * 0.14);
      ctx.lineTo(0, r * 0.7);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  drawAlienShip(monster, isFlashing, now) {
    const r = monster.r;
    const bodyColor = isFlashing ? "#ffffff" : monster.color;
    const dark = "#071018";
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = monster.variant === "boss" ? 20 : 12;
    ctx.lineWidth = monster.variant === "boss" ? 5 : 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillStyle = bodyColor;

    this.drawAttackWarning(monster, now);

    if (monster.variant === "boss") {
      if (now < (monster.warningUntil || 0)) {
        ctx.save();
        ctx.rotate(Math.atan2(this.height - 76 - monster.y, this.width / 2 - monster.x));
        ctx.strokeStyle = "rgba(255, 76, 76, 0.78)";
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.height, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      const hull = ctx.createLinearGradient(0, -r, 0, r);
      hull.addColorStop(0, "#f4f8fb");
      hull.addColorStop(0.18, bodyColor);
      hull.addColorStop(1, "#351d46");
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.24, r * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(18, 26, 36, 0.86)";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.26, r * 0.58, r * 0.32, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillStyle = i === 0 ? "#f6c84c" : "#6bf2ff";
        ctx.beginPath();
        ctx.arc(i * r * 0.34, r * 0.12, r * 0.055, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.roundRect(-r * 0.7, r * 0.38, r * 1.4, r * 0.16, r * 0.06);
      ctx.fill();
      ctx.fillStyle = "#f4f8fb";
      ctx.font = "900 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(monster.label, 0, -r * 0.02);
      ctx.shadowBlur = 0;
      return;
    }

    if (monster.variant === "charger") {
      const gradient = ctx.createLinearGradient(0, -r, 0, r);
      gradient.addColorStop(0, "#ffe0a7");
      gradient.addColorStop(0.42, bodyColor);
      gradient.addColorStop(1, "#6f2a16");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, r * 1.2);
      ctx.lineTo(r * 0.82, -r * 0.1);
      ctx.lineTo(r * 0.28, -r * 0.42);
      ctx.lineTo(r * 0.18, -r * 0.95);
      ctx.lineTo(-r * 0.18, -r * 0.95);
      ctx.lineTo(-r * 0.28, -r * 0.42);
      ctx.lineTo(-r * 0.82, -r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      this.drawShipCore(r, "突");
    } else if (monster.variant === "tank") {
      const gradient = ctx.createLinearGradient(-r, -r, r, r);
      gradient.addColorStop(0, "#ffd3d3");
      gradient.addColorStop(0.32, bodyColor);
      gradient.addColorStop(1, "#471318");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(-r * 1.02, -r * 0.56, r * 2.04, r * 1.12, r * 0.16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(6, 10, 14, 0.38)";
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.roundRect(i * r * 0.42 - r * 0.13, -r * 0.44, r * 0.26, r * 0.88, 4);
        ctx.fill();
      }
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.92);
      ctx.lineTo(r * 0.42, r * 0.28);
      ctx.lineTo(-r * 0.42, r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      this.drawShipCore(r, "甲");
    } else if (monster.variant === "fast") {
      const gradient = ctx.createLinearGradient(0, -r, 0, r);
      gradient.addColorStop(0, "#d8fbff");
      gradient.addColorStop(0.38, bodyColor);
      gradient.addColorStop(1, "#0d4052");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, r * 1.25);
      ctx.lineTo(r * 0.36, r * 0.14);
      ctx.lineTo(r * 0.92, -r * 0.22);
      ctx.lineTo(r * 0.22, -r * 0.3);
      ctx.lineTo(r * 0.12, -r);
      ctx.lineTo(-r * 0.12, -r);
      ctx.lineTo(-r * 0.22, -r * 0.3);
      ctx.lineTo(-r * 0.92, -r * 0.22);
      ctx.lineTo(-r * 0.36, r * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      this.drawShipCore(r, "截");
    } else if (monster.variant === "dodger") {
      const gradient = ctx.createLinearGradient(0, -r, 0, r);
      gradient.addColorStop(0, "#f4f8fb");
      gradient.addColorStop(0.34, bodyColor);
      gradient.addColorStop(1, "#37214f");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.1, r * 1.08, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(30, 37, 54, 0.82)";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.18, r * 0.48, r * 0.34, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      for (let i = -1; i <= 1; i += 1) {
        ctx.fillStyle = i === 0 ? "#f6c84c" : "#6bf2ff";
        ctx.beginPath();
        ctx.arc(i * r * 0.42, r * 0.16, r * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      this.drawShipCore(r, "碟", r * 0.42);
    } else {
      const gradient = ctx.createLinearGradient(0, -r, 0, r);
      gradient.addColorStop(0, "#eefbd9");
      gradient.addColorStop(0.36, bodyColor);
      gradient.addColorStop(1, "#223b1f");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, r * 1.05);
      ctx.lineTo(r * 0.64, r * 0.1);
      ctx.lineTo(r * 0.98, -r * 0.46);
      ctx.lineTo(r * 0.26, -r * 0.22);
      ctx.lineTo(r * 0.18, -r * 0.92);
      ctx.lineTo(-r * 0.18, -r * 0.92);
      ctx.lineTo(-r * 0.26, -r * 0.22);
      ctx.lineTo(-r * 0.98, -r * 0.46);
      ctx.lineTo(-r * 0.64, r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      this.drawShipCore(r, "侦");
    }

    ctx.fillStyle = "rgba(255, 154, 76, 0.9)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.78, r * 0.09, r * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.22, -r * 0.78, r * 0.09, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawShipCore(r, label, labelY = 0) {
    ctx.fillStyle = "rgba(6, 12, 18, 0.72)";
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.04, r * 0.32, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f8fb";
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, labelY);
  }

  drawEnemyHealthBar(monster) {
    const barWidth = monster.variant === "boss" ? monster.r * 1.9 : monster.r * 1.58;
    const ratio = clamp(monster.hp / monster.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(-barWidth / 2, -monster.r - 12, barWidth, 5);
    ctx.fillStyle = ratio > 0.45 ? "#64e389" : "#ff7979";
    ctx.fillRect(-barWidth / 2, -monster.r - 12, barWidth * ratio, 5);
  }

  drawParticles() {
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life * 2.4, 0, 1);
      ctx.fillStyle = particle.color || "#f6c84c";
      const size = particle.size || 6;
      ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  drawFloatingTexts() {
    ctx.textAlign = "center";
    ctx.font = "800 16px system-ui";
    for (const item of this.floatingTexts) {
      ctx.globalAlpha = clamp(item.life, 0, 1);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.globalAlpha = 1;
  }

  drawWeaponBanner(now) {
    if (!this.weaponBanner || now > this.weaponBanner.until) return;
    const alpha = clamp((this.weaponBanner.until - now) / 450, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = "900 34px system-ui";
    ctx.fillStyle = this.weaponBanner.color;
    ctx.shadowColor = this.weaponBanner.color;
    ctx.shadowBlur = 18;
    ctx.fillText(this.weaponBanner.text, this.width / 2, this.height * 0.24);
    ctx.restore();
  }

  drawBullets() {
    for (const bullet of this.bullets) {
      const color = bullet.color || (bullet.handId === "Left" ? "#56d5e2" : "#b68cff");
      ctx.strokeStyle = color;
      ctx.lineWidth = bullet.beam ? 8 : Math.max(4, bullet.radius);
      ctx.globalAlpha = bullet.beam ? 0.58 : 0.42;
      ctx.beginPath();
      ctx.moveTo(bullet.prevX, bullet.prevY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (bullet.weaponId === "flame") {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#ffd27a";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawEnemyBullets() {
    for (const bullet of this.enemyBullets) {
      const color = bullet.color || "#ff7979";
      const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
      const tx = bullet.vx / speed;
      const ty = bullet.vy / speed;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = bullet.variant === "boss" ? 10 : 6;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, bullet.radius * 0.9);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(bullet.x - tx * bullet.radius * 4.2, bullet.y - ty * bullet.radius * 4.2);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, Math.max(2, bullet.radius * 0.45), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawCrosshairs(now) {
    this.drawHandCrosshair(this.tracker.handsState.Left, now, "#56d5e2");
    this.drawHandCrosshair(this.tracker.handsState.Right, now, "#b68cff");
  }

  drawHandCrosshair(hand, now, color) {
    const center = hand.smoothPalmCenter || hand.palmCenter;
    if (!center) return;
    if (hand.currentGesture === "no_hand") return;
    const point = this.toGamePoint(center);
    const radius = 30;
    ctx.strokeStyle = color;
    ctx.fillStyle = "rgba(86, 213, 226, 0.12)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x - 18, point.y);
    ctx.lineTo(point.x + 18, point.y);
    ctx.moveTo(point.x, point.y - 18);
    ctx.lineTo(point.x, point.y + 18);
    ctx.stroke();
  }

  drawStartHint() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4f8fb";
    ctx.font = "700 34px system-ui";
    ctx.fillText("点击开始，允许摄像头访问", this.width / 2, this.height / 2 - 18);
    ctx.fillStyle = "#aeb9c2";
    ctx.font = "500 18px system-ui";
    ctx.fillText("击退外星舰队：侦察机、截击机、飞碟、重甲舰和母舰", this.width / 2, this.height / 2 + 24);
  }

  drawCalibrationHint() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(0, 0, this.width, this.height);
    const draft = this.calibrationDraft;
    if (!draft || draft.samples < 2) return;
    const min = toCanvasPoint({ x: draft.minX, y: draft.minY }, this.width, this.height);
    const max = toCanvasPoint({ x: draft.maxX, y: draft.maxY }, this.width, this.height);
    ctx.strokeStyle = "rgba(246, 200, 76, 0.82)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
    ctx.setLineDash([]);
  }
}

new Game();

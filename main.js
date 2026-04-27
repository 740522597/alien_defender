"use strict";

const video = document.getElementById("camera");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

const ui = {
  scoreFxLayer: document.getElementById("scoreFxLayer"),
  levelState: document.getElementById("levelState"),
  score: document.getElementById("score"),
  health: document.getElementById("health"),
  shieldState: document.getElementById("shieldState"),
  timeLeft: document.getElementById("timeLeft"),
  weaponState: document.getElementById("weaponState"),
  specialSlot: document.getElementById("specialSlot"),
  specialState: document.getElementById("specialState"),
  specialCooldownState: document.getElementById("specialCooldownState"),
  comboState: document.getElementById("comboState"),
  specialSlotIcon: document.getElementById("specialSlotIcon"),
  notice: document.getElementById("notice"),
  startBtn: document.getElementById("startBtn"),
  difficultySelect: document.getElementById("difficultySelect"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  calibrateBtn: document.getElementById("calibrateBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  restartBtn: document.getElementById("restartBtn"),
  recordStartBtn: document.getElementById("recordStartBtn"),
  recordStopBtn: document.getElementById("recordStopBtn"),
  levelOverlay: document.getElementById("levelOverlay"),
  summaryTitle: document.getElementById("summaryTitle"),
  summaryStats: document.getElementById("summaryStats"),
  summaryCountdown: document.getElementById("summaryCountdown"),
  upgradeChoices: document.getElementById("upgradeChoices"),
  nextLevelBtn: document.getElementById("nextLevelBtn"),
};

const recorderState = {
  recorder: null,
  chunks: [],
  stream: null,
  isRecording: false,
  mimeType: "video/webm",
};

function readDebugOptions() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("debug")) {
    return { enabled: false, startLevel: 1, infiniteSpecial: false };
  }
  const debugValue = params.get("debug") || "1";
  const levelValue = params.get("level") || params.get("stage") || (/^\d+$/.test(debugValue) ? debugValue : "1");
  return {
    enabled: debugValue !== "0" && debugValue !== "false",
    startLevel: clamp(Number.parseInt(levelValue, 10) || 1, 1, GAME.maxLevel),
    infiniteSpecial: true,
  };
}

const MEDIAPIPE_HANDS_VERSION = "0.4.1675469240";
const CDN = {
  hands: `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/hands.js`,
  assets: `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/`,
};

const GAME = {
  attackRadius: 74,
  playerRadius: 82,
  maxLevel: 10,
  maxHealth: 100,
  maxShield: 100,
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
  maxScoreEffects: 48,
  comboWindowMs: 1800,
  aimAssistRadius: 68,
  nearHitBonus: 14,
  specialCooldownMs: 30000,
  specialDurationMs: 15000,
  specialScoreAward: 10000,
  maxFighters: 5,
};

const DEBUG_TURRET_PIVOT = false;
const TURRET_PIVOT_CONFIG = {
  gunPivotXRatio: 0.5,
  gunPivotYRatio: 0.72,
  gunOffsetX: 0,
  gunOffsetY: 0,
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
  base: { x: 54, y: 132, w: 214, h: 170, drawW: 126, drawH: 100 },
  guns: {
    normal: { x: 52, y: 464, w: 186, h: 252, drawW: 126, drawH: 170, muzzle: 128 },
    rapid: { x: 292, y: 466, w: 196, h: 252, drawW: 132, drawH: 170, muzzle: 126 },
    spread: { x: 532, y: 466, w: 196, h: 252, drawW: 132, drawH: 170, muzzle: 122 },
    laser: { x: 772, y: 460, w: 196, h: 258, drawW: 132, drawH: 174, muzzle: 132 },
    flame: { x: 1012, y: 466, w: 220, h: 254, drawW: 148, drawH: 170, muzzle: 124 },
    double: { x: 1252, y: 466, w: 220, h: 254, drawW: 148, drawH: 170, muzzle: 124 },
  },
};

const playerWeaponSheet = new Image();
let playerWeaponSheetReady = false;
const playerWeaponSprites = {
  base: null,
  guns: {},
};
playerWeaponSheet.onload = () => {
  buildPlayerWeaponSprites(playerWeaponSheet);
  playerWeaponSheetReady = true;
};
playerWeaponSheet.onerror = () => {
  playerWeaponSheetReady = false;
};
playerWeaponSheet.src = PLAYER_WEAPON_SHEET.src;

const FRIEND_PLANE_SHEET = {
  src: "./assets/friend_planes.png",
  cellW: 512,
  cellH: 512,
  rects: [
    { x: 0, y: 0, w: 512, h: 512, color: "#56d5e2" },
    { x: 512, y: 0, w: 512, h: 512, color: "#ff6d4a" },
    { x: 1024, y: 0, w: 512, h: 512, color: "#f6c84c" },
    { x: 0, y: 512, w: 512, h: 512, color: "#8be36f" },
    { x: 512, y: 512, w: 512, h: 512, color: "#b68cff" },
    { x: 1024, y: 512, w: 512, h: 512, color: "#6bf2ff" },
  ],
};

const friendPlaneSheet = new Image();
let friendPlaneSheetReady = false;
let friendPlaneCanvas = null;
friendPlaneSheet.onload = () => {
  friendPlaneCanvas = buildTransparentSpriteCanvas(friendPlaneSheet);
  friendPlaneSheetReady = Boolean(friendPlaneCanvas);
  updateSpecialSlotIcon();
};
friendPlaneSheet.onerror = () => {
  friendPlaneSheetReady = false;
};
friendPlaneSheet.src = FRIEND_PLANE_SHEET.src;

const WEAPON_MISSILE_SHEET = {
  src: "./assets/weapon_package_enemy_missle.png",
  packages: {
    normal: { x: 198, y: 56, w: 292, h: 254 },
    rapid: { x: 606, y: 56, w: 292, h: 254 },
    spread: { x: 1024, y: 56, w: 292, h: 254 },
    laser: { x: 198, y: 340, w: 292, h: 254 },
    flame: { x: 606, y: 340, w: 292, h: 254 },
    double: { x: 1024, y: 340, w: 292, h: 254 },
  },
  missiles: {
    grunt: { x: 104, y: 594, w: 150, h: 350 },
    fast: { x: 326, y: 586, w: 170, h: 354 },
    charger: { x: 562, y: 594, w: 174, h: 350 },
    tank: { x: 782, y: 590, w: 200, h: 356 },
    dodger: { x: 1018, y: 594, w: 184, h: 344 },
    boss: { x: 1244, y: 588, w: 210, h: 356 },
  },
};

const weaponMissileSheet = new Image();
let weaponMissileSheetReady = false;
let weaponMissileCanvas = null;
weaponMissileSheet.onload = () => {
  weaponMissileCanvas = buildTransparentSpriteCanvas(weaponMissileSheet);
  weaponMissileSheetReady = Boolean(weaponMissileCanvas);
};
weaponMissileSheet.onerror = () => {
  weaponMissileSheetReady = false;
};
weaponMissileSheet.src = WEAPON_MISSILE_SHEET.src;

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
  { name: "母舰 I", bias: { grunt: 0.5, fast: 0.2, tank: 0.12, charger: 0.08, dodger: 0.06 }, hp: 1.02, speed: 0.96, weapon: 1.04, health: 1.18 },
  { name: "补给", bias: { grunt: 0.46, fast: 0.22, tank: 0.14, charger: 0.1, dodger: 0.08 }, hp: 1.05, speed: 1.05, weapon: 1.5, health: 1.08 },
  { name: "闪避", bias: { grunt: 0.34, fast: 0.16, tank: 0.12, charger: 0.08, dodger: 0.3 }, hp: 1.08, speed: 1.12, weapon: 1.05, health: 0.98 },
  { name: "短缺", bias: { grunt: 0.38, fast: 0.2, tank: 0.18, charger: 0.16, dodger: 0.08 }, hp: 1.1, speed: 1.08, weapon: 0.92, health: 0.62 },
  { name: "混战", bias: { grunt: 0.3, fast: 0.2, tank: 0.2, charger: 0.18, dodger: 0.12 }, hp: 1.16, speed: 1.14, weapon: 1, health: 0.9 },
  { name: "母舰 II", bias: { grunt: 0.34, fast: 0.22, tank: 0.18, charger: 0.14, dodger: 0.12 }, hp: 1.12, speed: 1.09, weapon: 1.04, health: 0.98 },
];

const UPGRADES = [
  { id: "maxHealth", title: "生命上限 +10", desc: "立即提高最大生命，并恢复 10 点。", apply: (game) => { game.playerMods.maxHealthBonus += 10; game.health = Math.min(game.getMaxHealth(), game.health + 10); } },
  { id: "normalDamage", title: "普通弹伤害 +2", desc: "普通武器更适合稳定击毁小型舰船。", apply: (game) => { game.playerMods.normalDamage += 2; } },
  { id: "weaponTime", title: "武器时间 +3 秒", desc: "武器包持续更久。", apply: (game) => { game.playerMods.weaponDurationBonus += 3000; } },
  { id: "heal", title: "医疗恢复 +10", desc: "每个医疗包恢复更多生命。", apply: (game) => { game.playerMods.healthBonus += 10; } },
  { id: "fireRate", title: "炮塔射速 +8%", desc: "所有武器开火间隔降低。", apply: (game) => { game.playerMods.fireRateMultiplier *= 0.92; } },
  { id: "bossDamage", title: "母舰伤害 +15%", desc: "所有子弹打母舰更痛。", apply: (game) => { game.playerMods.bossDamageMultiplier += 0.15; } },
  { id: "aimAssist", title: "辅助瞄准 +12", desc: "子弹更容易贴近敌舰。", apply: (game) => { game.playerMods.aimAssistBonus += 12; } },
  {
    id: "fighterCount",
    title: "战斗机 +1",
    desc: "特殊技能多派出 1 架战斗机，最多 5 架。",
    canOffer: (game) => game.playerMods.fighterCount < GAME.maxFighters,
    apply: (game) => {
      game.playerMods.fighterCount = Math.min(GAME.maxFighters, game.playerMods.fighterCount + 1);
    },
  },
];

function getLevelConfig(level, adaptive = {}) {
  const t = (level - 1) / (GAME.maxLevel - 1);
  const pressure = adaptive.pressure || 1;
  const help = adaptive.help || 1;
  const theme = LEVEL_THEMES[level - 1] || LEVEL_THEMES[LEVEL_THEMES.length - 1];
  const bossRound = isBossLevel(level);
  return {
    level,
    theme,
    spawnEvery: Math.max(0.28, (0.95 - t * 0.58) / pressure),
    spawnJitter: Math.max(0.14, 0.5 - t * 0.25),
    speedBase: (56 + level * 7) * pressure * theme.speed,
    speedJitter: 48 + level * 5,
    enemyHp: (18 + (level - 1) * 7) * theme.hp,
    enemyDamage: 6 + Math.floor((level - 1) * 2.4),
    weaponChance: clamp((0.12 - t * 0.03) * theme.weapon * (bossRound ? 1.45 : 1), 0.06, bossRound ? 0.28 : 0.18),
    healthChance: clamp((0.09 - t * 0.03) * help * theme.health * (bossRound ? 1.25 : 1), 0.035, bossRound ? 0.24 : 0.2),
    eliteChance: clamp(0.04 + t * 0.24, 0.04, 0.28),
    maxMonsters: Math.round(GAME.maxMonsters * clamp(pressure, 0.82, 1.28)),
    bossEnemyLimit: level === 5 ? 6 : level === 10 ? 8 : GAME.maxMonsters,
    bossEnemyTotalLimit: level === 5 ? 30 : level === 10 ? 30 : Infinity,
    bossSummonWave: level === 5 ? 10 : level === 10 ? 10 : 1,
    bossMinionBurstMin: 2,
    bossMinionBurstMax: 3,
    bossMinionBurstInterval: level === 5 ? 1800 : level === 10 ? 1550 : 1800,
  };
}

function isBossLevel(level) {
  return level === 5 || level === 10;
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

function buildTransparentSpriteCanvas(image) {
  const sheet = document.createElement("canvas");
  sheet.width = image.naturalWidth || image.width;
  sheet.height = image.naturalHeight || image.height;
  const sheetCtx = sheet.getContext("2d", { willReadFrequently: true });
  if (!sheetCtx || !sheet.width || !sheet.height) return null;
  sheetCtx.drawImage(image, 0, 0);
  const data = sheetCtx.getImageData(0, 0, sheet.width, sheet.height);
  const width = sheet.width;
  const height = sheet.height;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const isBackground = (index) => {
    const offset = index * 4;
    const r = data.data[offset];
    const g = data.data[offset + 1];
    const b = data.data[offset + 2];
    const bright = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    return bright > 178 && spread < 26;
  };
  const pushIfBackground = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const index = y * width + x;
    if (seen[index] || !isBackground(index)) return;
    seen[index] = 1;
    stack.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    data.data[index * 4 + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    pushIfBackground(x + 1, y);
    pushIfBackground(x - 1, y);
    pushIfBackground(x, y + 1);
    pushIfBackground(x, y - 1);
  }
  sheetCtx.putImageData(data, 0, 0);
  return sheet;
}

function updateSpecialSlotIcon() {
  if (!ui.specialSlotIcon || !friendPlaneCanvas || !friendPlaneSheetReady) return;
  const rect = FRIEND_PLANE_SHEET.rects[0];
  const icon = document.createElement("canvas");
  icon.width = 128;
  icon.height = 128;
  const iconCtx = icon.getContext("2d");
  if (!iconCtx) return;
  iconCtx.drawImage(
    friendPlaneCanvas,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    0,
    0,
    icon.width,
    icon.height,
  );
  ui.specialSlotIcon.style.backgroundImage = `url("${icon.toDataURL("image/png")}")`;
  ui.specialSlotIcon.style.backgroundSize = "contain";
  ui.specialSlotIcon.style.backgroundPosition = "center";
}

function buildPlayerWeaponSprites(image) {
  playerWeaponSprites.base = buildPlayerWeaponLayer(image, PLAYER_WEAPON_SHEET.base, 8);
  playerWeaponSprites.guns = {};
  Object.keys(PLAYER_WEAPON_SHEET.guns).forEach((key) => {
    const source = PLAYER_WEAPON_SHEET.guns[key];
    const layer = buildPlayerWeaponLayer(image, source, 8);
    if (!layer) return;
    playerWeaponSprites.guns[key] = {
      ...layer,
      pivotX: layer.drawW * TURRET_PIVOT_CONFIG.gunPivotXRatio,
      pivotY: layer.drawH * TURRET_PIVOT_CONFIG.gunPivotYRatio,
      muzzle: source.muzzle,
    };
  });
}

function buildPlayerWeaponLayer(image, source, pad) {
  const sprite = document.createElement("canvas");
  sprite.width = source.w + pad * 2;
  sprite.height = source.h + pad * 2;
  const spriteCtx = sprite.getContext("2d");
  if (!spriteCtx) return null;
  spriteCtx.drawImage(
    image,
    source.x,
    source.y,
    source.w,
    source.h,
    pad,
    pad,
    source.w,
    source.h,
  );
  removeConnectedLightBackground(sprite, spriteCtx, {
    x: pad,
    y: pad,
    w: source.w,
    h: source.h,
  });
  return {
    canvas: sprite,
    drawW: source.drawW * (sprite.width / source.w),
    drawH: source.drawH * (sprite.height / source.h),
  };
}

function removeConnectedLightBackground(canvas, layerCtx, bounds) {
  const width = canvas.width;
  const height = canvas.height;
  const data = layerCtx.getImageData(0, 0, width, height);
  const seen = new Uint8Array(width * height);
  const stack = [];
  const left = bounds ? bounds.x : 0;
  const top = bounds ? bounds.y : 0;
  const right = bounds ? bounds.x + bounds.w - 1 : width - 1;
  const bottom = bounds ? bounds.y + bounds.h - 1 : height - 1;
  const cornerSamples = [
    samplePixel(data, top * width + left),
    samplePixel(data, top * width + right),
    samplePixel(data, bottom * width + left),
    samplePixel(data, bottom * width + right),
  ];
  const isLightBackground = (index) => {
    const offset = index * 4;
    const alpha = data.data[offset + 3];
    if (alpha === 0) return false;
    const r = data.data[offset];
    const g = data.data[offset + 1];
    const b = data.data[offset + 2];
    const bright = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const nearCorner = cornerSamples.some((sample) => colorDistance(sample, { r, g, b }) < 128);
    return bright > 112 && spread < 90 && nearCorner;
  };
  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const index = y * width + x;
    if (seen[index] || !isLightBackground(index)) return;
    seen[index] = 1;
    stack.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  for (let x = left; x <= right; x += 1) {
    push(x, top);
    push(x, bottom);
  }
  for (let y = top; y <= bottom; y += 1) {
    push(left, y);
    push(right, y);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    data.data[index * 4 + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  layerCtx.putImageData(data, 0, 0);
}

function samplePixel(data, index) {
  const offset = index * 4;
  return {
    r: data.data[offset],
    g: data.data[offset + 1],
    b: data.data[offset + 2],
  };
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) return "video/webm;codecs=vp9";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) return "video/webm;codecs=vp8";
  return "video/webm";
}

function setRecordingUi(isRecording) {
  if (ui.recordStartBtn) {
    ui.recordStartBtn.disabled = isRecording;
    ui.recordStartBtn.classList.toggle("is-recording", isRecording);
    ui.recordStartBtn.textContent = isRecording ? "● 录制中" : "开始录制";
  }
  if (ui.recordStopBtn) {
    ui.recordStopBtn.disabled = !isRecording;
  }
}

function startGameRecording() {
  if (recorderState.isRecording) return;
  if (typeof MediaRecorder === "undefined") {
    window.alert("当前浏览器不支持 MediaRecorder");
    return;
  }
  if (!canvas) {
    window.alert("找不到游戏画布");
    return;
  }
  if (!canvas.captureStream) {
    window.alert("当前浏览器不支持 canvas.captureStream");
    return;
  }

  let canvasStream = null;
  try {
    canvasStream = canvas.captureStream(60);
  } catch (error) {
    console.warn("60fps capture failed, fallback to browser default", error);
    canvasStream = canvas.captureStream();
  }

  const stream = new MediaStream(canvasStream.getVideoTracks());
  const sound = window.bodyFightGame && window.bodyFightGame.sound;
  const audioStream = sound && sound.getRecordingStream ? sound.getRecordingStream() : null;
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
  }

  const mimeType = getRecordingMimeType();
  const options = mimeType
    ? { mimeType, videoBitsPerSecond: 8000000 }
    : { videoBitsPerSecond: 8000000 };

  let recorder = null;
  try {
    recorder = new MediaRecorder(stream, options);
  } catch (error) {
    console.warn("Preferred recorder options failed, fallback to default", error);
    recorder = new MediaRecorder(stream);
  }

  recorderState.chunks = [];
  recorderState.stream = stream;
  recorderState.recorder = recorder;
  recorderState.isRecording = true;
  recorderState.mimeType = recorder.mimeType || mimeType || "video/webm";
  setRecordingUi(true);

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) recorderState.chunks.push(event.data);
  };

  recorder.onerror = (event) => {
    console.error("Recording failed", event.error || event);
    stopGameRecording();
  };

  recorder.onstop = () => {
    const blob = new Blob(recorderState.chunks, { type: recorderState.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `body-fight-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (recorderState.stream) {
      for (const track of recorderState.stream.getTracks()) {
        if (track.kind === "video") track.stop();
      }
    }
    recorderState.recorder = null;
    recorderState.stream = null;
    recorderState.chunks = [];
    recorderState.isRecording = false;
    setRecordingUi(false);
  };

  recorder.start();
}

function stopGameRecording() {
  if (!recorderState.recorder || !recorderState.isRecording) return;
  recorderState.recorder.stop();
}

class SoundFx {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.recordingDestination = null;
  }

  enable() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.enabled = true;
  }

  getRecordingStream() {
    this.enable();
    if (!this.ctx || !this.ctx.createMediaStreamDestination) return null;
    if (!this.recordingDestination) {
      this.recordingDestination = this.ctx.createMediaStreamDestination();
    }
    return this.recordingDestination.stream;
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
    if (this.recordingDestination) gain.connect(this.recordingDestination);
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

  special() {
    this.tone(520, 0.1, "sine", 0.04, 920);
    window.setTimeout(() => this.tone(760, 0.12, "triangle", 0.035, 1140), 82);
    window.setTimeout(() => this.tone(1040, 0.14, "square", 0.025, 520), 170);
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
    this.loadFailed = false;
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
    this.loadFailed = false;
    this.status = "模型已加载，等待首帧";
  }

  async rebuildModel() {
    if (this.recovering) return;
    this.recovering = true;
    this.ready = false;
    this.busy = false;
    this.status = "追踪模块重启中";
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
    if (!this.ready || this.recovering || this.loadFailed || this.source.readyState < 2) return;
    if (!this.source.videoWidth || !this.source.videoHeight) {
      this.status = "等待摄像头画面";
      return;
    }
    if (this.busy) {
      const elapsed = now - this.sendStartedAt;
      if (this.resultCount === 0 && elapsed > 1200) {
        this.status = `首次加载手势模型中，已等待 ${Math.ceil(elapsed / 1000)} 秒`;
      } else if (this.resultCount > 0 && elapsed > 2500) {
        this.status = "手势识别处理中";
      }
      if (elapsed > 35000) {
        this.ready = false;
        this.busy = false;
        this.loadFailed = true;
        this.status = "手势模型加载超时，请刷新页面或检查网络。";
      }
      return;
    }
    if (now - this.lastSendAt < 45) return;
    this.lastSendAt = now;
    this.sendStartedAt = now;
    this.busy = true;
    if (this.resultCount === 0) {
      this.status = "正在下载并初始化手势模型，首次可能需要 10-20 秒";
    }
    this.hands.send({ image: this.source })
      .catch((error) => {
        console.error(error);
        this.errorCount += 1;
        const message = error && error.message ? error.message : "unknown";
        const moduleError = /Module\.arguments|arguments_|Aborted/i.test(message);
        this.status = moduleError
          ? "手势模型初始化失败，请刷新页面后重试。"
          : `追踪异常${this.errorCount}：${message.slice(0, 18)}`;
        this.lastSendAt = now + 600;
        if (moduleError) {
          this.ready = false;
          this.loadFailed = true;
        } else if (this.errorCount >= 2) {
          this.rebuildModel();
        }
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
    this.errorCount = 0;
    this.loadFailed = false;
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

      const clearlyExtended = tip.y < pip.y - palmSize * 0.08 && tipToPalm > Math.max(pipToPalm * 1.12, mcpToPalm * 1.35);
      const nearPalm = tipToPalm < Math.max(mcpToPalm * 1.05, palmSize * 0.68);
      const belowJoint = tip.y > pip.y + palmSize * 0.09;
      if (clearlyExtended) extended += 1;
      if (nearPalm || belowJoint) folded += 1;
    }

    if (extended >= 3 && folded <= 1) return "open_palm";
    if (folded >= 3 && extended <= 1) return "fist";
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
    this.bossEnemySpawned = 0;
  }

  reset() {
    this.monsters.length = 0;
    this.spawnTimer = 0;
    this.bossSpawnedLevel = 0;
    this.bossEnemySpawned = 0;
  }

  update(dt, width, height, levelConfig, onReachPlayer) {
    const bossRound = isBossLevel(levelConfig.level);
    if (bossRound && this.bossSpawnedLevel !== levelConfig.level) {
      this.spawnBoss(width, height, levelConfig);
      this.bossSpawnedLevel = levelConfig.level;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.monsters.length < levelConfig.maxMonsters) {
      const enemyCount = this.countActiveEnemies();
      const supportType = this.chooseSupportDropType(levelConfig);
      if (!bossRound && enemyCount < levelConfig.bossEnemyLimit) {
        this.spawn(width, height, levelConfig);
      } else if (supportType) {
        this.spawn(width, height, levelConfig, supportType);
      }
      const intervalMultiplier = bossRound ? 1.55 : 1;
      this.spawnTimer = (levelConfig.spawnEvery + Math.random() * levelConfig.spawnJitter) * intervalMultiplier;
    }

    for (const monster of this.monsters) {
      if (monster.dead) continue;
      if (monster.variant === "boss") {
        const hpRatio = monster.hp / monster.maxHp;
        this.updateBossMovement(monster, dt, width, height, levelConfig);
        this.updateBossHealthWaves(monster, width, height, levelConfig, hpRatio);
        this.updateBossMinionQueue(monster, width, height, levelConfig);
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
      if (monster.type === "enemy" && !monster.reached && monster.y + monster.r >= height - GAME.defenseLineOffset) {
        monster.reached = true;
        onReachPlayer(monster);
      }
    }
    this.monsters = this.monsters.filter((monster) => {
      const inside = monster.y < height + monster.r + 60 && monster.x > -monster.r - 80 && monster.x < width + monster.r + 80;
      return !monster.dead && !monster.reached && inside;
    });
  }

  countActiveEnemies() {
    return this.monsters.filter((monster) => monster.type === "enemy" && monster.variant !== "boss" && !monster.dead && !monster.reached).length;
  }

  updateBossMovement(monster, dt, width, height, levelConfig) {
    const now = performance.now();
    const top = Math.max(monster.r + 18, height * 0.08);
    const bottom = Math.max(top + 8, height * 0.5 - monster.r - 8);
    const left = monster.r + 24;
    const right = width - monster.r - 24;
    const needTarget = !monster.moveTarget
      || now >= monster.retargetAt
      || distance(monster, monster.moveTarget) < 26;
    if (needTarget) {
      monster.moveTarget = {
        x: left + Math.random() * Math.max(1, right - left),
        y: top + Math.random() * Math.max(1, bottom - top),
      };
      monster.retargetAt = now + 1400 + Math.random() * 1700;
    }
    const dx = monster.moveTarget.x - monster.x;
    const dy = monster.moveTarget.y - monster.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = (levelConfig.level === 10 ? 82 : 68) * (monster.hp / monster.maxHp < 0.4 ? 1.14 : 1);
    monster.x += (dx / dist) * speed * dt;
    monster.y += (dy / dist) * speed * dt;
    monster.x = clamp(monster.x, left, right);
    monster.y = clamp(monster.y, -monster.r, bottom);
  }

  updateBossHealthWaves(monster, width, height, levelConfig, hpRatio) {
    if (hpRatio < 0.8 && !monster.wave80Spawned) {
      monster.wave80Spawned = true;
      this.enqueueBossMinionWave(monster, levelConfig.bossSummonWave);
    }
    if (hpRatio < 2 / 3 && !monster.wave66Spawned) {
      monster.wave66Spawned = true;
      this.enqueueBossMinionWave(monster, levelConfig.bossSummonWave);
    }
    if (hpRatio < 1 / 3 && !monster.wave33Spawned) {
      monster.wave33Spawned = true;
      this.enqueueBossMinionWave(monster, levelConfig.bossSummonWave);
    }
  }

  enqueueBossMinionWave(boss, count) {
    const now = performance.now();
    boss.minionQueue = (boss.minionQueue || 0) + count;
    boss.nextMinionBurstAt = Math.min(boss.nextMinionBurstAt || now + 300, now + 300);
  }

  updateBossMinionQueue(boss, width, height, levelConfig) {
    const now = performance.now();
    if (!boss.minionQueue || now < (boss.nextMinionBurstAt || 0)) return;
    const totalLeft = Math.max(0, levelConfig.bossEnemyTotalLimit - this.bossEnemySpawned);
    const activeRoom = Math.max(0, levelConfig.bossEnemyLimit - this.countActiveEnemies());
    const canvasRoom = Math.max(0, levelConfig.maxMonsters - this.monsters.length);
    const maxBurst = Math.max(levelConfig.bossMinionBurstMin, levelConfig.bossMinionBurstMax);
    const burstRoll = levelConfig.bossMinionBurstMin + Math.floor(Math.random() * (maxBurst - levelConfig.bossMinionBurstMin + 1));
    const burstSize = Math.min(boss.minionQueue, totalLeft, activeRoom, canvasRoom, burstRoll);
    if (burstSize <= 0) {
      boss.nextMinionBurstAt = now + 900;
      return;
    }
    for (let i = 0; i < burstSize; i += 1) {
      const spawnIndex = boss.minionSpawnIndex || 0;
      this.spawnMinion(width, height, levelConfig, boss, spawnIndex, burstSize);
      boss.minionSpawnIndex = spawnIndex + 1;
    }
    boss.minionQueue -= burstSize;
    boss.nextMinionBurstAt = now + levelConfig.bossMinionBurstInterval * (0.85 + Math.random() * 0.3);
  }

  canSpawnBossEnemy(levelConfig) {
    return !isBossLevel(levelConfig.level) || this.bossEnemySpawned < levelConfig.bossEnemyTotalLimit;
  }

  registerBossEnemySpawn(levelConfig, type) {
    if (isBossLevel(levelConfig.level) && type === "enemy") {
      this.bossEnemySpawned += 1;
    }
  }

  chooseSupportDropType(levelConfig) {
    const roll = Math.random();
    if (roll < levelConfig.weaponChance) return "weapon";
    if (roll < levelConfig.weaponChance + levelConfig.healthChance) return "health";
    return null;
  }

  spawn(width, height, levelConfig, forcedType = null) {
    const roll = Math.random();
    let type = forcedType || (roll < levelConfig.weaponChance ? "weapon" : roll < levelConfig.weaponChance + levelConfig.healthChance ? "health" : "enemy");
    if (type === "enemy" && !this.canSpawnBossEnemy(levelConfig)) {
      type = this.chooseSupportDropType(levelConfig) || "weapon";
    }
    const start = this.getSpawnStart(width, height, levelConfig);
    const target = this.getPlayerSideTarget(width, height);
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
      nextAttackAt: performance.now() + (isBossLevel(levelConfig.level) ? 1100 : 700) + Math.random() * 1300,
    });
    this.registerBossEnemySpawn(levelConfig, type);
  }

  getSpawnStart(width, height, levelConfig) {
    const fromLeftFront = Math.random() < 0.5;
    if (isBossLevel(levelConfig.level)) {
      return {
        x: width * (fromLeftFront ? 0.02 + Math.random() * 0.22 : 0.76 + Math.random() * 0.22),
        y: -70 + Math.random() * height * 0.12,
      };
    }
    return {
      x: width * (fromLeftFront ? 0.08 + Math.random() * 0.3 : 0.62 + Math.random() * 0.3),
      y: -42,
    };
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
    const hp = Math.round(levelConfig.enemyHp * (bossLevel === 2 ? 46 : 34));
    this.monsters.push({
      type: "enemy",
      variant: "boss",
      x: width / 2,
      y: -80,
      vx: 0,
      vy: 0,
      r: bossLevel === 2 ? 78 : 64,
      hp,
      maxHp: hp,
      damageTakenMultiplier: bossLevel === 2 ? 0.58 : 0.68,
      fighterDamageTakenMultiplier: bossLevel === 2 ? 0.5 : 0.56,
      damage: Math.round(levelConfig.enemyDamage * (bossLevel === 2 ? 2.75 : 2.15)),
      score: bossLevel === 2 ? 5200 : 3200,
      phaseTime: 0,
      swaySpeed: bossLevel === 2 ? 1.25 : 1.15,
      swayWidth: bossLevel === 2 ? 48 : 42,
      moveTarget: { x: width / 2, y: height * 0.18 },
      retargetAt: performance.now() + 1600,
      dead: false,
      reached: false,
      color: bossLevel === 2 ? "#ff5b7e" : "#d89cff",
      flashUntil: 0,
      label: bossLevel === 2 ? "母舰 II" : "母舰",
      warningUntil: 0,
      wave80Spawned: false,
      wave66Spawned: false,
      wave33Spawned: false,
      minionQueue: 0,
      minionSpawnIndex: 0,
      nextMinionBurstAt: 0,
      nextAttackAt: performance.now() + 900,
    });
  }

  spawnMinion(width, height, levelConfig, boss, index = 0, total = 1) {
    const spawnAngle = -Math.PI / 2 + (index - (total - 1) / 2) * 0.22 + (Math.random() - 0.5) * 0.2;
    const spread = boss.r * (0.24 + Math.random() * 0.28);
    const start = {
      x: clamp(boss.x + Math.cos(spawnAngle) * spread, 24, width - 24),
      y: clamp(boss.y + Math.sin(spawnAngle) * spread + boss.r * 0.08, -height * 0.12, height * 0.48),
    };
    const target = this.getPlayerSideTarget(width, height);
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
    this.registerBossEnemySpawn(levelConfig, "enemy");
  }

  getPlayerSideTarget(width, height) {
    return {
      x: width * (0.08 + Math.random() * 0.84),
      y: height - GAME.defenseLineOffset,
    };
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
    this.displayScore = 0;
    this.playerMods = this.createPlayerMods();
    this.defenseState = this.createDefenseState();
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
    this.specialCharges = 1;
    this.specialNextReadyAt = 0;
    this.resetSpecialGestureState();
    this.nextSpecialScoreAward = GAME.specialScoreAward;
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
    this.debugOptions = readDebugOptions();
    this.calibrationMode = "newGame";
    this.calibrationPreviousPhase = "idle";
    this.weaponBanner = null;
    this.specialPrompt = null;
    this.frameFps = 0;
    this.intermissionLeft = 0;
    this.intermissionDeadline = 0;
    this.lastFrameAt = performance.now();
    this.particles = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.fighters = [];
    this.weaponType = "normal";
    this.weaponUntil = 0;
    this.specialCharges = 1;
    this.specialNextReadyAt = 0;
    this.specialGestureCount = 0;
    this.specialGestureLastAt = 0;
    this.specialBothFistHeld = false;
    this.specialGestureArmed = false;
    this.specialOpenStartedAt = 0;
    this.specialFistStartedAt = 0;
    this.specialArmedUntil = 0;
    this.specialGestureDeadline = 0;
    this.nextSpecialScoreAward = GAME.specialScoreAward;
    this.lastShootSoundAt = 0;
    this.floatingTexts = [];
    this.scoreEffects = [];
    this.scoreHudPulseTimer = 0;
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
    if (ui.calibrateBtn) {
      ui.calibrateBtn.addEventListener("click", () => this.beginCalibration(this.phase === "playing" ? "resume" : "newGame"));
    }
    ui.pauseBtn.addEventListener("click", () => this.togglePause());
    ui.restartBtn.addEventListener("click", () => this.restart());
    if (ui.recordStartBtn) ui.recordStartBtn.addEventListener("click", () => startGameRecording());
    if (ui.recordStopBtn) ui.recordStopBtn.addEventListener("click", () => stopGameRecording());
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
      fighterCount: 1,
    };
  }

  createDefenseState() {
    return {
      shield: GAME.maxShield,
      maxShield: GAME.maxShield,
      health: GAME.maxHealth,
      maxHealth: GAME.maxHealth,
    };
  }

  get health() {
    return this.defenseState ? this.defenseState.health : GAME.maxHealth;
  }

  set health(value) {
    if (!this.defenseState) return;
    this.defenseState.maxHealth = this.getMaxHealth();
    this.defenseState.health = clamp(Math.round(value), 0, this.defenseState.maxHealth);
  }

  get shield() {
    return this.defenseState ? this.defenseState.shield : GAME.maxShield;
  }

  set shield(value) {
    if (!this.defenseState) return;
    this.defenseState.maxShield = GAME.maxShield;
    this.defenseState.shield = clamp(value, 0, this.defenseState.maxShield);
  }

  getDefenseState() {
    this.defenseState.maxHealth = this.getMaxHealth();
    this.defenseState.maxShield = GAME.maxShield;
    this.defenseState.health = clamp(this.defenseState.health, 0, this.defenseState.maxHealth);
    this.defenseState.shield = clamp(this.defenseState.shield, 0, this.defenseState.maxShield);
    return this.defenseState;
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
      if (ui.calibrateBtn) ui.calibrateBtn.disabled = false;
      ui.pauseBtn.disabled = true;
      ui.restartBtn.disabled = false;
      ui.notice.textContent = "请举起手，等屏幕出现手部光标后才会开始倒计时。";
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
    this.displayScore = 0;
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
    this.specialNextReadyAt = 0;
    this.startLevel(this.debugOptions.enabled ? this.debugOptions.startLevel : 1);
  }

  beginCalibration(mode = "newGame") {
    this.calibrationMode = mode;
    this.calibrationPreviousPhase = mode === "resume" ? this.phase : "idle";
    if (mode === "newGame") {
      this.monsters.reset();
      this.bullets.length = 0;
      this.enemyBullets.length = 0;
      this.fighters.length = 0;
      this.particles.length = 0;
      this.floatingTexts.length = 0;
      this.clearScoreEffects();
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
      title: mode === "resume" ? "重新准备" : "操作范围准备",
      countdown: "等待屏幕出现手部光标",
      button: mode === "resume" ? "完成并继续" : "跳过并开始",
      buttonDisabled: false,
      onButton: () => this.finishCalibration(),
      rank: "",
      stats: [
        ["动作", "移动双手"],
        ["目标", "覆盖常用范围"],
        ["样本", "0"],
      ],
    });
  }

  updateCalibration(now) {
    if (this.tracker.loadFailed) {
      ui.notice.textContent = this.tracker.status;
      ui.summaryCountdown.textContent = "手势识别加载失败，请刷新页面重试";
      ui.startBtn.disabled = false;
      return;
    }
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
      ui.notice.textContent = "已检测到手部光标，请继续移动双手。";
    }
    const left = this.calibrationCountdownStarted ? Math.max(0, Math.ceil((this.calibrationDeadline - now) / 1000)) : GAME.calibrationSeconds;
    ui.summaryCountdown.textContent = this.calibrationCountdownStarted
      ? (this.calibrationMode === "resume" ? `${left} 秒后继续游戏` : `${left} 秒后开始第 1 关`)
      : "等待屏幕出现手部光标";
    if (!this.calibrationCountdownStarted) {
      ui.notice.textContent = this.tracker.status || "等待手势识别启动。";
    }
    if (ui.summaryStats) {
      ui.summaryStats.innerHTML = [
        ["动作", "移动双手"],
        ["目标", "覆盖常用范围"],
        ["样本", this.calibrationDraft.samples],
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
      ui.notice.textContent = "操作范围已更新。";
      return;
    }
    this.resetGame();
  }

  startLevel(level) {
    this.updateDifficulty();
    this.level = level;
    this.timeLeft = isBossLevel(level) ? 0 : this.getRoundSeconds();
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
    this.fighters.length = 0;
    this.floatingTexts.length = 0;
    this.clearScoreEffects();
    this.weaponType = "normal";
    this.weaponUntil = 0;
    this.monsters.reset();
    this.weaponBanner = null;
    this.specialPrompt = null;
    this.phase = "playing";
    this.running = true;
    this.paused = false;
    this.hideLevelOverlay();
    ui.pauseBtn.textContent = "暂停";
    ui.pauseBtn.disabled = false;
    ui.restartBtn.disabled = false;
    const theme = LEVEL_THEMES[this.level - 1] || LEVEL_THEMES[0];
    ui.notice.textContent = isBossLevel(this.level)
      ? `第 ${this.level} 关开始。击毁母舰才能过关。`
      : `第 ${this.level} 关：${theme.name}。击中武器包可临时切换武器。`;
    this.sound.level();
    if (isBossLevel(this.level)) this.sound.boss();
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
        ["连击记录", this.bestCombo],
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
    this.fighters.length = 0;
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
          ["连击记录", this.bestCombo],
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
        ["连击记录", this.bestCombo],
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
    const pool = UPGRADES.filter((upgrade) => !upgrade.canOffer || upgrade.canOffer(this));
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

  addScore(amount, source = null, color = "#f6c84c", label = null) {
    if (!amount) return;
    this.score += amount;
    if (source) this.spawnScoreEffect(source.x, source.y, amount, color, label);
    while (this.score >= this.nextSpecialScoreAward) {
      this.specialCharges += 1;
      this.nextSpecialScoreAward += GAME.specialScoreAward;
      this.spawnFloatingText(this.width / 2, this.height * 0.3, "特殊技能 +1", "#6bf2ff");
      ui.notice.textContent = "分数奖励：特殊技能 +1。";
      this.sound.pickup();
    }
  }

  updateDisplayedScore(dt) {
    if (this.displayScore === undefined) this.displayScore = this.score;
    const diff = this.score - this.displayScore;
    if (Math.abs(diff) < 0.5) {
      this.displayScore = this.score;
      return;
    }
    const minStep = 80 * dt;
    const fastStep = Math.abs(diff) * clamp(dt * 9, 0.08, 0.42);
    const step = Math.min(Math.abs(diff), Math.max(minStep, fastStep));
    this.displayScore += Math.sign(diff) * step;
  }

  clearScoreEffects() {
    for (const item of this.scoreEffects || []) {
      if (item.element) item.element.remove();
    }
    this.scoreEffects.length = 0;
  }

  getScoreHudTarget() {
    if (!ui.score || !canvas) return { x: 112, y: 58 };
    const hudItem = ui.score.closest(".hud-item") || ui.score;
    const hudRect = hudItem.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = this.width / Math.max(1, canvasRect.width);
    const scaleY = this.height / Math.max(1, canvasRect.height);
    return {
      x: (hudRect.left + hudRect.width * 0.5 - canvasRect.left) * scaleX,
      y: (hudRect.top + hudRect.height * 0.5 - canvasRect.top) * scaleY,
    };
  }

  canvasToStagePoint(x, y) {
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      x: canvasRect.left - stageRect.left + (x / Math.max(1, this.width)) * canvasRect.width,
      y: canvasRect.top - stageRect.top + (y / Math.max(1, this.height)) * canvasRect.height,
    };
  }

  spawnScoreEffect(x, y, amount, color = "#f6c84c", label = null) {
    if (this.scoreEffects.length >= GAME.maxScoreEffects) {
      const removed = this.scoreEffects.shift();
      if (removed && removed.element) removed.element.remove();
    }
    const target = this.getScoreHudTarget();
    const distanceToHud = distance({ x, y }, target);
    const element = document.createElement("span");
    element.className = "score-fx";
    element.textContent = label || `+${amount}`;
    element.style.setProperty("--score-fx-color", color);
    if (ui.scoreFxLayer) ui.scoreFxLayer.appendChild(element);
    this.scoreEffects.push({
      x,
      y,
      fromX: x,
      fromY: y,
      targetX: target.x,
      targetY: target.y,
      amount,
      label: label || `+${amount}`,
      color,
      age: 0,
      duration: clamp(0.42 + distanceToHud / 1900, 0.48, 0.92),
      arrived: false,
      phase: Math.random() * Math.PI * 2,
      element,
    });
  }

  updateScoreEffects(dt) {
    for (const item of this.scoreEffects) {
      item.age += dt;
      const t = clamp(item.age / item.duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const arc = Math.sin(t * Math.PI) * 42;
      item.x = item.fromX + (item.targetX - item.fromX) * eased + Math.sin(item.phase + t * Math.PI * 2) * 8 * (1 - t);
      item.y = item.fromY + (item.targetY - item.fromY) * eased - arc;
      if (item.element) {
        const point = this.canvasToStagePoint(item.x, item.y);
        const scale = 1 + Math.sin(t * Math.PI) * 0.16;
        const fade = item.arrived ? clamp(1 - (item.age - item.duration) / 0.2, 0, 1) : 1;
        item.element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%) scale(${scale})`;
        item.element.style.opacity = String(fade);
      }
      if (!item.arrived && t >= 1) {
        item.arrived = true;
        this.triggerScoreHudPulse(item.amount, item.color);
      }
    }
    this.scoreEffects = this.scoreEffects.filter((item) => {
      const alive = item.age < item.duration + 0.2;
      if (!alive && item.element) item.element.remove();
      return alive;
    });
  }

  triggerScoreHudPulse(amount, color) {
    const hudItem = ui.score ? ui.score.closest(".hud-item") : null;
    if (hudItem) {
      hudItem.style.setProperty("--score-hit-color", color || "#f6c84c");
      hudItem.classList.remove("score-hit");
      void hudItem.offsetWidth;
      hudItem.classList.add("score-hit");
      window.clearTimeout(this.scoreHudPulseTimer);
      this.scoreHudPulseTimer = window.setTimeout(() => {
        hudItem.classList.remove("score-hit");
      }, 360);
    }
    const target = this.getScoreHudTarget();
    this.spawnFloatingText(target.x, target.y + 32, `+${amount}`, color || "#f6c84c");
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
      maxLife: 0.8,
      size: 4 + Math.random() * 4,
      color: "#f6c84c",
      kind: "spark",
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

    const bossRound = isBossLevel(this.level);
    if (this.phase === "playing" && !this.paused && this.health > 0 && (this.timeLeft > 0 || bossRound)) {
      if (!bossRound) this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (!bossRound && this.timeLeft === 0) {
        this.completeLevel(now);
        this.render(now);
        this.updateHud();
        requestAnimationFrame((time) => this.loop(time));
        return;
      }
      this.fireFromHands(now);
      this.updateSpecialGesture(now);
      this.updateFighters(dt, now);
      this.updateBullets(dt);
      const levelConfig = this.getCurrentLevelConfig();
      this.monsters.update(dt, this.width, this.height, levelConfig, (monster) => {
        this.damagePlayer(monster.damage || 6, clamp(monster.x, 0, this.width), this.getDefenseLineY(), monster.color || "#f36d6d", monster.variant === "boss");
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
      this.updateScoreEffects(dt);
      this.updateDisplayedScore(dt);
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
    const bossAttackEase = monster.variant === "boss"
      ? levelConfig.level === 5 ? 1.25 : levelConfig.level === 10 ? 1.15 : 1
      : 1;
    const firstBossDamage = monster.variant === "boss" && levelConfig.level === 5 ? 0.82 : 1;
    return {
      cooldown: Math.max(420, base.cooldown * difficulty.cooldown * clamp(1.05 - levelConfig.level * 0.018, 0.78, 1.05) * bossAttackEase),
      damage: Math.max(1, Math.round((base.damage + (levelConfig.level - 1) * 0.32) * difficulty.damage * levelBoost * firstBossDamage)),
      speed: base.speed * difficulty.speed * (1 + levelConfig.level * 0.014),
      radius: base.radius,
      color: base.color,
      spread: base.spread || 0,
      volley: base.volley || 1,
      warningMs: monster.variant === "boss" ? 760 : monster.variant === "tank" ? 720 : 580,
    };
  }

  getEnemyTargetPoint(monster) {
    const defenseY = this.getDefenseLineY();
    const spread = monster.variant === "boss" ? 0.92 : 0.84;
    const margin = (1 - spread) / 2;
    const aimX = Math.random() < 0.55
      ? clamp(monster.x + (Math.random() - 0.5) * this.width * 0.38, this.width * 0.06, this.width * 0.94)
      : this.width * (margin + Math.random() * spread);
    return { x: aimX, y: defenseY };
  }

  getDefenseLineY() {
    return this.height - this.getDefensePanelHeight() + 34;
  }

  getDefensePanelHeight() {
    return clamp(this.height * 0.18, 112, 206);
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
      for (const fighter of this.fighters) {
        if (fighter.dead || bullet.dead) continue;
        const hit = segmentCircleHit(
          { x: bullet.prevX, y: bullet.prevY },
          { x: bullet.x, y: bullet.y },
          fighter,
          fighter.r + bullet.radius,
        );
        if (hit) {
          bullet.dead = true;
          this.damageFighter(fighter, 1, hit.x, hit.y, bullet.color);
        }
      }
      if (bullet.dead) continue;
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

  damageFighter(fighter, damage, x, y, color) {
    fighter.hp -= Math.max(1, damage);
    fighter.flashUntil = performance.now() + 120;
    this.spawnHitParticles(x, y, color || "#6bf2ff");
    if (fighter.hp <= 0) {
      fighter.dead = true;
      this.spawnExplosion(fighter.x, fighter.y, "#6bf2ff", 22);
      this.screenShake = Math.max(this.screenShake, 3);
    }
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

  resetSpecialGestureState() {
    this.specialGestureCount = 0;
    this.specialGestureLastAt = 0;
    this.specialBothFistHeld = false;
    this.specialGestureArmed = false;
    this.specialOpenStartedAt = 0;
    this.specialFistStartedAt = 0;
    this.specialArmedUntil = 0;
    this.specialGestureDeadline = 0;
  }

  updateSpecialGesture(now) {
    const left = this.tracker.handsState.Left;
    const right = this.tracker.handsState.Right;
    const bothOpen = this.isHandOpen(left) && this.isHandOpen(right);
    const bothFist = this.isHandFist(left) && this.isHandFist(right);

    if (this.specialGestureCount > 0 && this.specialGestureDeadline > 0 && now > this.specialGestureDeadline) {
      this.specialGestureCount = 0;
      this.specialGestureDeadline = 0;
      this.specialGestureArmed = false;
      this.specialFistStartedAt = 0;
      this.specialBothFistHeld = false;
      this.spawnFloatingText(this.width / 2, this.height * 0.36, "技能手势超时", "#aeb9c2");
    }

    if (bothOpen) {
      if (!this.specialOpenStartedAt) this.specialOpenStartedAt = now;
      this.specialFistStartedAt = 0;
      this.specialBothFistHeld = false;
      if (now - this.specialOpenStartedAt >= 180) {
        this.specialGestureArmed = true;
        this.specialArmedUntil = now + 2400;
      }
      return;
    }

    this.specialOpenStartedAt = 0;
    if (!this.specialGestureArmed || now > this.specialArmedUntil) {
      this.specialGestureArmed = false;
      this.specialFistStartedAt = 0;
      if (!bothFist) this.specialBothFistHeld = false;
      return;
    }

    if (!bothFist) {
      this.specialFistStartedAt = 0;
      this.specialBothFistHeld = false;
      return;
    }

    if (!this.specialFistStartedAt) this.specialFistStartedAt = now;
    if (now - this.specialFistStartedAt < 180) return;
    if (this.specialBothFistHeld) return;

    this.specialBothFistHeld = true;
    this.specialGestureArmed = false;
    this.specialFistStartedAt = 0;
    this.specialGestureCount += 1;
    this.specialGestureLastAt = now;
    this.specialGestureDeadline = now + 5000;
    if (this.specialGestureCount >= 3) {
      if (this.tryActivateSpecial(now)) {
        this.showSpecialPrompt("友军已出动", 3, "#39ff6a", now);
      }
    } else {
      this.showSpecialPrompt(`友军即将出动 ${this.specialGestureCount}/3`, this.specialGestureCount, "#6bf2ff", now);
    }
  }

  showSpecialPrompt(text, progress, color, now = performance.now()) {
    this.specialPrompt = {
      text,
      progress,
      color,
      start: now,
      until: now + 1050,
    };
  }

  isHandOpen(hand) {
    if (!this.isHandActive(hand)) return false;
    return hand.currentGesture === "open_palm"
      || (hand.pendingGesture === "open_palm" && hand.pendingGestureFrames >= 3);
  }

  isHandFist(hand) {
    if (!this.isHandActive(hand)) return false;
    return hand.currentGesture === "fist"
      || (hand.currentGesture === "attack_triggered" && hand.previousStableGesture === "fist")
      || (hand.pendingGesture === "fist" && hand.pendingGestureFrames >= 3);
  }

  tryActivateSpecial(now) {
    if (this.debugOptions.infiniteSpecial) {
      this.specialNextReadyAt = 0;
      this.resetSpecialGestureState();
      this.spawnFighterSquad(now);
      return true;
    }
    if (this.specialCharges <= 0) {
      ui.notice.textContent = "特殊技能次数不足。";
      this.spawnFloatingText(this.width / 2, this.height * 0.42, "技能次数不足", "#aeb9c2");
      this.resetSpecialGestureState();
      return false;
    }
    if (now < this.specialNextReadyAt) {
      const left = Math.ceil((this.specialNextReadyAt - now) / 1000);
      ui.notice.textContent = `特殊技能冷却中：${left} 秒。`;
      this.spawnFloatingText(this.width / 2, this.height * 0.42, `冷却 ${left}s`, "#aeb9c2");
      this.resetSpecialGestureState();
      return false;
    }
    this.specialCharges -= 1;
    this.specialNextReadyAt = now + GAME.specialCooldownMs;
    this.resetSpecialGestureState();
    this.spawnFighterSquad(now);
    return true;
  }

  spawnFighterSquad(now) {
    const count = clamp(this.playerMods.fighterCount || 1, 1, GAME.maxFighters);
    const centerX = this.width / 2;
    const startY = this.height + 76;
    const spacing = 72;
    this.fighters.length = 0;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spacing;
      this.fighters.push({
        x: centerX + offset,
        y: startY + Math.abs(offset) * 0.18,
        prevX: centerX + offset,
        prevY: startY,
        vx: 0,
        vy: -260,
        r: 28,
        hp: 5,
        maxHp: 5,
        until: now + GAME.specialDurationMs,
        lastShotAt: now - i * 60,
        spriteIndex: i % FRIEND_PLANE_SHEET.rects.length,
        phase: i * 0.9,
        formationOffsetX: offset * 0.9,
        hoverDistance: 96 + i * 18,
        orbitRadius: 36 + i * 10,
        targetBias: i - (count - 1) / 2,
        dead: false,
      });
    }
    ui.notice.textContent = `特殊技能启动：${count} 架友方战斗机出击。`;
    this.spawnFloatingText(centerX, this.height * 0.28, `战斗机队 x${count}`, "#6bf2ff");
    this.sound.special();
  }

  updateFighters(dt, now) {
    const weapon = this.getCurrentWeapon(now);
    for (const fighter of this.fighters) {
      if (fighter.dead) continue;
      if (now >= fighter.until || fighter.hp <= 0) {
        fighter.dead = true;
        this.spawnExplosion(fighter.x, fighter.y, "#6bf2ff", 16);
        continue;
      }
      const target = this.findFighterTarget(fighter);
      fighter.prevX = fighter.x;
      fighter.prevY = fighter.y;
      if (target) {
        const hoverDistance = fighter.hoverDistance + Math.sin(now * 0.0037 + fighter.phase) * 22;
        const orbitX = Math.sin(now * 0.0028 + fighter.phase) * fighter.orbitRadius;
        const orbitY = Math.cos(now * 0.0032 + fighter.phase) * 18;
        const topLimit = this.height * 0.5;
        const desired = {
          x: clamp(target.x + fighter.formationOffsetX + orbitX, 42, this.width - 42),
          y: clamp(target.y + hoverDistance + orbitY, topLimit, this.getDefenseLineY() - 42),
        };
        const dx = desired.x - fighter.x;
        const dy = desired.y - fighter.y;
        fighter.vx += dx * dt * 8.5;
        fighter.vy += dy * dt * 8.5;
        const speed = Math.hypot(fighter.vx, fighter.vy);
        const maxSpeed = 520;
        if (speed > maxSpeed) {
          fighter.vx = (fighter.vx / speed) * maxSpeed;
          fighter.vy = (fighter.vy / speed) * maxSpeed;
        }
        if (now - fighter.lastShotAt >= Math.max(135, weapon.fireEveryMs * 1.05)) {
          this.fireFromFighter(fighter, target, weapon, now);
        }
      } else {
        fighter.vx += (this.width / 2 + fighter.formationOffsetX - fighter.x) * dt * 2.5;
        fighter.vy += (this.height * 0.56 + Math.sin(now * 0.002 + fighter.phase) * 28 - fighter.y) * dt * 2.8;
      }
      fighter.vx *= 0.94;
      fighter.vy *= 0.94;
      fighter.x = clamp(fighter.x + fighter.vx * dt, 32, this.width - 32);
      fighter.y = clamp(fighter.y + fighter.vy * dt, this.height * 0.5, this.getDefenseLineY() - 26);
    }
    this.fighters = this.fighters.filter((fighter) => !fighter.dead);
  }

  findFighterTarget(fighter) {
    let best = null;
    for (const monster of this.monsters.monsters) {
      if (monster.dead || monster.type !== "enemy") continue;
      const dist = distance(fighter, monster);
      const forward = monster.y * 0.42;
      const sidePreference = Math.abs((monster.x - this.width / 2) - fighter.targetBias * this.width * 0.12);
      const score = dist - forward + sidePreference * 0.18 + Math.sin(monster.x * 0.013 + fighter.phase) * 18;
      if (!best || score < best.score) best = { monster, score };
    }
    return best ? best.monster : null;
  }

  fireFromFighter(fighter, target, weapon, now) {
    if (this.bullets.length >= GAME.maxBullets) return;
    const dx = target.x - fighter.x;
    const dy = target.y - fighter.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / length;
    const uy = dy / length;
    const fighterWeapon = {
      ...weapon,
      id: weapon.id,
      fireEveryMs: Math.max(135, weapon.fireEveryMs * 1.05),
      bulletSpeed: Math.max(weapon.bulletSpeed, 760),
      bulletRadius: Math.max(4, weapon.bulletRadius * 0.8),
      color: FRIEND_PLANE_SHEET.rects[fighter.spriteIndex].color || weapon.color,
      pellets: [0],
      sideOffsets: [0],
      splashRadius: 0,
      pierce: weapon.beam ? 1 : 0,
    };
    this.createBullet({ x: fighter.x + ux * 32, y: fighter.y + uy * 32 }, ux, uy, "Fighter", 0, fighterWeapon);
    fighter.lastShotAt = now;
    this.levelShots += 1;
    this.totalShots += 1;
    if (now - this.lastShootSoundAt > 70) {
      this.lastShootSoundAt = now;
      this.sound.shoot(weapon.id);
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
    const panelTop = this.height - this.getDefensePanelHeight();
    const gunY = panelTop + clamp(this.getDefensePanelHeight() * 0.18, 20, 38);
    return { x: this.width / 2 + offset * 1.18, y: gunY };
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

    let damageMultiplier = target.variant === "boss" ? this.playerMods.bossDamageMultiplier : 1;
    if (target.variant === "boss") {
      damageMultiplier *= target.damageTakenMultiplier || 0.58;
      if (bullet.handId === "Fighter") damageMultiplier *= target.fighterDamageTakenMultiplier || 0.46;
    }
    const actualDamage = Math.max(1, Math.round(bullet.damage * damageMultiplier));
    target.hp -= actualDamage;
    target.flashUntil = now + 90;
    this.spawnHitParticles(x, y, bullet.color || target.color);
    this.spawnFloatingText(x, y, `-${actualDamage}`, bullet.color || "#f4f8fb");
    const hitScore = Math.max(1, Math.ceil(actualDamage));
    this.addScore(hitScore, { x, y }, bullet.color || "#f4f8fb", `命中 +${hitScore}`);
    this.screenShake = Math.max(this.screenShake, bullet.weaponId === "flame" ? 4 : 2);

    if (bullet.splashRadius > 0) {
      for (const other of this.monsters.monsters) {
        if (other === target || other.dead || other.type !== "enemy") continue;
        if (distance(other, { x, y }) <= bullet.splashRadius + other.r) {
          const splashDefense = other.variant === "boss" ? (other.damageTakenMultiplier || 0.58) * 0.55 : 1;
          other.hp -= Math.max(1, Math.round(bullet.damage * 0.45 * splashDefense));
          this.spawnHitParticles(other.x, other.y, bullet.color);
        }
      }
    }

    const killed = [target, ...this.monsters.monsters.filter((monster) => monster !== target && monster.type === "enemy" && monster.hp <= 0 && !monster.dead)];
    let defeatedBoss = null;
    for (const monster of killed) {
      if (monster.dead || monster.hp > 0) continue;
      monster.dead = true;
      if (monster.variant === "boss") defeatedBoss = monster;
      const killScore = monster.score || 100;
      this.addScore(killScore, { x: monster.x, y: monster.y }, "#f6c84c", `击毁 +${killScore}`);
      this.levelKills += 1;
      this.totalKills += 1;
      this.combo = now - this.lastKillAt <= GAME.comboWindowMs ? this.combo + 1 : 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.lastKillAt = now;
      if (this.combo >= 3) {
        const comboBonus = this.combo * 12;
        this.addScore(comboBonus, { x: monster.x, y: monster.y - 26 }, "#ffffff", `连击 +${comboBonus}`);
      }
      this.spawnExplosion(monster.x, monster.y, monster.color, monster.variant === "tank" ? 34 : 24);
      this.screenShake = Math.max(this.screenShake, monster.variant === "boss" ? 16 : 5);
      if (monster.variant === "boss") this.sound.boss();
      else this.sound.kill();
    }
    if (defeatedBoss && isBossLevel(this.level)) {
      this.finishBossLevel(defeatedBoss, now);
      return;
    }
    this.sound.hit();
  }

  finishBossLevel(boss, now) {
    for (const monster of this.monsters.monsters) {
      if (monster === boss || monster.dead || monster.type !== "enemy") continue;
      monster.dead = true;
      this.spawnExplosion(monster.x, monster.y, monster.color, monster.variant === "tank" ? 28 : 20);
    }
    this.enemyBullets.length = 0;
    this.screenShake = Math.max(this.screenShake, 18);
    ui.notice.textContent = "母舰已击毁，敌方舰队瓦解。";
    this.completeLevel(now);
  }

  handleEnemyBulletIntercept(target, bullet, x, y) {
    const now = performance.now();
    target.dead = true;
    this.levelHits += 1;
    this.totalHits += 1;
    const reward = target.variant === "boss" || target.variant === "tank" ? 12 : 8;
    this.addScore(reward, { x, y }, "#6bf2ff", `拦截 +${reward}`);
    this.combo = Math.max(1, this.combo);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastKillAt = now;
    this.spawnHitParticles(x, y, target.color || bullet.color || "#f4f8fb");
    this.sound.hit();
  }

  spawnHitParticles(x, y, color) {
    const count = Math.min(14, GAME.maxParticles - this.particles.length);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 220;
      const life = 0.34 + Math.random() * 0.38;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 3 + Math.random() * 5,
        color,
        kind: "spark",
      });
    }
  }

  spawnExplosion(x, y, color, count) {
    const actualCount = Math.min(count, GAME.maxParticles - this.particles.length);
    for (let i = 0; i < actualCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 110 + Math.random() * 280;
      const life = 0.45 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 4 + Math.random() * 8,
        color,
        kind: "ember",
      });
    }
  }

  updateHud() {
    const weapon = this.getCurrentWeapon();
    const remain = this.weaponType === "normal" ? "" : ` ${Math.ceil(Math.max(0, this.weaponUntil - performance.now()) / 1000)}s`;
    setText(ui.levelState, `${this.level}/${GAME.maxLevel}`);
    setText(ui.score, String(Math.round(this.displayScore === undefined ? this.score : this.displayScore)));
    setText(ui.health, `${this.health}/${this.getMaxHealth()}`);
    setText(ui.shieldState, `${Math.ceil(this.shield)}/${GAME.maxShield}`);
    setText(ui.timeLeft, isBossLevel(this.level) && this.phase === "playing" ? "无计时" : String(Math.ceil(this.timeLeft)));
    setText(ui.weaponState, `${weapon.label}${remain}`);
    this.updateSpecialSlot(performance.now());
    setText(ui.comboState, String(this.combo));
  }

  updateSpecialSlot(now) {
    const cooldown = Math.max(0, this.specialNextReadyAt - now);
    const infiniteSpecial = this.debugOptions && this.debugOptions.infiniteSpecial;
    const cooling = !infiniteSpecial && cooldown > 0;
    const active = this.fighters.length > 0;
    if (ui.specialSlot) {
      ui.specialSlot.classList.toggle("is-cooling", cooling);
      ui.specialSlot.classList.toggle("is-active", active || infiniteSpecial);
      ui.specialSlot.classList.toggle("is-empty", !infiniteSpecial && this.specialCharges <= 0);
    }
    setText(ui.specialState, infiniteSpecial ? "∞" : `×${this.specialCharges}`);
    setText(ui.specialCooldownState, cooling ? `${Math.ceil(cooldown / 1000)}s` : "");
  }

  getSpecialHudText(now) {
    const cooldown = Math.max(0, this.specialNextReadyAt - now);
    const active = this.fighters.length > 0 ? ` 战机${this.fighters.length}` : "";
    if (this.debugOptions && this.debugOptions.infiniteSpecial) return `∞${active}`;
    if (this.specialGestureCount > 0 && this.specialGestureDeadline > now) {
      return `${this.specialCharges} 次 技能${this.specialGestureCount}/3 ${Math.ceil((this.specialGestureDeadline - now) / 1000)}s${active}`;
    }
    if (this.specialGestureArmed) {
      return `${this.specialCharges} 次 握拳${this.specialGestureCount}/3${active}`;
    }
    if (cooldown > 0) return `${this.specialCharges} 次 ${Math.ceil(cooldown / 1000)}s${active}`;
    return `${this.specialCharges} 次${active}`;
  }

  render(now) {
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    }
    this.drawBackdrop();
    this.drawDefensePanel();
    this.drawGuns(now);
    this.drawFighters(now);
    this.drawMonsters(now);
    this.drawBullets();
    this.drawEnemyBullets();
    this.drawParticles();
    this.drawScoreEffects();
    this.drawFloatingTexts();
    this.drawWeaponBanner(now);
    this.drawSpecialPrompt(now);
    if (this.phase === "idle") this.drawStartHint();
    if (this.phase === "calibrating") this.drawCalibrationHint();
    this.drawCrosshairs(now);
    this.drawSharedDefenseStatus();
    ctx.restore();
  }

  drawBackdrop() {
    ctx.fillStyle = "rgba(7, 16, 21, 0.56)";
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawDefensePanel() {
    const y = this.getDefenseLineY();
    const panelHeight = this.getDefensePanelHeight();
    const top = this.height - panelHeight;
    const bottom = this.height;
    const corner = 32;
    const centerX = this.width / 2;
    const notchW = clamp(this.width * 0.36, 520, 760);
    const statusW = clamp(this.width * 0.34, 520, 650);
    const sideGlowH = clamp(panelHeight * 0.36, 64, 104);

    ctx.save();
    const panelGradient = ctx.createLinearGradient(0, top, 0, bottom);
    panelGradient.addColorStop(0, "rgba(12, 43, 57, 0.9)");
    panelGradient.addColorStop(0.38, "rgba(8, 26, 39, 0.96)");
    panelGradient.addColorStop(1, "rgba(2, 9, 15, 0.99)");
    ctx.fillStyle = panelGradient;
    ctx.beginPath();
    ctx.moveTo(16, top + corner);
    ctx.lineTo(48, top + 10);
    ctx.lineTo(centerX - notchW / 2, top + 10);
    ctx.lineTo(centerX - notchW / 2 + 52, top - 8);
    ctx.lineTo(centerX + notchW / 2 - 52, top - 8);
    ctx.lineTo(centerX + notchW / 2, top + 10);
    ctx.lineTo(this.width - 48, top + 10);
    ctx.lineTo(this.width - 16, top + corner);
    ctx.lineTo(this.width - 16, bottom - 32);
    ctx.lineTo(this.width - 56, bottom - 10);
    ctx.lineTo(centerX + notchW / 2, bottom - 10);
    ctx.lineTo(centerX + notchW / 2 - 42, bottom - 34);
    ctx.lineTo(centerX - notchW / 2 + 42, bottom - 34);
    ctx.lineTo(centerX - notchW / 2, bottom - 10);
    ctx.lineTo(56, bottom - 10);
    ctx.lineTo(16, bottom - 32);
    ctx.closePath();
    ctx.shadowColor = "rgba(34, 211, 238, 0.45)";
    ctx.shadowBlur = 24;
    ctx.fill();

    const bevel = ctx.createLinearGradient(0, top, 0, top + 50);
    bevel.addColorStop(0, "rgba(113, 239, 255, 0.18)");
    bevel.addColorStop(0.45, "rgba(34, 211, 238, 0.07)");
    bevel.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = bevel;
    ctx.fillRect(24, top + 10, this.width - 48, 50);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(91, 230, 255, 0.78)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(2, 11, 18, 0.86)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.34)";
    ctx.lineWidth = 1;
    for (let x = 48; x < this.width - 48; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, top + 18);
      ctx.lineTo(x, bottom - 20);
      ctx.stroke();
    }
    for (let row = top + 28; row < bottom - 18; row += 34) {
      ctx.beginPath();
      ctx.moveTo(42, row);
      ctx.lineTo(this.width - 42, row);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(2, 8, 13, 0.68)";
    this.drawChamferRect(centerX - statusW * 0.68, top + panelHeight * 0.42, statusW * 1.36, panelHeight * 0.48, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(8, 24, 34, 0.9)";
    this.drawChamferRect(32, top + 20, 122, 34, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.58)";
    ctx.stroke();
    ctx.fillStyle = "#d7f7ff";
    ctx.font = "16px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("防线", 86, top + 43);

    ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, top + 18);
    ctx.lineTo(centerX - statusW * 0.78, top + 18);
    ctx.moveTo(centerX + statusW * 0.78, top + 18);
    ctx.lineTo(this.width - 70, top + 18);
    ctx.stroke();

    const leftBoxW = clamp(this.width * 0.21, 300, 405);
    ctx.fillStyle = "rgba(4, 12, 18, 0.58)";
    this.drawChamferRect(72, top + panelHeight * 0.43, leftBoxW, 70, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = "rgba(8, 20, 28, 0.95)";
    this.drawChamferRect(24, top + 18, 52, 36, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(34, 211, 238, 0.9)";
    ctx.beginPath();
    ctx.moveTo(34, top + 28);
    ctx.lineTo(70, top + 28);
    ctx.lineTo(58, top + 44);
    ctx.lineTo(24, top + 44);
    ctx.fill();

    ctx.fillStyle = "rgba(34, 211, 238, 0.1)";
    ctx.beginPath();
    ctx.arc(106, top + panelHeight * 0.43 + 35, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.68)";
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.font = "22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("i", 106, top + panelHeight * 0.43 + 44);

    ctx.textAlign = "left";
    ctx.fillStyle = "#d7f7ff";
    ctx.font = "14px system-ui";
    const notice = ui.notice ? ui.notice.textContent.trim() : "";
    const firstLine = notice.length > 0 ? notice.slice(0, 20) : "等待摄像头与手势追踪";
    const secondLine = notice.length > 20 ? notice.slice(20, 44) : "双拳三次可呼叫战斗机队";
    ctx.fillText(firstLine, 142, top + panelHeight * 0.43 + 29);
    ctx.fillStyle = "rgba(215, 247, 255, 0.76)";
    ctx.font = "14px system-ui";
    ctx.fillText(secondLine, 142, top + panelHeight * 0.43 + 54);

    const sideGrad = ctx.createLinearGradient(0, top, 0, bottom);
    sideGrad.addColorStop(0, "rgba(34, 211, 238, 0)");
    sideGrad.addColorStop(0.5, "rgba(34, 211, 238, 0.95)");
    sideGrad.addColorStop(1, "rgba(34, 211, 238, 0)");
    ctx.fillStyle = sideGrad;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 18;
    ctx.fillRect(23, top + panelHeight * 0.38, 9, sideGlowH);
    ctx.fillRect(this.width - 32, top + panelHeight * 0.38, 9, sideGlowH);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(34, 211, 238, 0.86)";
    ctx.fillRect(centerX - 56, bottom - 28, 20, 6);
    ctx.fillRect(centerX - 28, bottom - 28, 20, 6);
    ctx.fillRect(centerX, bottom - 28, 20, 6);
    ctx.fillRect(centerX + 28, bottom - 28, 20, 6);

    ctx.strokeStyle = "rgba(34, 211, 238, 0.32)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - notchW * 0.42, top + panelHeight * 0.58);
    ctx.lineTo(centerX - notchW * 0.36, top + panelHeight * 0.48);
    ctx.lineTo(centerX + notchW * 0.36, top + panelHeight * 0.48);
    ctx.lineTo(centerX + notchW * 0.42, top + panelHeight * 0.58);
    ctx.stroke();
    ctx.restore();
  }

  drawChamferRect(x, y, w, h, cut = 12) {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  }

  drawSharedDefenseStatus() {
    const state = this.getDefenseState();
    const panelHeight = this.getDefensePanelHeight();
    const top = this.height - panelHeight;
    const width = clamp(this.width * 0.23, 345, 435);
    const x = this.width / 2 - width / 2;
    const y = top + panelHeight * 0.61;
    ctx.save();
    ctx.shadowColor = "rgba(34, 211, 238, 0.28)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(3, 13, 20, 0.62)";
    this.drawChamferRect(x - 16, y - 12, width + 32, 50, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.24)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
    this.drawDefenseBar({
      icon: "⬟",
      label: "护盾",
      value: state.shield,
      max: state.maxShield,
      x,
      y,
      width,
      compact: true,
      colorA: "#22d3ee",
      colorB: "#00bcd4",
    });
    this.drawDefenseBar({
      icon: "♥",
      label: "生命",
      value: state.health,
      max: state.maxHealth,
      x,
      y: y + 23,
      width,
      compact: true,
      colorA: "#22c55e",
      colorB: "#39ff6a",
    });
    ctx.restore();
  }

  drawDefenseBar({ icon, label, value, max, x, y, width, colorA, colorB, compact = false }) {
    const ratio = clamp(value / Math.max(1, max), 0, 1);
    const iconSize = compact ? 19 : 25;
    const fontSize = compact ? 12 : 15;
    const barX = x + (compact ? 38 : 52);
    const barW = width - (compact ? 42 : 58);
    const barH = compact ? 14 : 20;
    ctx.fillStyle = colorA;
    ctx.font = `${iconSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(icon, x + (compact ? 18 : 24), y + (compact ? 13 : 19));
    ctx.fillStyle = "rgba(2, 8, 12, 0.72)";
    ctx.fillRect(barX, y, barW, barH);
    const gradient = ctx.createLinearGradient(barX, y, barX + barW, y);
    gradient.addColorStop(0, colorB);
    gradient.addColorStop(1, colorA);
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, y, barW * ratio, barH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(215, 247, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, y, barW, barH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(barX + 1, y + 2, Math.max(0, barW * ratio - 2), compact ? 2 : 3);
    ctx.fillStyle = "#d7f7ff";
    ctx.font = `${fontSize}px system-ui`;
    ctx.textAlign = "left";
    ctx.fillText(label, barX + 9, y + (compact ? 11 : 14));
    ctx.textAlign = "right";
    ctx.fillText(`${Math.ceil(value)}/${max}`, barX + barW - 7, y + (compact ? 11 : 14));
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
    const base = playerWeaponSprites.base;
    const gun = playerWeaponSprites.guns[weapon.id] || playerWeaponSprites.guns.normal;
    if (!playerWeaponSheetReady || !base || !base.canvas || !gun || !gun.canvas) return false;
    const turret = {
      x: origin.x,
      y: origin.y,
      angle,
      baseScale: 1,
      gunScale: 1,
      gunPivotX: gun.pivotX,
      gunPivotY: gun.pivotY,
    };
    const baseWidth = base.drawW * turret.baseScale;
    const baseHeight = base.drawH * turret.baseScale;
    const gunWidth = gun.drawW * turret.gunScale;
    const gunHeight = gun.drawH * turret.gunScale;

    ctx.save();
    ctx.globalAlpha = 0.46;
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.filter = "blur(6px)";
    ctx.beginPath();
    ctx.ellipse(turret.x, turret.y + baseHeight * 0.12, baseWidth * 0.42, baseHeight * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(turret.x, turret.y);
    ctx.globalAlpha = active ? 1 : 0.82;
    ctx.shadowColor = active ? "rgba(34, 211, 238, 0.52)" : "rgba(255, 255, 255, 0.15)";
    ctx.shadowBlur = active ? 22 : 8;
    ctx.filter = active ? "brightness(1.18) contrast(1.1)" : "brightness(1.04) contrast(1.02)";
    ctx.drawImage(
      base.canvas,
      -baseWidth / 2,
      -baseHeight / 2,
      baseWidth,
      baseHeight,
    );
    ctx.restore();

    ctx.save();
    ctx.translate(
      turret.x + TURRET_PIVOT_CONFIG.gunOffsetX,
      turret.y + TURRET_PIVOT_CONFIG.gunOffsetY,
    );
    ctx.rotate(turret.angle + Math.PI / 2);
    ctx.globalAlpha = active ? 1 : 0.84;
    ctx.shadowColor = active ? weapon.color : "rgba(255, 255, 255, 0.18)";
    ctx.shadowBlur = active ? 26 : 10;
    ctx.filter = active ? "brightness(1.22) contrast(1.12)" : "brightness(1.06) contrast(1.04)";
    ctx.drawImage(
      gun.canvas,
      -turret.gunPivotX * turret.gunScale,
      -turret.gunPivotY * turret.gunScale,
      gunWidth,
      gunHeight,
    );
    ctx.restore();

    if (DEBUG_TURRET_PIVOT) {
      ctx.save();
      ctx.fillStyle = "red";
      ctx.fillRect(turret.x - 2, turret.y - 2, 4, 4);
      ctx.restore();
    }

    if (firing) {
      this.drawSpriteMuzzleFlash(origin, angle, weapon.color, now, gun.muzzle || 78);
    }
    return true;
  }

  drawSpriteMuzzleFlash(origin, angle, color, now, muzzleDistance = 78) {
    const pulse = 0.74 + Math.sin(now * 0.05) * 0.18;
    const start = muzzleDistance - 12;
    const tip = muzzleDistance + 18;
    const inner = muzzleDistance + 10;
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(255, 246, 190, 0.88)";
    ctx.beginPath();
    ctx.moveTo(start, 0);
    ctx.lineTo(tip, -10 * pulse);
    ctx.lineTo(inner, 0);
    ctx.lineTo(tip, 10 * pulse);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(muzzleDistance, 0, 16 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawFighters(now) {
    for (const fighter of this.fighters) {
      const angle = Math.atan2(fighter.vy || -1, fighter.vx || 0);
      ctx.save();
      ctx.translate(fighter.x, fighter.y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.globalAlpha = clamp((fighter.until - now) / 650, 0.28, 1);
      if (now < (fighter.flashUntil || 0)) {
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 18;
      } else {
        const rect = FRIEND_PLANE_SHEET.rects[fighter.spriteIndex] || FRIEND_PLANE_SHEET.rects[0];
        ctx.shadowColor = rect.color;
        ctx.shadowBlur = 10;
      }
      if (!this.drawFriendPlaneSprite(fighter)) {
        this.drawFallbackFighter(fighter);
      }
      ctx.restore();

      const hpRatio = clamp(fighter.hp / fighter.maxHp, 0, 1);
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
      ctx.fillRect(fighter.x - 22, fighter.y + fighter.r + 6, 44, 4);
      ctx.fillStyle = hpRatio > 0.45 ? "#6bf2ff" : "#ff7979";
      ctx.fillRect(fighter.x - 22, fighter.y + fighter.r + 6, 44 * hpRatio, 4);
      ctx.restore();
    }
  }

  drawFriendPlaneSprite(fighter) {
    const rect = FRIEND_PLANE_SHEET.rects[fighter.spriteIndex] || FRIEND_PLANE_SHEET.rects[0];
    if (!friendPlaneSheetReady || !friendPlaneCanvas || !rect) return false;
    const isFlashing = performance.now() < (fighter.flashUntil || 0);
    const size = 78;
    ctx.drawImage(
      friendPlaneCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    if (isFlashing) this.drawHitHighlight(size, size);
    return true;
  }

  drawFallbackFighter(fighter) {
    const rect = FRIEND_PLANE_SHEET.rects[fighter.spriteIndex] || FRIEND_PLANE_SHEET.rects[0];
    const color = rect.color || "#6bf2ff";
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(24, 20);
    ctx.lineTo(7, 14);
    ctx.lineTo(0, 34);
    ctx.lineTo(-7, 14);
    ctx.lineTo(-24, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.beginPath();
    ctx.ellipse(0, -8, 8, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMonsters(now) {
    for (const monster of this.monsters.monsters) {
      ctx.save();
      ctx.translate(monster.x, monster.y);
      const isFlashing = now < (monster.flashUntil || 0);
      if (monster.type === "weapon") {
        if (!this.drawWeaponPackageSprite(monster, isFlashing) && !this.drawSpriteAsset("weapon", monster.r * 2.5, monster.r * 2.15, isFlashing)) {
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

  drawWeaponPackageSprite(monster, isFlashing) {
    const weaponId = monster.weaponId || "normal";
    const key = WEAPON_MISSILE_SHEET.packages[weaponId] ? weaponId : "normal";
    return this.drawWeaponMissileAsset("packages", key, monster.r * 2.65, monster.r * 2.3, isFlashing);
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
    if (isFlashing) this.drawHitHighlight(width, height);
    ctx.restore();
    return true;
  }

  drawWeaponMissileAsset(group, key, width, height, isFlashing, rotation = 0) {
    const rect = WEAPON_MISSILE_SHEET[group] && WEAPON_MISSILE_SHEET[group][key];
    if (!weaponMissileSheetReady || !weaponMissileCanvas || !rect) return false;
    ctx.save();
    if (rotation) ctx.rotate(rotation);
    if (isFlashing) {
      ctx.globalAlpha = 0.95;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 14;
    }
    ctx.drawImage(
      weaponMissileCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      -width / 2,
      -height / 2,
      width,
      height,
    );
    if (isFlashing) this.drawHitHighlight(width, height);
    ctx.restore();
    return true;
  }

  drawHitHighlight(width, height) {
    const radius = Math.max(width, height) * 0.54;
    const flash = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
    flash.addColorStop(0, "rgba(255, 255, 255, 0.42)");
    flash.addColorStop(0.38, "rgba(255, 244, 178, 0.2)");
    flash.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.48, height * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
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
      ctx.font = "13px system-ui";
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
        const target = monster.desperationTarget || { x: this.width / 2, y: this.getDefenseLineY() };
        ctx.save();
        ctx.rotate(Math.atan2(target.y - monster.y, target.x - monster.x));
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
      ctx.font = "12px system-ui";
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
    ctx.font = "11px system-ui";
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
      const lifeRatio = clamp(particle.life / (particle.maxLife || particle.life || 1), 0, 1);
      ctx.globalAlpha = clamp(lifeRatio * 1.35, 0, 1);
      const color = particle.color || "#f6c84c";
      const size = particle.size || 6;
      const glow = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, size * 1.85);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.92)");
      glow.addColorStop(0.32, color);
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size * 1.85, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = clamp(lifeRatio, 0, 0.9);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.22);
      ctx.beginPath();
      ctx.moveTo(particle.x - particle.vx * 0.025, particle.y - particle.vy * 0.025);
      ctx.lineTo(particle.x + particle.vx * 0.008, particle.y + particle.vy * 0.008);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawFloatingTexts() {
    ctx.textAlign = "center";
    ctx.font = "14px system-ui";
    for (const item of this.floatingTexts) {
      ctx.globalAlpha = clamp(item.life, 0, 1);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.globalAlpha = 1;
  }

  drawScoreEffects() {
    // Score flight effects are rendered in the DOM layer above the HUD.
  }

  drawWeaponBanner(now) {
    if (!this.weaponBanner || now > this.weaponBanner.until) return;
    const alpha = clamp((this.weaponBanner.until - now) / 450, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = "24px system-ui";
    ctx.fillStyle = this.weaponBanner.color;
    ctx.shadowColor = this.weaponBanner.color;
    ctx.shadowBlur = 18;
    ctx.fillText(this.weaponBanner.text, this.width / 2, this.height * 0.24);
    ctx.restore();
  }

  drawSpecialPrompt(now) {
    if (!this.specialPrompt || now > this.specialPrompt.until) return;
    const prompt = this.specialPrompt;
    const life = prompt.until - prompt.start;
    const elapsed = now - prompt.start;
    const fadeIn = clamp(elapsed / 140, 0, 1);
    const fadeOut = clamp((prompt.until - now) / 260, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const width = 360;
    const height = 62;
    const x = this.width / 2 - width / 2;
    const y = this.height * 0.34 - height / 2;
    const pulse = 1 + Math.sin((elapsed / life) * Math.PI) * 0.035;

    ctx.save();
    ctx.translate(this.width / 2, y + height / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-this.width / 2, -(y + height / 2));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(2, 10, 16, 0.58)";
    this.drawChamferRect(x, y, width, height, 12);
    ctx.fill();
    ctx.strokeStyle = prompt.color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = prompt.color;
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#f4fbff";
    ctx.font = "22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(prompt.text, this.width / 2, y + 29);

    const pipY = y + height - 12;
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.arc(this.width / 2 + (i - 2) * 18, pipY, 4, 0, Math.PI * 2);
      ctx.fillStyle = i <= prompt.progress ? prompt.color : "rgba(215, 247, 255, 0.22)";
      ctx.fill();
    }
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
      const angle = Math.atan2(bullet.vy, bullet.vx);
      const spriteWidth = bullet.radius * (bullet.variant === "boss" ? 5.4 : bullet.variant === "tank" ? 5 : 4.2);
      const spriteHeight = bullet.radius * (bullet.variant === "boss" ? 9.6 : bullet.variant === "tank" ? 9.2 : 8.4);
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      if (this.drawWeaponMissileAsset("missiles", bullet.variant || "grunt", spriteWidth, spriteHeight, false, angle - Math.PI / 2)) {
        ctx.restore();
        continue;
      }
      ctx.restore();

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
    ctx.font = "28px system-ui";
    ctx.fillText("点击开始，允许摄像头访问", this.width / 2, this.height / 2 - 18);
    ctx.fillStyle = "#aeb9c2";
    ctx.font = "16px system-ui";
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

const bodyFightGame = new Game();
window.bodyFightGame = bodyFightGame;

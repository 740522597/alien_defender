"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const video = document.getElementById("camera");
const skeletonCanvas = document.getElementById("skeletonView");
const skeletonCtx = skeletonCanvas.getContext("2d");

const ui = {
  time: document.getElementById("time"),
  kills: document.getElementById("kills"),
  combo: document.getElementById("combo"),
  level: document.getElementById("level"),
  cameraState: document.getElementById("cameraState"),
  cameraBar: document.getElementById("cameraBar"),
  cameraBtn: document.getElementById("cameraBtn"),
  startBtn: document.getElementById("startBtn"),
  cameraSelect: document.getElementById("cameraSelect"),
  cameraHelp: document.getElementById("cameraHelp"),
  leftMotion: document.getElementById("leftMotion"),
  rightMotion: document.getElementById("rightMotion"),
  topMotion: document.getElementById("topMotion"),
};

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_MIN_X = 110;
const PLAYER_MAX_X = WIDTH - 110;
const CAMERA_LEFT_EDGE = 1 / 3;
const CAMERA_RIGHT_EDGE = 2 / 3;
const ATTACK_ORIGIN_Y = HEIGHT - 142;
const ATTACK_HALF_ANGLE = 50;
const ATTACK_RANGE = 430;
const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [0, 11], [0, 12],
];
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapCameraXToPlayerX(cameraX) {
  const mapped = (cameraX - CAMERA_LEFT_EDGE) / (CAMERA_RIGHT_EDGE - CAMERA_LEFT_EDGE);
  return PLAYER_MIN_X + clamp(mapped, 0, 1) * (PLAYER_MAX_X - PLAYER_MIN_X);
}

class CameraTracker {
  constructor(source) {
    this.source = source;
    this.ready = false;
    this.motion = 0;
    this.playerX = 0.5;
    this.playerVelocityX = 0;
    this.lastDetectionAt = 0;
    this.hasPosition = false;
    this.pendingMoveDirection = 0;
    this.pendingMoveFrames = 0;
    this.leftSwing = false;
    this.rightSwing = false;
    this.blast = false;
    this.leftScore = 0;
    this.rightScore = 0;
    this.topScore = 0;
    this.swingEnergy = 0;
    this.hands = null;
    this.handsReady = false;
    this.handsBusy = false;
    this.pose = null;
    this.poseReady = false;
    this.poseBusy = false;
    this.handsFreshUntil = 0;
    this.poseFreshUntil = 0;
    this.handAttackUntil = 0;
    this.handBlastUntil = 0;
    this.handLeftScore = 0;
    this.handRightScore = 0;
    this.handDoubleScore = 0;
    this.previousHandPoints = [];
    this.poseLandmarks = [];
    this.handLandmarks = [];
    this.lastHandsFrameAt = 0;
    this.lastPoseFrameAt = 0;
    this.lastHandAttackAt = 0;
    this.lastLeftAt = 0;
    this.lastRightAt = 0;
    this.lastBlastAt = 0;
    this.sample = document.createElement("canvas");
    this.sample.width = 144;
    this.sample.height = 81;
    this.sampleCtx = this.sample.getContext("2d", { willReadFrequently: true });
    this.previous = null;
  }

  async start(deviceId) {
    this.stop();
    const attempts = [];
    if (deviceId) {
      attempts.push({ video: { deviceId: { exact: deviceId } }, audio: false });
    }
    attempts.push({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    attempts.push({ video: true, audio: false });

    let lastError = null;
    let stream = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!stream) throw lastError || new Error("getUserMedia failed");
    this.source.srcObject = stream;
    await this.source.play();
    this.ready = true;
    await this.initHands();
  }

  stop() {
    const stream = this.source.srcObject;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    this.source.srcObject = null;
    this.ready = false;
    this.previous = null;
    this.playerVelocityX = 0;
    this.lastDetectionAt = 0;
    this.hasPosition = false;
    this.pendingMoveDirection = 0;
    this.pendingMoveFrames = 0;
    this.handsReady = false;
    this.handsBusy = false;
    this.handsFreshUntil = 0;
    this.handAttackUntil = 0;
    this.handBlastUntil = 0;
    this.handLeftScore = 0;
    this.handRightScore = 0;
    this.handDoubleScore = 0;
    this.previousHandPoints = [];
    this.lastHandsFrameAt = 0;
    this.lastHandAttackAt = 0;
  }

  async initHands() {
    if (typeof window.Hands !== "function") return false;
    this.hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });
    this.hands.onResults((results) => this.handleHandsResults(results));
    this.handsReady = true;
    return true;
  }

  update(now) {
    this.leftSwing = false;
    this.rightSwing = false;
    this.blast = false;

    if (!this.ready || this.source.readyState < 2) {
      return;
    }

    this.processHands(now);

    const w = this.sample.width;
    const h = this.sample.height;
    this.sampleCtx.save();
    this.sampleCtx.scale(-1, 1);
    this.sampleCtx.drawImage(this.source, -w, 0, w, h);
    this.sampleCtx.restore();

    const frame = this.sampleCtx.getImageData(0, 0, w, h);
    const current = new Uint8ClampedArray(w * h);

    let swingTotal = 0;
    let bodyTotal = 0;
    let bodyWeightedX = 0;
    let left = 0;
    let right = 0;
    let centerUpper = 0;
    let blastLeft = 0;
    let blastRight = 0;

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const p = y * w + x;
        const gray = (frame.data[i] * 0.299 + frame.data[i + 1] * 0.587 + frame.data[i + 2] * 0.114) | 0;
        current[p] = gray;

        if (!this.previous) continue;

        const frameDiff = Math.abs(gray - this.previous[p]);
        if (frameDiff < 8) continue;

        if (y > h * 0.42) {
          bodyTotal += frameDiff;
          bodyWeightedX += frameDiff * x;
        }

        if (y > h * 0.24 && y < h * 0.74) {
          swingTotal += frameDiff;
          if (x < w * 0.32) left += frameDiff;
          else if (x > w * 0.68) right += frameDiff;
          else centerUpper += frameDiff;
          if (x < w * 0.30) blastLeft += frameDiff;
          if (x > w * 0.70) blastRight += frameDiff;
        }
      }
    }

    this.previous = current;
    const normalized = Math.min(1, swingTotal / 42000);
    this.motion = normalized;
    if (bodyTotal > 420) {
      const detectedX = bodyWeightedX / bodyTotal / w;
      const delta = detectedX - this.playerX;
      const dt = this.lastDetectionAt ? Math.max(0.001, (now - this.lastDetectionAt) / 1000) : 0.016;
      const direction = Math.sign(delta);
      if (direction !== 0 && direction === this.pendingMoveDirection) {
        this.pendingMoveFrames += 1;
      } else {
        this.pendingMoveDirection = direction;
        this.pendingMoveFrames = 1;
      }
      if ((Math.abs(delta) > 0.018 && this.pendingMoveFrames >= 2) || Math.abs(this.playerVelocityX) > 0.1) {
        const measuredVelocity = delta / dt;
        this.playerVelocityX = this.playerVelocityX * 0.68 + measuredVelocity * 0.32;
        const predictedX = clamp(detectedX + this.playerVelocityX * 0.01, 0, 1);
        this.playerX += (predictedX - this.playerX) * 0.52;
        this.lastDetectionAt = now;
        this.hasPosition = true;
      } else {
        this.playerVelocityX *= 0.5;
      }
    } else {
      this.playerVelocityX *= 0.72;
      this.pendingMoveFrames = 0;
    }

    const leftScore = left / 5200;
    const rightScore = right / 5200;
    const centerScore = centerUpper / 9000;
    const lowerScore = bodyTotal / 12000;
    const blastLeftScore = blastLeft / 5200;
    const blastRightScore = blastRight / 5200;
    const doubleScore = Math.min(blastLeftScore, blastRightScore);
    const rawSwing = Math.max(leftScore, rightScore);
    this.swingEnergy = this.swingEnergy * 0.62 + rawSwing * 0.38;
    if (now < this.handsFreshUntil) {
      this.leftScore = Math.max(this.handLeftScore, this.leftScore * 0.7);
      this.rightScore = Math.max(this.handRightScore, this.rightScore * 0.7);
      this.topScore = Math.max(this.handDoubleScore, this.topScore * 0.7);
      this.leftSwing = now < this.handAttackUntil;
      this.rightSwing = false;
      this.blast = now < this.handBlastUntil;
    } else {
      this.leftScore = Math.max(Math.min(1, leftScore), this.leftScore * 0.68);
      this.rightScore = Math.max(Math.min(1, rightScore), this.rightScore * 0.68);
      this.topScore = Math.max(Math.min(1, doubleScore), this.topScore * 0.68);
      if (leftScore > 0.38 && leftScore > centerScore * 1.55 && leftScore > lowerScore * 0.8 && normalized > 0.08 && now - this.lastLeftAt > 340) {
        this.leftSwing = true;
        this.lastLeftAt = now;
      }
      if (rightScore > 0.38 && rightScore > centerScore * 1.55 && rightScore > lowerScore * 0.8 && normalized > 0.08 && now - this.lastRightAt > 340) {
        this.rightSwing = true;
        this.lastRightAt = now;
      }
      if (blastLeftScore > 0.5 && blastRightScore > 0.5 && doubleScore > centerScore * 1.25 && normalized > 0.18 && now - this.lastBlastAt > 1800) {
        this.blast = true;
        this.lastBlastAt = now;
      }
    }
  }

  processHands(now) {
    if (!this.handsReady || this.handsBusy || now - this.lastHandsFrameAt < 58) return;
    this.handsBusy = true;
    this.lastHandsFrameAt = now;
    this.hands.send({ image: this.source })
      .catch((error) => {
        console.error(error);
        this.handsReady = false;
      })
      .finally(() => {
        this.handsBusy = false;
      });
  }

  handleHandsResults(results) {
    const now = performance.now();
    const landmarks = results.multiHandLandmarks || [];
    const points = landmarks.map((hand) => {
      const wrist = hand[0];
      const middleBase = hand[9];
      return {
        x: 1 - wrist.x,
        y: wrist.y,
        palmX: 1 - middleBase.x,
        palmY: middleBase.y,
        speed: 0,
      };
    });

    const used = new Set();
    for (const point of points) {
      let bestIndex = -1;
      let bestDistance = Infinity;
      this.previousHandPoints.forEach((oldPoint, index) => {
        if (used.has(index)) return;
        const distance = Math.hypot(point.x - oldPoint.x, point.y - oldPoint.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      if (bestIndex >= 0) {
        used.add(bestIndex);
        const oldPoint = this.previousHandPoints[bestIndex];
        const dt = Math.max(0.001, (now - oldPoint.t) / 1000);
        point.speed = Math.hypot(point.x - oldPoint.x, point.y - oldPoint.y) / dt;
      }
      point.t = now;
    }

    this.previousHandPoints = points;
    if (points.length === 0) return;

    this.handsFreshUntil = now + 360;
    this.handLeftScore = 0;
    this.handRightScore = 0;
    for (const point of points) {
      const score = clamp((point.speed - 0.35) / 1.55, 0, 1);
      if (point.x < 0.5) this.handLeftScore = Math.max(this.handLeftScore, score);
      else this.handRightScore = Math.max(this.handRightScore, score);
    }

    const fastest = points.reduce((max, point) => Math.max(max, point.speed), 0);
    if (fastest > 0.82 && now - this.lastHandAttackAt > 280) {
      this.handAttackUntil = now + 160;
      this.lastHandAttackAt = now;
    }

    this.handDoubleScore = 0;
    if (points.length >= 2) {
      const sorted = [...points].sort((a, b) => b.speed - a.speed);
      const first = sorted[0];
      const second = sorted[1];
      const separated = Math.abs(first.x - second.x) > 0.18;
      const bothFast = first.speed > 0.58 && second.speed > 0.58;
      this.handDoubleScore = clamp((Math.min(first.speed, second.speed) - 0.35) / 1.1, 0, 1);
      if (bothFast && separated && now - this.lastBlastAt > 1600) {
        this.handBlastUntil = now + 180;
        this.lastBlastAt = now;
      }
    }
  }
}

class Game {
  constructor() {
    this.tracker = new CameraTracker(video);
    this.keys = new Set();
    this.state = "ready";
    this.monsters = [];
    this.particles = [];
    this.playerX = WIDTH / 2;
    this.timeLeft = 60;
    this.kills = 0;
    this.combo = 0;
    this.level = 1;
    this.spawnTimer = 0;
    this.lastTime = performance.now();
    this.attackFlash = { forward: 0, blast: 0 };
    this.bind();
  }

  bind() {
    ui.cameraBtn.addEventListener("click", async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("当前浏览器不支持摄像头 API，请换 Chrome、Edge 或 Safari 新版本。");
        }
        if (!window.isSecureContext) {
          throw new Error("当前页面不是安全上下文。请使用 http://127.0.0.1:8899/ 或 https 页面打开。");
        }
        ui.cameraState.textContent = "正在打开摄像头";
        ui.cameraHelp.textContent = "如果浏览器弹出权限请求，请选择允许。";
        await this.tracker.start(ui.cameraSelect.value);
        await this.refreshCameras();
        ui.cameraState.textContent = "摄像头已开启";
        ui.cameraHelp.textContent = this.tracker.handsReady
          ? "MediaPipe Hands 已启用，手腕速度用于攻击判定。"
          : "MediaPipe Hands 未加载，暂用画面变化识别。请确认浏览器能访问 jsdelivr。";
      } catch (error) {
        ui.cameraState.textContent = "摄像头打开失败";
        ui.cameraHelp.textContent = this.describeCameraError(error);
        console.error(error);
      }
    });

    ui.startBtn.addEventListener("click", () => this.start());
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "Enter") this.start();
      if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
  }

  async refreshCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const current = ui.cameraSelect.value;
    ui.cameraSelect.innerHTML = `<option value="">默认摄像头</option>`;
    cameras.forEach((camera, index) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.textContent = camera.label || `摄像头 ${index + 1}`;
      ui.cameraSelect.appendChild(option);
    });
    if ([...ui.cameraSelect.options].some((option) => option.value === current)) {
      ui.cameraSelect.value = current;
    }
  }

  describeCameraError(error) {
    const name = error && error.name ? error.name : "";
    const message = error && error.message ? error.message : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "浏览器或 macOS 拒绝了摄像头权限。请在浏览器地址栏允许摄像头，并检查 macOS 系统设置 -> 隐私与安全性 -> 摄像头。";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "没有找到摄像头。请确认 USB 摄像头已连接，或先打开 FaceTime/Photo Booth 测试系统能否看到摄像头。";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "摄像头可能被其他软件占用。请关闭 Zoom、微信、FaceTime、浏览器其它标签页后重试。";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "摄像头不支持请求的分辨率，页面已尝试使用最低约束。请在下拉框选择其它摄像头后重试。";
    }
    if (name === "SecurityError") {
      return "浏览器安全限制阻止了摄像头。请用 http://127.0.0.1:8899/ 打开，不要直接双击 HTML 文件。";
    }
    return message || "摄像头打开失败。请检查浏览器权限、系统权限和设备连接。";
  }

  start() {
    this.state = "playing";
    this.monsters = [];
    this.particles = [];
    this.playerX = WIDTH / 2;
    this.timeLeft = 60;
    this.kills = 0;
    this.combo = 0;
    this.level = 1;
    this.spawnTimer = 0;
    this.updateHud();
  }

  update(dt, now) {
    this.tracker.update(now);
    ui.cameraBar.style.width = `${Math.round(this.tracker.motion * 100)}%`;
    ui.leftMotion.style.width = `${Math.round(this.tracker.leftScore * 100)}%`;
    ui.rightMotion.style.width = `${Math.round(this.tracker.rightScore * 100)}%`;
    ui.topMotion.style.width = `${Math.round(this.tracker.topScore * 100)}%`;

    if (this.state !== "playing") return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.state = "ended";
    }

    this.updatePlayer(dt);
    this.handleAttacks(now);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnMonster();
      const pace = Math.max(0.45, 1.08 - this.level * 0.045);
      this.spawnTimer = pace + Math.random() * 0.35;
    }

    for (const monster of this.monsters) {
      monster.y += monster.speed * dt;
      monster.wobble += dt * monster.speed * 0.03;
      if (monster.y > HEIGHT - 108 && !monster.hitPlayer) {
        monster.hitPlayer = true;
        this.combo = 0;
        this.shatter(monster.x, monster.y, "#e84f4f", 8);
      }
    }

    this.monsters = this.monsters.filter((monster) => monster.y < HEIGHT + 70 && monster.hp > 0);
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.level = 1 + Math.floor(this.kills / 12);
    this.updateHud();
  }

  updatePlayer(dt) {
    if (this.tracker.ready && this.tracker.hasPosition) {
      const target = mapCameraXToPlayerX(this.tracker.playerX);
      this.playerX += (target - this.playerX) * Math.min(1, dt * 14);
    }

    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) this.playerX -= 520 * dt;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) this.playerX += 520 * dt;
    this.playerX = clamp(this.playerX, PLAYER_MIN_X, PLAYER_MAX_X);
  }

  handleAttacks(now) {
    const left = this.tracker.leftSwing || this.keys.has("KeyJ");
    const right = this.tracker.rightSwing || this.keys.has("KeyL");
    const attack = left || right;
    const blast = this.tracker.blast || this.keys.has("Space");

    if (attack) {
      this.attackCone();
      this.attackFlash.forward = 0.18;
    }
    if (blast && now - (this.lastKeyboardBlast || 0) > 1100) {
      this.lastKeyboardBlast = now;
      this.attackAll();
      this.attackFlash.blast = 0.25;
    }
  }

  attackCone() {
    let hits = 0;
    for (const monster of this.monsters) {
      if (monster.hp <= 0 || !this.isInAttackCone(monster)) continue;
      this.damageMonster(monster);
      hits += 1;
    }
    if (hits === 0) this.combo = Math.max(0, this.combo - 1);
  }

  attackAll() {
    for (const monster of this.monsters) {
      if (monster.hp > 0) this.damageMonster(monster);
    }
  }

  isInAttackCone(monster) {
    const dx = monster.x - this.playerX;
    const dy = ATTACK_ORIGIN_Y - monster.y;
    if (dy <= 0) return false;
    const distance = Math.hypot(dx, dy);
    if (distance > ATTACK_RANGE + monster.r) return false;
    const angle = Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
    return angle <= ATTACK_HALF_ANGLE;
  }

  damageMonster(monster) {
    monster.hp -= 1 + Math.floor(this.level / 3);
    if (monster.hp <= 0) {
      this.kills += 1;
      this.combo += 1;
      this.shatter(monster.x, monster.y, monster.color, 12);
    }
  }

  spawnMonster() {
    const toughness = Math.random() < Math.min(0.45, this.level * 0.055) ? 2 : 1;
    const x = 80 + Math.random() * (WIDTH - 160);
    this.monsters.push({
      x,
      y: -50,
      r: toughness === 2 ? 32 : 25,
      hp: toughness,
      speed: 86 + this.level * 9 + Math.random() * 28,
      color: toughness === 2 ? "#b55cff" : ["#6bd176", "#54c7d8", "#f0c65d"][Math.floor(Math.random() * 3)],
      wobble: Math.random() * 9,
      hitPlayer: false,
    });
  }

  shatter(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 0.28 + Math.random() * 0.38,
      });
    }
  }

  updateHud() {
    ui.time.textContent = Math.ceil(this.timeLeft).toString();
    ui.kills.textContent = this.kills.toString();
    ui.combo.textContent = this.combo.toString();
    ui.level.textContent = this.level.toString();
  }

  draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.drawArena();
    this.drawAttacks();
    this.drawPlayer();
    this.drawMonsters();
    this.drawParticles();
    if (this.state !== "playing") this.drawOverlay();
  }

  drawArena() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#1b2429");
    gradient.addColorStop(0.55, "#10161b");
    gradient.addColorStop(1, "#090b0e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 7; i++) {
      const x = PLAYER_MIN_X + i * ((PLAYER_MAX_X - PLAYER_MIN_X) / 6);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = i === 0 || i === 6 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(84, 199, 216, 0.08)";
    ctx.fillRect(this.playerX - 72, 0, 144, HEIGHT);

    ctx.fillStyle = "rgba(232, 79, 79, 0.13)";
    ctx.fillRect(0, HEIGHT - 112, WIDTH, 112);
    ctx.strokeStyle = "rgba(232, 79, 79, 0.48)";
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT - 112);
    ctx.lineTo(WIDTH, HEIGHT - 112);
    ctx.stroke();
  }

  drawPlayer() {
    const y = HEIGHT - 82;
    ctx.save();
    ctx.translate(this.playerX, y);
    ctx.fillStyle = "#111820";
    ctx.strokeStyle = "#54c7d8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(84, 199, 216, 0.55)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-48, -8);
    ctx.lineTo(-86, -34);
    ctx.moveTo(48, -8);
    ctx.lineTo(86, -34);
    ctx.stroke();
    ctx.restore();
  }

  drawMonsters() {
    for (const monster of this.monsters) {
      const x = monster.x + Math.sin(monster.wobble) * 9;
      ctx.save();
      ctx.translate(x, monster.y);
      ctx.fillStyle = monster.color;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -monster.r);
      ctx.lineTo(monster.r * 0.92, -monster.r * 0.18);
      ctx.lineTo(monster.r * 0.55, monster.r);
      ctx.lineTo(-monster.r * 0.55, monster.r);
      ctx.lineTo(-monster.r * 0.92, -monster.r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#090b0e";
      ctx.beginPath();
      ctx.arc(-8, -4, 4, 0, Math.PI * 2);
      ctx.arc(8, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawAttacks() {
    for (const key of Object.keys(this.attackFlash)) {
      if (this.attackFlash[key] > 0) this.attackFlash[key] -= 1 / 60;
    }

    if (this.attackFlash.forward > 0) this.drawAttackCone();
    if (this.attackFlash.blast > 0) {
      ctx.strokeStyle = "rgba(240, 198, 93, 0.78)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(this.playerX, HEIGHT - 100, 220 + Math.sin(performance.now() / 60) * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawAttackCone() {
    const left = (-90 - ATTACK_HALF_ANGLE) * Math.PI / 180;
    const right = (-90 + ATTACK_HALF_ANGLE) * Math.PI / 180;
    ctx.save();
    ctx.translate(this.playerX, ATTACK_ORIGIN_Y);
    ctx.fillStyle = "rgba(84, 199, 216, 0.18)";
    ctx.strokeStyle = "rgba(84, 199, 216, 0.72)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ATTACK_RANGE, left, right);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawParticles() {
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life * 2.4);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 3, particle.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
  }

  drawOverlay() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3f6f8";
    ctx.font = "900 64px system-ui";
    ctx.fillText(this.state === "ended" ? "战斗结束" : "站到摄像头前", WIDTH / 2, HEIGHT / 2 - 60);
    ctx.fillStyle = "#f0c65d";
    ctx.font = "700 28px system-ui";
    const line = this.state === "ended" ? `击杀 ${this.kills}  最高连击 ${this.combo}` : "开启摄像头后点击开始";
    ctx.fillText(line, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = "#9aa6ad";
    ctx.font = "500 22px system-ui";
    ctx.fillText("键盘备用：A/D 移动，J/L 攻击，Space 全屏攻击，Enter 开始", WIDTH / 2, HEIGHT / 2 + 54);
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.update(dt, now);
    this.draw();
    requestAnimationFrame((time) => this.frame(time));
  }
}

const game = new Game();
requestAnimationFrame((time) => game.frame(time));

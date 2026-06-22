const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const messageEl = document.querySelector("#message");
const bannerEl = document.querySelector("#roundBanner");
const p1ScoreEl = document.querySelector("#p1Score");
const p2ScoreEl = document.querySelector("#p2Score");
const resetButton = document.querySelector("#resetButton");

const keys = new Set();
const pointerTargets = new Map();
const score = { p1: 0, p2: 0 };
const table = { x: 480, y: 320, r: 230 };
const scareDistance = 112;
const catchDistance = 31;
const safeSpeed = 95;
const panicSpeed = 135;
let lastTime = performance.now();
let nextRoundAt = 0;

const hands = [
  makeHand("p1", "P1", 245, 320, "#64c7ff"),
  makeHand("p2", "P2", 715, 320, "#ff9c73"),
];

let animals = [];
let particles = [];

function makeHand(id, label, x, y, color) {
  return {
    id,
    label,
    x,
    y,
    vx: 0,
    vy: 0,
    speed: 0,
    color,
    caughtFlash: 0,
    trail: [],
  };
}

function makeAnimal(i, x, y) {
  const types = ["bunny", "cat", "duck"];
  return {
    id: i,
    type: types[i % types.length],
    x,
    y,
    vx: 0,
    vy: 0,
    r: 18,
    panic: 0,
    caught: false,
    wobble: Math.random() * Math.PI * 2,
  };
}

function resetRound(text = "New round. Sneak in slowly.") {
  hands[0].x = 245;
  hands[0].y = 320;
  hands[1].x = 715;
  hands[1].y = 320;
  for (const hand of hands) {
    hand.vx = 0;
    hand.vy = 0;
    hand.speed = 0;
    hand.trail = [];
  }
  animals = [
    makeAnimal(0, 456, 305),
    makeAnimal(1, 507, 329),
    makeAnimal(2, 482, 367),
  ];
  particles = [];
  showMessage(text);
}

function showMessage(text, urgent = false) {
  messageEl.textContent = text;
  bannerEl.textContent = text;
  bannerEl.classList.add("show");
  bannerEl.style.color = urgent ? "#ff8c92" : "#ffd166";
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => bannerEl.classList.remove("show"), 1250);
}

function update(dt, now) {
  if (nextRoundAt && now > nextRoundAt) {
    nextRoundAt = 0;
    resetRound();
  }

  updateHands(dt);
  updateAnimals(dt);
  updateParticles(dt);
}

function updateHands(dt) {
  const input = {
    p1: vectorFromKeys("w", "s", "a", "d"),
    p2: vectorFromKeys("ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"),
  };

  for (const hand of hands) {
    const pointer = pointerTargets.get(hand.id);
    if (pointer) {
      const dx = pointer.x - hand.x;
      const dy = pointer.y - hand.y;
      const len = Math.hypot(dx, dy) || 1;
      input[hand.id].x += dx / len;
      input[hand.id].y += dy / len;
      if (len < 22) pointerTargets.delete(hand.id);
    }

    normalize(input[hand.id]);
    const maxSpeed = keys.has("Shift") ? 205 : 122;
    const targetVx = input[hand.id].x * maxSpeed;
    const targetVy = input[hand.id].y * maxSpeed;
    hand.vx += (targetVx - hand.vx) * Math.min(1, dt * 9);
    hand.vy += (targetVy - hand.vy) * Math.min(1, dt * 9);
    hand.x += hand.vx * dt;
    hand.y += hand.vy * dt;
    hand.speed = Math.hypot(hand.vx, hand.vy);
    keepInStage(hand);
    keepNearTable(hand);
    hand.trail.unshift({ x: hand.x, y: hand.y, speed: hand.speed });
    hand.trail = hand.trail.slice(0, 12);
    hand.caughtFlash = Math.max(0, hand.caughtFlash - dt);
  }
}

function vectorFromKeys(up, down, left, right) {
  return {
    x: (keys.has(right) ? 1 : 0) - (keys.has(left) ? 1 : 0),
    y: (keys.has(down) ? 1 : 0) - (keys.has(up) ? 1 : 0),
  };
}

function updateAnimals(dt) {
  for (const animal of animals) {
    if (animal.caught) continue;
    animal.wobble += dt * 3;
    let threat = null;

    for (const hand of hands) {
      const dx = animal.x - hand.x;
      const dy = animal.y - hand.y;
      const dist = Math.hypot(dx, dy);
      if (dist < catchDistance && hand.speed < safeSpeed) {
        catchAnimal(animal, hand);
        continue;
      }
      if (dist < scareDistance && hand.speed > panicSpeed) {
        threat = { hand, dx, dy, dist };
      }
    }

    if (threat) {
      const awayX = threat.dx / Math.max(1, threat.dist);
      const awayY = threat.dy / Math.max(1, threat.dist);
      animal.vx += awayX * 420 * dt;
      animal.vy += awayY * 420 * dt;
      animal.panic = 1;
      spawnParticles(animal.x, animal.y, "#ff5f6d", 3);
      showMessage(`${threat.hand.label} moved too fast. Animals scattered!`, true);
    } else {
      animal.vx += Math.cos(animal.wobble) * 7 * dt;
      animal.vy += Math.sin(animal.wobble * 0.8) * 7 * dt;
      animal.panic = Math.max(0, animal.panic - dt * 0.95);
    }

    animal.x += animal.vx * dt;
    animal.y += animal.vy * dt;
    animal.vx *= Math.pow(0.78, dt * 5);
    animal.vy *= Math.pow(0.78, dt * 5);
    keepAnimalOnTable(animal);
  }
}

function catchAnimal(animal, hand) {
  if (animal.caught) return;
  animal.caught = true;
  score[hand.id] += 1;
  hand.caughtFlash = 0.65;
  p1ScoreEl.textContent = score.p1;
  p2ScoreEl.textContent = score.p2;
  spawnParticles(animal.x, animal.y, hand.color, 18);
  showMessage(`${hand.label} caught the ${animal.type}. Point scored!`);

  const remaining = animals.filter((item) => !item.caught).length;
  if (remaining === 0) {
    const leader =
      score.p1 === score.p2 ? "Round tied" : score.p1 > score.p2 ? "P1 leads" : "P2 leads";
    showMessage(`${leader}. Resetting table...`);
    nextRoundAt = performance.now() + 1500;
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 140;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 0.35 + Math.random() * 0.45,
    });
  }
}

function keepInStage(item) {
  item.x = clamp(item.x, 38, canvas.width - 38);
  item.y = clamp(item.y, 42, canvas.height - 38);
}

function keepNearTable(hand) {
  const dx = hand.x - table.x;
  const dy = hand.y - table.y;
  const dist = Math.hypot(dx, dy);
  const max = table.r + 74;
  if (dist > max) {
    hand.x = table.x + (dx / dist) * max;
    hand.y = table.y + (dy / dist) * max;
    hand.vx *= 0.45;
    hand.vy *= 0.45;
  }
}

function keepAnimalOnTable(animal) {
  const dx = animal.x - table.x;
  const dy = animal.y - table.y;
  const dist = Math.hypot(dx, dy);
  const max = table.r - 26;
  if (dist > max) {
    animal.x = table.x + (dx / dist) * max;
    animal.y = table.y + (dy / dist) * max;
    animal.vx *= -0.25;
    animal.vy *= -0.25;
    animal.panic = Math.max(animal.panic, 0.45);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFloor();
  drawTable();
  drawAnimals();
  drawHands();
  drawParticles();
}

function drawFloor() {
  const gradient = ctx.createRadialGradient(480, 320, 80, 480, 320, 530);
  gradient.addColorStop(0, "#252b32");
  gradient.addColorStop(1, "#171a1f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTable() {
  ctx.save();
  ctx.translate(table.x, table.y);
  ctx.fillStyle = "#8c5a35";
  ctx.strokeStyle = "#c08a53";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(0, 0, table.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 238, 210, 0.18)";
  ctx.lineWidth = 2;
  for (let r = 72; r <= table.r - 32; r += 48) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHands() {
  for (const hand of hands) {
    hand.trail.forEach((point, index) => {
      ctx.fillStyle = hexToRgba(hand.color, Math.max(0, 0.23 - index * 0.016));
      ctx.beginPath();
      ctx.arc(point.x, point.y, 31 - index * 1.1, 0, Math.PI * 2);
      ctx.fill();
    });

    const fast = hand.speed > panicSpeed;
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(Math.atan2(hand.vy || (hand.id === "p1" ? 0 : 0.01), hand.vx || (hand.id === "p1" ? 1 : -1)));
    ctx.fillStyle = hand.caughtFlash ? "#f8f1c7" : hand.color;
    ctx.strokeStyle = fast ? "#ff5f6d" : "#101217";
    ctx.lineWidth = fast ? 5 : 3;
    roundRect(ctx, -33, -19, 66, 38, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    for (let i = 0; i < 4; i += 1) {
      roundRect(ctx, 11, -17 + i * 9, 25, 6, 4);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "#101217";
    ctx.font = "700 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(hand.label, hand.x, hand.y + 5);

    if (fast) {
      ctx.strokeStyle = "rgba(255, 95, 109, 0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, scareDistance, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawAnimals() {
  for (const animal of animals) {
    if (animal.caught) continue;
    const pulse = 1 + animal.panic * 0.22 * Math.sin(performance.now() / 70);
    ctx.save();
    ctx.translate(animal.x, animal.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = animal.panic > 0.05 ? "#ff5f6d" : "#f5e7bf";
    ctx.strokeStyle = animal.panic > 0.05 ? "#ffd166" : "#2b2520";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (animal.type === "bunny") {
      ctx.fillStyle = "#f5e7bf";
      ctx.beginPath();
      ctx.ellipse(-8, -20, 5, 17, -0.25, 0, Math.PI * 2);
      ctx.ellipse(8, -20, 5, 17, 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (animal.type === "cat") {
      ctx.fillStyle = "#f5e7bf";
      ctx.beginPath();
      ctx.moveTo(-15, -12);
      ctx.lineTo(-6, -27);
      ctx.lineTo(1, -11);
      ctx.moveTo(15, -12);
      ctx.lineTo(6, -27);
      ctx.lineTo(-1, -11);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(20, -2);
      ctx.lineTo(33, 4);
      ctx.lineTo(20, 10);
      ctx.fill();
    }

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-7, -2, 2.3, 0, Math.PI * 2);
    ctx.arc(7, -2, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = hexToRgba(p.color, Math.min(1, p.life * 1.8));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + p.life * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y);
  if (len > 1) {
    v.x /= len;
    v.y /= len;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function nearestHand(point) {
  return hands.reduce((closest, hand) => {
    const dist = Math.hypot(point.x - hand.x, point.y - hand.y);
    return !closest || dist < closest.dist ? { hand, dist } : closest;
  }, null).hand;
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt, now);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key));

canvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  pointerTargets.set(nearestHand(point).id, point);
});

document.querySelectorAll("[data-key]").forEach((button) => {
  const key = button.dataset.key;
  const start = (event) => {
    event.preventDefault();
    keys.add(key);
  };
  const end = (event) => {
    event.preventDefault();
    keys.delete(key);
  };
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", end);
  button.addEventListener("pointercancel", end);
  button.addEventListener("pointerleave", end);
});

resetButton.addEventListener("click", () => {
  score.p1 = 0;
  score.p2 = 0;
  p1ScoreEl.textContent = "0";
  p2ScoreEl.textContent = "0";
  resetRound("Scores reset. Start sneaking.");
});

window.__roundTableTrial = {
  getState() {
    return {
      score: { ...score },
      hands: hands.map((hand) => ({
        id: hand.id,
        x: Math.round(hand.x),
        y: Math.round(hand.y),
        speed: Math.round(hand.speed),
      })),
      animals: animals.map((animal) => ({
        id: animal.id,
        x: Math.round(animal.x),
        y: Math.round(animal.y),
        panic: Number(animal.panic.toFixed(2)),
        caught: animal.caught,
      })),
      message: messageEl.textContent,
    };
  },
};

resetRound();
requestAnimationFrame(loop);

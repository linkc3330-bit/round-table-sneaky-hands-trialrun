const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const messageEl = document.querySelector("#message");
const bannerEl = document.querySelector("#roundBanner");
const p1ScoreEl = document.querySelector("#p1Score");
const p2ScoreEl = document.querySelector("#p2Score");
const resetButton = document.querySelector("#resetButton");

const table = { x: 500, y: 338, r: 282, inner: 112 };
const laneOuter = 318;
const laneInner = 68;
const catchDistance = 33;
const scareDistance = 84;
const safeVelocity = 0.34;
const panicVelocity = 0.52;
const innerCircleProgress = 0.68;
const compressedTableRadius = 198;
const score = { p1: 0, p2: 0 };

let activeTableRadius = table.r;
let compression = 0;
let lastTime = performance.now();
let nextRoundAt = 0;
let lastRightClickAt = 0;
let animals = [];
let particles = [];

const hands = [
  makeHand("p1", "P1", -Math.PI / 2, "#57bfff", true),
  makeHand("p2", "P2", 0.1, "#b377ff", true),
  makeHand("p3", "P3", 0.95, "#70d995", false),
  makeHand("p4", "P4", 2.18, "#ffd166", false),
  makeHand("p5", "P5", 3.03, "#ff7b8a", false),
  makeHand("p6", "P6", -2.55, "#58d8c5", false),
];

function makeHand(id, label, angle, color, active) {
  return {
    id,
    label,
    angle,
    color,
    active,
    progress: active ? 0 : 0.16 + Math.random() * 0.15,
    velocity: 0,
    pressed: false,
    holdTime: 0,
    catchFlash: 0,
    scaredFlash: 0,
  };
}

function makeAnimal(i, x, y) {
  const types = ["bunny", "cat", "duck", "hedgehog", "hamster"];
  return {
    id: i,
    type: types[i % types.length],
    x,
    y,
    vx: 0,
    vy: 0,
    panic: 0,
    caught: false,
    wobble: Math.random() * Math.PI * 2,
  };
}

function resetRound(text = "Right-click and hold P1 or P2. Slow hands catch; lunges scare.") {
  for (const hand of hands) {
    hand.progress = hand.active ? 0 : 0.16 + Math.random() * 0.15;
    hand.velocity = 0;
    hand.pressed = false;
    hand.holdTime = 0;
    hand.catchFlash = 0;
    hand.scaredFlash = 0;
  }

  animals = [
    makeAnimal(0, 456, 302),
    makeAnimal(1, 520, 292),
    makeAnimal(2, 555, 350),
    makeAnimal(3, 492, 388),
    makeAnimal(4, 438, 358),
  ];
  particles = [];
  activeTableRadius = table.r;
  compression = 0;
  showMessage(text);
}

function showMessage(text, urgent = false) {
  messageEl.textContent = text;
  bannerEl.textContent = text;
  bannerEl.classList.add("show");
  bannerEl.style.color = urgent ? "#ff8c92" : "#ffd166";
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => bannerEl.classList.remove("show"), 1700);
}

function update(dt, now) {
  if (nextRoundAt && now > nextRoundAt) {
    nextRoundAt = 0;
    resetRound("Fresh animals. Both inner hands shrink the table.");
  }

  updateHands(dt);
  updateArenaCompression(dt);
  updateAnimals(dt);
  updateParticles(dt);
}

function updateHands(dt) {
  for (const hand of hands) {
    const previous = hand.progress;

    if (!hand.active) {
      hand.progress += Math.sin(performance.now() / 1000 + hand.angle * 3) * 0.002;
      hand.progress = clamp(hand.progress, 0.08, 0.38);
      continue;
    }

    if (hand.pressed) {
      hand.holdTime += dt;
      const ramp = Math.min(1, hand.holdTime / 1.15);
      const targetSpeed = 0.16 + ramp * 0.52;
      hand.progress += targetSpeed * dt;
    } else {
      hand.holdTime = 0;
      hand.progress -= 0.34 * dt;
    }

    hand.progress = clamp(hand.progress, 0, 1);
    hand.velocity = (hand.progress - previous) / Math.max(dt, 0.001);
    hand.catchFlash = Math.max(0, hand.catchFlash - dt);
    hand.scaredFlash = Math.max(0, hand.scaredFlash - dt);
  }
}

function updateArenaCompression(dt) {
  const activeHands = hands.filter((hand) => hand.active);
  const bothHandsInInner = activeHands.every((hand) => hand.progress >= innerCircleProgress);
  const targetCompression = bothHandsInInner ? 1 : 0;
  compression += (targetCompression - compression) * Math.min(1, dt * 5.5);
  activeTableRadius = table.r + (compressedTableRadius - table.r) * compression;

  if (bothHandsInInner && compression < 0.18) {
    showMessage("Both hands reached the inner ring. The table shrinks!", true);
  }
}

function updateAnimals(dt) {
  for (const animal of animals) {
    if (animal.caught) continue;

    animal.wobble += dt * 3;
    let strongestThreat = null;

    for (const hand of hands.filter((item) => item.active)) {
      const tip = handTip(hand);
      const dx = animal.x - tip.x;
      const dy = animal.y - tip.y;
      const dist = Math.hypot(dx, dy);

      if (dist < catchDistance && Math.abs(hand.velocity) < safeVelocity) {
        catchAnimal(animal, hand);
        continue;
      }

      if (dist < scareDistance && hand.velocity > panicVelocity) {
        strongestThreat = { hand, dx, dy, dist };
      }
    }

    if (strongestThreat) {
      const awayX = strongestThreat.dx / Math.max(1, strongestThreat.dist);
      const awayY = strongestThreat.dy / Math.max(1, strongestThreat.dist);
      animal.vx += awayX * 560 * dt;
      animal.vy += awayY * 560 * dt;
      animal.panic = 1;
      strongestThreat.hand.scaredFlash = 0.5;
      spawnParticles(animal.x, animal.y, "#ff5f6d", 6);
      showMessage(`${strongestThreat.hand.label} lunged. Animals scatter!`, true);
    } else {
      animal.vx += Math.cos(animal.wobble) * 9 * dt;
      animal.vy += Math.sin(animal.wobble * 0.85) * 9 * dt;
      animal.panic = Math.max(0, animal.panic - dt * 0.92);
    }

    animal.x += animal.vx * dt;
    animal.y += animal.vy * dt;
    animal.vx *= Math.pow(0.74, dt * 5);
    animal.vy *= Math.pow(0.74, dt * 5);
    keepAnimalOnTable(animal);
  }
}

function catchAnimal(animal, hand) {
  if (animal.caught) return;
  animal.caught = true;
  score[hand.id] += 1;
  hand.catchFlash = 0.75;
  p1ScoreEl.textContent = score.p1;
  p2ScoreEl.textContent = score.p2;
  spawnParticles(animal.x, animal.y, hand.color, 18);
  showMessage(`${hand.label} caught the ${animal.type}.`);

  if (animals.every((item) => item.caught)) {
    const result =
      score.p1 === score.p2 ? "Tied table" : score.p1 > score.p2 ? "P1 leads" : "P2 leads";
    showMessage(`${result}. Resetting snacks...`);
    nextRoundAt = performance.now() + 1400;
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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoardBackdrop();
  drawTable();
  drawLanes();
  drawAnimals();
  drawHands();
  drawParticles();
  drawLogo();
  drawRuleCard();
  drawFlowCards();
  drawProps();
}

function drawBoardBackdrop() {
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#2a3037");
  bg.addColorStop(1, "#171a1f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let x = -40; x < canvas.width; x += 56) {
    ctx.fillRect(x, 0, 2, canvas.height);
  }
}

function drawTable() {
  ctx.save();
  ctx.translate(table.x, table.y);

  const tableGradient = ctx.createRadialGradient(-60, -80, 40, 0, 0, table.r + 30);
  tableGradient.addColorStop(0, "#b87743");
  tableGradient.addColorStop(0.62, "#935d34");
  tableGradient.addColorStop(1, "#5f341f");
  ctx.fillStyle = tableGradient;
  ctx.strokeStyle = "#d79a5e";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(0, 0, table.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 231, 185, 0.19)";
  ctx.lineWidth = 2;
  for (let r = 58; r <= table.r - 30; r += 44) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (compression > 0.02) {
    ctx.fillStyle = `rgba(19, 16, 13, ${0.46 * compression})`;
    ctx.beginPath();
    ctx.arc(0, 0, table.r - 8, 0, Math.PI * 2);
    ctx.arc(0, 0, activeTableRadius, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 209, 102, ${0.4 + 0.44 * compression})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, activeTableRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, table.inner, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawLanes() {
  for (const hand of hands) {
    const outer = lanePoint(hand.angle, laneOuter);
    const inner = lanePoint(hand.angle, laneInner);
    const tip = handTip(hand);
    const fast = hand.velocity > panicVelocity;

    ctx.strokeStyle = fast ? "rgba(255,95,109,0.78)" : hexToRgba(hand.color, hand.active ? 0.58 : 0.28);
    ctx.lineWidth = hand.active ? 9 : 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(outer.x, outer.y);
    ctx.lineTo(inner.x, inner.y);
    ctx.stroke();

    if (hand.active) {
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 9]);
      ctx.beginPath();
      ctx.moveTo(outer.x, outer.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrow(tip.x, tip.y, hand.angle + Math.PI, hand.color);
    }
  }
}

function drawHands() {
  for (const hand of hands) {
    const base = lanePoint(hand.angle, laneOuter + 20);
    const tip = handTip(hand);
    const fast = hand.velocity > panicVelocity;

    if (fast) {
      ctx.strokeStyle = "rgba(255, 95, 109, 0.45)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, scareDistance, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(hand.angle + Math.PI);
    ctx.fillStyle = hand.catchFlash ? "#f8f1c7" : hand.color;
    ctx.globalAlpha = hand.active ? 1 : 0.72;
    ctx.strokeStyle = fast || hand.scaredFlash ? "#ff5f6d" : "#101217";
    ctx.lineWidth = fast ? 5 : 3;
    roundRect(ctx, -34, -20, 68, 40, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.62)";
    for (let i = 0; i < 4; i += 1) {
      roundRect(ctx, 11, -18 + i * 9, 25, 6, 4);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = hand.active ? "#f7edda" : "rgba(247,237,218,0.62)";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(hand.label, base.x, base.y + 5);
  }
}

function drawAnimals() {
  for (const animal of animals) {
    if (animal.caught) continue;
    const pulse = 1 + animal.panic * 0.24 * Math.sin(performance.now() / 70);
    ctx.save();
    ctx.translate(animal.x, animal.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = animal.panic > 0.05 ? "#ff6d78" : "#f5e7bf";
    ctx.strokeStyle = animal.panic > 0.05 ? "#ffd166" : "#2b2520";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (animal.type === "bunny") {
      drawBunny();
    } else if (animal.type === "cat") {
      drawCat();
    } else if (animal.type === "duck") {
      drawDuck();
    } else if (animal.type === "hedgehog") {
      drawHedgehog();
    }

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-7, -2, 2.3, 0, Math.PI * 2);
    ctx.arc(7, -2, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBunny() {
  ctx.fillStyle = "#f5e7bf";
  ctx.beginPath();
  ctx.ellipse(-8, -20, 5, 17, -0.25, 0, Math.PI * 2);
  ctx.ellipse(8, -20, 5, 17, 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawCat() {
  ctx.fillStyle = "#f5e7bf";
  ctx.beginPath();
  ctx.moveTo(-15, -12);
  ctx.lineTo(-6, -27);
  ctx.lineTo(1, -11);
  ctx.moveTo(15, -12);
  ctx.lineTo(6, -27);
  ctx.lineTo(-1, -11);
  ctx.fill();
}

function drawDuck() {
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(20, -2);
  ctx.lineTo(33, 4);
  ctx.lineTo(20, 10);
  ctx.fill();
}

function drawHedgehog() {
  ctx.strokeStyle = "#5f4734";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-14 + i * 5, -12);
    ctx.lineTo(-17 + i * 5, -25);
    ctx.stroke();
  }
}

function drawLogo() {
  ctx.save();
  ctx.translate(126, 116);
  ctx.rotate(-0.12);
  ctx.fillStyle = "#2c2320";
  ctx.strokeStyle = "#f1d38c";
  ctx.lineWidth = 5;
  roundRect(ctx, -70, -45, 140, 90, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffd166";
  ctx.font = "900 24px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("SNEAKY", 0, -8);
  ctx.fillText("HANDS", 0, 22);
  ctx.font = "700 10px system-ui";
  ctx.fillStyle = "#f7edda";
  ctx.fillText("catch 'em if you can", 0, 39);
  ctx.restore();
}

function drawRuleCard() {
  ctx.save();
  ctx.translate(808, 120);
  ctx.fillStyle = "#fff0ca";
  ctx.strokeStyle = "#6b472e";
  ctx.lineWidth = 3;
  roundRect(ctx, -78, -58, 156, 136, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#47311f";
  ctx.font = "900 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("2P Rules", 0, -34);
  ctx.font = "700 11px system-ui";
  [
    "Right-click: sneak",
    "Release: pull back",
    "Slow touch: score",
    "Fast lunge: scatter",
    "Both inner: shrink",
  ].forEach((line, i) => ctx.fillText(line, 0, -10 + i * 19));
  ctx.restore();
}

function drawFlowCards() {
  const cards = [
    ["1", "Slowly move", "your hand"],
    ["2", "Animals react", "to fast lunges"],
    ["3", "The table", "can shrink"],
    ["4", "Catch one", "to score"],
  ];
  ctx.save();
  ctx.translate(258, 640);
  cards.forEach((card, i) => {
    const x = i * 128;
    ctx.fillStyle = "#fff0ca";
    ctx.strokeStyle = "#7f5332";
    ctx.lineWidth = 2;
    roundRect(ctx, x, -42, 116, 64, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1d4d7a";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`${card[0]}. ${card[1]}`, x + 10, -16);
    ctx.fillStyle = "#7a3b24";
    ctx.font = "800 10px system-ui";
    ctx.fillText(card[2], x + 10, 3);
  });
  ctx.restore();
}

function drawProps() {
  ctx.save();
  ctx.fillStyle = "#1c1f25";
  ctx.strokeStyle = "#5b6a7c";
  ctx.lineWidth = 3;
  roundRect(ctx, 846, 505, 86, 124, 12);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#c98745";
  ctx.strokeRect(860, 520, 58, 88);

  ctx.fillStyle = "#f7edda";
  ctx.strokeStyle = "#39271a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(83, 558, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3c2416";
  ctx.beginPath();
  ctx.arc(83, 558, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = hexToRgba(p.color, Math.min(1, p.life * 1.8));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + p.life * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function handTip(hand) {
  return lanePoint(hand.angle, laneOuter - (laneOuter - laneInner) * hand.progress);
}

function lanePoint(angle, radius) {
  return {
    x: table.x + Math.cos(angle) * radius,
    y: table.y + Math.sin(angle) * radius,
  };
}

function nearestLane(point) {
  return hands
    .filter((hand) => hand.active)
    .reduce((closest, hand) => {
      const tip = handTip(hand);
      const base = lanePoint(hand.angle, laneOuter + 26);
      const dist = Math.min(Math.hypot(point.x - tip.x, point.y - tip.y), distanceToSegment(point, base, tip));
      return !closest || dist < closest.dist ? { hand, dist } : closest;
    }, null).hand;
}

function distanceToSegment(point, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = point.x - a.x;
  const wy = point.y - a.y;
  const t = clamp((wx * vx + wy * vy) / Math.max(1, vx * vx + vy * vy), 0, 1);
  return Math.hypot(point.x - (a.x + vx * t), point.y - (a.y + vy * t));
}

function keepAnimalOnTable(animal) {
  const dx = animal.x - table.x;
  const dy = animal.y - table.y;
  const dist = Math.hypot(dx, dy);
  const max = activeTableRadius - 30;
  if (dist > max) {
    animal.x = table.x + (dx / dist) * max;
    animal.y = table.y + (dy / dist) * max;
    animal.vx *= -0.22;
    animal.vy *= -0.22;
    animal.panic = Math.max(animal.panic, 0.45);
  }
}

function drawArrow(x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(14, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(8, -7);
  ctx.lineTo(8, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 155;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 0.32 + Math.random() * 0.44,
    });
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function setPressed(id, pressed) {
  const hand = hands.find((item) => item.id === id);
  if (!hand || !hand.active) return;
  hand.pressed = pressed;
  if (pressed) showMessage(`${hand.label} sneaking inward. Release before it becomes a lunge.`);
}

function releaseAllHands() {
  hands.forEach((hand) => {
    hand.pressed = false;
  });
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

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt, now);
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 2 && event.pointerType !== "touch") return;
  event.preventDefault();
  const now = performance.now();
  const hand = nearestLane(canvasPoint(event));
  if (now - lastRightClickAt < 260) hand.holdTime = 1.25;
  lastRightClickAt = now;
  setPressed(hand.id, true);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  releaseAllHands();
});

canvas.addEventListener("pointercancel", releaseAllHands);
canvas.addEventListener("pointerleave", releaseAllHands);

document.querySelectorAll("[data-hold]").forEach((button) => {
  const id = button.dataset.hold;
  const start = (event) => {
    event.preventDefault();
    setPressed(id, true);
  };
  const end = (event) => {
    event.preventDefault();
    setPressed(id, false);
  };
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", end);
  button.addEventListener("pointercancel", end);
  button.addEventListener("pointerleave", end);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
});

resetButton.addEventListener("click", () => {
  score.p1 = 0;
  score.p2 = 0;
  p1ScoreEl.textContent = "0";
  p2ScoreEl.textContent = "0";
  resetRound("Scores reset. Right-click P1 or P2 to sneak.");
});

window.__roundTableTrial = {
  getState() {
    return {
      score: { ...score },
      hands: hands.map((hand) => ({
        id: hand.id,
        active: hand.active,
        progress: Number(hand.progress.toFixed(2)),
        velocity: Number(hand.velocity.toFixed(2)),
        pressed: hand.pressed,
      })),
      arena: {
        compression: Number(compression.toFixed(2)),
        activeTableRadius: Math.round(activeTableRadius),
      },
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

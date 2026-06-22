const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const messageEl = document.querySelector("#message");
const bannerEl = document.querySelector("#roundBanner");
const phaseLabelEl = document.querySelector("#phaseLabel");

const table = { x: 500, y: 350, r: 282, inner: 112 };
const loopSeconds = 13.5;
let startTime = performance.now();
let lastPhase = "";

const hands = [
  { id: "p1", label: "P1", angle: -Math.PI / 2, color: "#57bfff", active: true, offset: 0.05 },
  { id: "p2", label: "P2", angle: 0.1, color: "#b377ff", active: true, offset: 0.25 },
  { id: "p3", label: "P3", angle: 0.95, color: "#70d995", active: false, offset: 0.18 },
  { id: "p4", label: "P4", angle: 2.18, color: "#ffd166", active: false, offset: 0.3 },
  { id: "p5", label: "P5", angle: 3.03, color: "#ff7b8a", active: false, offset: 0.22 },
  { id: "p6", label: "P6", angle: -2.55, color: "#58d8c5", active: false, offset: 0.16 },
];

const animals = [
  { id: 0, type: "bunny", x: 462, y: 318, look: -1.45 },
  { id: 1, type: "cat", x: 528, y: 306, look: 0.05 },
  { id: 2, type: "duck", x: 565, y: 366, look: 0.8 },
  { id: 3, type: "hedgehog", x: 493, y: 404, look: 1.75 },
  { id: 4, type: "hamster", x: 438, y: 370, look: 2.8 },
];

function phaseAt(t) {
  if (t < 2.2) {
    return {
      key: "Sightlines",
      caption: "Note.1: animals have sightlines. A hand inside sightline is watched.",
    };
  }
  if (t < 5.1) {
    return {
      key: "Motion Seen",
      caption: "When a watched hand moves, threat starts building before contact.",
    };
  }
  if (t < 8.2) {
    return {
      key: "Threat Stack",
      caption: "Other hands inside the same sightline add pressure to the animal.",
    };
  }
  if (t < 10.8) {
    return {
      key: "Scare",
      caption: "Threat crosses the scare threshold. Animals retreat away from the moving hand.",
    };
  }
  return {
    key: "Reset",
    caption: "The loop resets as a concept animation, not a playable control prototype.",
  };
}

function handProgress(hand, t) {
  if (!hand.active) return 0.16 + hand.offset + Math.sin(t * 1.3 + hand.angle) * 0.02;
  if (hand.id === "p1") return easePulse(t, 1.2, 7.7, 0.08, 0.86);
  if (hand.id === "p2") return easePulse(t, 3.2, 8.3, 0.08, 0.76);
  return 0.15;
}

function easePulse(t, start, peak, low, high) {
  if (t < start) return low;
  if (t < peak) return low + (high - low) * smoothstep((t - start) / (peak - start));
  if (t < 11.2) return high - (high - low) * smoothstep((t - peak) / (11.2 - peak));
  return low;
}

function updateDom(phase) {
  if (phase.key === lastPhase) return;
  lastPhase = phase.key;
  phaseLabelEl.textContent = phase.key;
  messageEl.textContent = phase.caption;
  bannerEl.textContent = phase.caption;
  bannerEl.classList.add("show");
  window.clearTimeout(updateDom.timer);
  updateDom.timer = window.setTimeout(() => bannerEl.classList.remove("show"), 1800);
}

function draw(now) {
  const t = ((now - startTime) / 1000) % loopSeconds;
  const phase = phaseAt(t);
  updateDom(phase);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop();
  drawTable(t);
  drawSightlines(t);
  drawThreatRange(t);
  drawLanesAndHands(t);
  drawAnimals(t);
  drawLogo();
  drawRuleCard(t);
  drawTimeline(t, phase);

  requestAnimationFrame(draw);
}

function drawBackdrop() {
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#2a3037");
  bg.addColorStop(1, "#171a1f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let x = -40; x < canvas.width; x += 56) ctx.fillRect(x, 0, 2, canvas.height);
}

function drawTable(t) {
  ctx.save();
  ctx.translate(table.x, table.y);
  const gradient = ctx.createRadialGradient(-70, -90, 40, 0, 0, table.r + 30);
  gradient.addColorStop(0, "#b87743");
  gradient.addColorStop(0.62, "#935d34");
  gradient.addColorStop(1, "#5f341f");
  ctx.fillStyle = gradient;
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

  ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, table.inner, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (t > 8.2 && t < 11.2) {
    const flash = Math.sin(t * 12) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(255, 95, 109, ${0.35 + flash * 0.35})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 168, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSightlines(t) {
  const alpha = t < 2.2 ? 0.32 : t < 8.2 ? 0.22 : 0.14;
  for (const animal of animals) {
    const panic = t > 8.2 && t < 10.8;
    const look = panic ? animal.look + Math.sin(t * 12 + animal.id) * 0.32 : animal.look;
    drawVisionCone(animal.x, animal.y, look, 118, alpha, panic);
  }
}

function drawVisionCone(x, y, angle, length, alpha, panic) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = panic ? `rgba(255, 95, 109, ${alpha})` : `rgba(255, 209, 102, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, -34);
  ctx.arc(length, 0, 34, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.restore();
}

function drawThreatRange(t) {
  const stack = threatStack(t);
  if (stack <= 0.02) return;
  const radius = 78 + stack * 72;
  ctx.save();
  ctx.translate(500, 352);
  ctx.strokeStyle = stack > 0.72 ? "rgba(255, 95, 109, 0.78)" : "rgba(255, 209, 102, 0.68)";
  ctx.fillStyle = stack > 0.72 ? "rgba(255, 95, 109, 0.13)" : "rgba(255, 209, 102, 0.09)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f7edda";
  ctx.font = "900 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`Threat stack ${Math.round(stack * 100)}%`, 0, -radius - 12);
  ctx.restore();
}

function drawLanesAndHands(t) {
  for (const hand of hands) {
    const progress = handProgress(hand, t);
    const outer = lanePoint(hand.angle, 318);
    const inner = lanePoint(hand.angle, 70);
    const tip = lanePoint(hand.angle, 318 - (318 - 70) * progress);
    const moving = hand.active && ((hand.id === "p1" && t > 1.2 && t < 7.7) || (hand.id === "p2" && t > 3.2 && t < 8.3));

    ctx.strokeStyle = moving ? "rgba(255, 209, 102, 0.86)" : hexToRgba(hand.color, hand.active ? 0.58 : 0.28);
    ctx.lineWidth = hand.active ? 9 : 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(outer.x, outer.y);
    ctx.lineTo(inner.x, inner.y);
    ctx.stroke();

    if (moving) drawMotionTicks(tip.x, tip.y, hand.angle, hand.color);
    drawHand(hand, tip, progress, moving, t);
  }
}

function drawHand(hand, tip, progress, moving, t) {
  const base = lanePoint(hand.angle, 340);
  const panic = t > 8.2 && t < 10.8 && moving;
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(hand.angle + Math.PI);
  ctx.globalAlpha = hand.active ? 1 : 0.72;
  ctx.fillStyle = panic ? "#ff8c92" : hand.color;
  ctx.strokeStyle = panic ? "#ff5f6d" : "#101217";
  ctx.lineWidth = panic ? 5 : 3;
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

  if (hand.active && progress > 0.58) {
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawMotionTicks(x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-56 - i * 12, -14 + i * 14);
    ctx.lineTo(-38 - i * 10, -6 + i * 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAnimals(t) {
  const panic = t > 8.2 && t < 10.8;
  for (const animal of animals) {
    const retreat = panic ? retreatOffset(animal, t) : { x: 0, y: 0 };
    const pulse = panic ? 1 + 0.18 * Math.sin(t * 18 + animal.id) : 1;
    ctx.save();
    ctx.translate(animal.x + retreat.x, animal.y + retreat.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = panic ? "#ff6d78" : "#f5e7bf";
    ctx.strokeStyle = panic ? "#ffd166" : "#2b2520";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (animal.type === "bunny") drawBunny();
    if (animal.type === "cat") drawCat();
    if (animal.type === "duck") drawDuck();
    if (animal.type === "hedgehog") drawHedgehog();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-7, -2, 2.3, 0, Math.PI * 2);
    ctx.arc(7, -2, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function retreatOffset(animal, t) {
  const dx = animal.x - table.x;
  const dy = animal.y - table.y;
  const dist = Math.hypot(dx, dy) || 1;
  const amount = 26 + Math.sin(t * 12 + animal.id) * 8;
  return { x: (dx / dist) * amount, y: (dy / dist) * amount };
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
  ctx.fillText("sightline demo", 0, 39);
  ctx.restore();
}

function drawRuleCard(t) {
  ctx.save();
  ctx.translate(815, 124);
  ctx.fillStyle = "#fff0ca";
  ctx.strokeStyle = "#6b472e";
  ctx.lineWidth = 3;
  roundRect(ctx, -88, -64, 176, 156, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#47311f";
  ctx.font = "900 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Note.1 model", 0, -40);
  ctx.font = "700 11px system-ui";
  [
    "Animals have sightlines",
    "Moving hand is noticed",
    "Other hands add threat",
    "Threat range scales",
    "Scare triggers retreat",
  ].forEach((line, i) => ctx.fillText(line, 0, -14 + i * 21));
  ctx.fillStyle = "#a53d38";
  ctx.fillText(`Threat ${Math.round(threatStack(t) * 100)}%`, 0, 80);
  ctx.restore();
}

function drawTimeline(t, phase) {
  const steps = [
    ["1", "Sightlines"],
    ["2", "Hand moves"],
    ["3", "Threat stacks"],
    ["4", "Scare retreat"],
  ];
  ctx.save();
  ctx.translate(245, 642);
  steps.forEach((step, i) => {
    const active = phase.key.toLowerCase().includes(step[1].split(" ")[0].toLowerCase());
    const x = i * 138;
    ctx.fillStyle = active ? "#ffd166" : "#fff0ca";
    ctx.strokeStyle = "#7f5332";
    ctx.lineWidth = 2;
    roundRect(ctx, x, -42, 124, 64, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1d4d7a";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`${step[0]}. ${step[1]}`, x + 10, -7);
  });
  ctx.restore();
}

function threatStack(t) {
  if (t < 2.2) return 0;
  if (t < 5.1) return smoothstep((t - 2.2) / 2.9) * 0.42;
  if (t < 8.2) return 0.42 + smoothstep((t - 5.1) / 3.1) * 0.48;
  if (t < 10.8) return 1;
  return Math.max(0, 1 - smoothstep((t - 10.8) / 2.7));
}

function lanePoint(angle, radius) {
  return {
    x: table.x + Math.cos(angle) * radius,
    y: table.y + Math.sin(angle) * radius,
  };
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

function smoothstep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

window.__roundTableTrial = {
  getState() {
    const t = ((performance.now() - startTime) / 1000) % loopSeconds;
    return {
      mode: "autoplay-note1-animation",
      phase: phaseAt(t).key,
      threat: Number(threatStack(t).toFixed(2)),
      controlsEnabled: false,
    };
  },
};

requestAnimationFrame(draw);

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const messageEl = document.querySelector("#message");
const bannerEl = document.querySelector("#roundBanner");
const phaseLabelEl = document.querySelector("#phaseLabel");

const table = { x: 500, y: 350, r: 282, inner: 112 };
const loopSeconds = 18;
const retreatPauseSeconds = 0.75;
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
  { id: 0, label: "A", type: "bunny", x: 462, y: 318, look: -1.45, triggerAt: 7.1, retreat: 30, decision: 36, chain: { x: 0, y: 0 } },
  { id: 1, label: "B", type: "cat", x: 528, y: 306, look: 0.05, triggerAt: 7.75, retreat: 34, decision: 42, chain: { x: 0, y: 0 } },
  { id: 2, label: "C", type: "duck", x: 565, y: 366, look: 0.8, triggerAt: 8.4, retreat: 32, decision: 46, chain: { x: -28, y: -12 } },
  { id: 3, label: "D", type: "hedgehog", x: 493, y: 404, look: 1.75, triggerAt: 9.05, retreat: 28, decision: 38, chain: { x: -38, y: 18 } },
  { id: 4, label: "E", type: "hamster", x: 438, y: 370, look: 2.8, triggerAt: 9.7, retreat: 31, decision: 34, chain: { x: 14, y: 22 } },
];

const phases = [
  {
    key: "Sightlines",
    start: 0,
    end: 2.1,
    caption: "Note.1: animals have sightlines. A hand inside sightline is watched.",
  },
  {
    key: "Motion Seen",
    start: 2.1,
    end: 4.8,
    caption: "Watched hand movement starts pressure before contact.",
  },
  {
    key: "Threat Stack",
    start: 4.8,
    end: 7.1,
    caption: "Nearby hands add scare zone pressure between hand ranges.",
  },
  {
    key: "Per-Animal Trigger",
    start: 7.1,
    end: 10.1,
    caption: "Note.4: triggers resolve per animal. Only the animal that sees danger panics first.",
  },
  {
    key: "Retreat Short Step",
    start: 10.1,
    end: 11.6,
    caption: "Note.2: each triggered animal retreats on its own clock, not as a group.",
  },
  {
    key: "Wait 0.75s",
    start: 11.6,
    end: 12.35,
    caption: "Note.2: only animals that already retreated show their 0.75 second pause.",
  },
  {
    key: "Recheck Direction",
    start: 12.35,
    end: 14.2,
    caption: "Note.3: animals re-run sightline logic after their own pause window.",
  },
  {
    key: "Chain Influence",
    start: 14.2,
    end: 16.2,
    caption: "Note.4: retreating animals can bump into others and alter their movement paths.",
  },
  {
    key: "Reset",
    start: 16.2,
    end: 18,
    caption: "The loop resets as a concept animation, not a playable control prototype.",
  },
];

function phaseAt(t) {
  return phases.find((phase) => t >= phase.start && t < phase.end) ?? phases[0];
}

function handProgress(hand, t) {
  if (!hand.active) return 0.16 + hand.offset + Math.sin(t * 1.3 + hand.angle) * 0.02;
  if (hand.id === "p1") return easePulse(t, 1.2, 7.8, 0.08, 0.86);
  if (hand.id === "p2") return easePulse(t, 3.1, 8.3, 0.08, 0.76);
  return 0.15;
}

function easePulse(t, start, peak, low, high) {
  if (t < start) return low;
  if (t < peak) return low + (high - low) * smoothstep((t - start) / (peak - start));
  if (t < 16) return high - (high - low) * smoothstep((t - peak) / (16 - peak));
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
  drawScareZonesBetweenHands(t);
  drawPaths(t);
  drawLanesAndHands(t);
  drawAnimals(t);
  drawChainInfluence(t);
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

  if (t > 7.1 && t < 16.2) {
    const flash = Math.sin(t * 12) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(255, 95, 109, ${0.28 + flash * 0.26})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 168, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSightlines(t) {
  const alpha = t < 2.1 ? 0.32 : t < 12.35 ? 0.2 : 0.26;
  for (const animal of animals) {
    const position = animalPosition(animal, t);
    const state = animalScareState(animal, t);
    const panic = state.trigger || state.retreat;
    const recheck = state.recheck;
    const look = animal.look + (panic ? Math.sin(t * 14 + animal.id) * 0.32 : 0) + (recheck ? 0.45 : 0);
    drawVisionCone(position.x, position.y, look, recheck ? 138 : 118, alpha, panic, recheck);
  }
}

function drawVisionCone(x, y, angle, length, alpha, panic, recheck) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = panic
    ? `rgba(255, 95, 109, ${alpha})`
    : recheck
      ? `rgba(87, 191, 255, ${alpha})`
      : `rgba(255, 209, 102, ${alpha})`;
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

function drawScareZonesBetweenHands(t) {
  if (t < 4.8 || t > 9.1) return;
  const p1 = handTip(hands[0], t);
  const p2 = handTip(hands[1], t);
  const alpha = t < 7.1 ? 0.14 : 0.3 + Math.sin(t * 12) * 0.08;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 209, 102, ${alpha + 0.18})`;
  ctx.fillStyle = `rgba(255, 209, 102, ${alpha})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 9]);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.quadraticCurveTo(table.x + 12, table.y - 18, p2.x, p2.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff0ca";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("hand-to-hand scare zone", table.x + 38, table.y - 88);
  ctx.restore();
}

function drawPaths(t) {
  if (t < 7.55) return;
  for (const animal of animals) {
    const state = animalScareState(animal, t);
    if (!state.retreat && !state.wait && !state.recheck && !state.chain) continue;

    const base = { x: animal.x, y: animal.y };
    const shortStop = retreatStop(animal, t);
    const decisionStop = decisionStopPoint(animal, t);

    ctx.save();
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    ctx.strokeStyle = state.recheck || state.chain ? "rgba(87, 191, 255, 0.62)" : "rgba(255, 95, 109, 0.72)";
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(shortStop.x, shortStop.y);
    if (state.recheck || state.chain) ctx.lineTo(decisionStop.x, decisionStop.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowHead(shortStop.x, shortStop.y, base.x, base.y, state.recheck || state.chain ? "#57bfff" : "#ff6d78");
    if (state.recheck || state.chain) drawArrowHead(decisionStop.x, decisionStop.y, shortStop.x, shortStop.y, "#57bfff");
    ctx.restore();
  }
}

function drawLanesAndHands(t) {
  for (const hand of hands) {
    const progress = handProgress(hand, t);
    const outer = lanePoint(hand.angle, 318);
    const inner = lanePoint(hand.angle, 70);
    const tip = lanePoint(hand.angle, 318 - (318 - 70) * progress);
    const moving = isMovingHand(hand, t);

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
  const panic = t > 7.1 && t < 10.1 && moving;
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
  for (const animal of animals) {
    const position = animalPosition(animal, t);
    const state = animalScareState(animal, t);
    const panic = state.trigger || state.retreat;
    const chain = state.chain && animal.id >= 2;
    const pulse = panic ? 1 + 0.12 * Math.sin(t * 18 + animal.id) : 1;

    if (state.trigger) drawAnimalTriggerPulse(position.x, position.y, animal);
    if (state.wait) drawWaitBadge(position.x, position.y, animal);
    if (state.recheck) drawDecisionBadge(position.x, position.y, animal);

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = panic ? "#ff6d78" : chain ? "#9ee493" : state.recheck ? "#d9f2ff" : "#f5e7bf";
    ctx.strokeStyle = panic ? "#ffd166" : chain ? "#1d6b4f" : "#2b2520";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (animal.type === "bunny") drawBunny();
    if (animal.type === "cat") drawCat();
    if (animal.type === "duck") drawDuck();
    if (animal.type === "hedgehog") drawHedgehog();
    if (animal.type === "hamster") drawHamster();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-7, -2, 2.3, 0, Math.PI * 2);
    ctx.arc(7, -2, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101217";
    ctx.font = "900 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(animal.label, 0, 5);
    ctx.restore();
  }
}

function drawAnimalTriggerPulse(x, y, animal) {
  const alpha = 0.48 + Math.sin(performance.now() / 70 + animal.id) * 0.16;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 95, 109, ${alpha})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 34 + animal.id * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffcad0";
  ctx.font = "900 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`trigger ${animal.label}`, x, y - 43);
  ctx.restore();
}

function drawWaitBadge(x, y, animal) {
  ctx.save();
  ctx.fillStyle = "rgba(20, 22, 26, 0.86)";
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 2;
  roundRect(ctx, x - 43, y + 24, 86, 25, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffd166";
  ctx.font = "900 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`wait ${retreatPauseSeconds.toFixed(2)}s`, x, y + 41);
  ctx.restore();
}

function drawDecisionBadge(x, y, animal) {
  ctx.save();
  ctx.fillStyle = "rgba(20, 22, 26, 0.86)";
  ctx.strokeStyle = "#57bfff";
  ctx.lineWidth = 2;
  roundRect(ctx, x - 54, y - 52, 108, 25, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d9f2ff";
  ctx.font = "900 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(animal.id === 1 ? "higher odds: away" : "recheck sightline", x, y - 35);
  ctx.restore();
}

function drawChainInfluence(t) {
  if (t < 14.2 || t > 16.2) return;
  const c = animalPosition(animals[2], t);
  const d = animalPosition(animals[3], t);
  const e = animalPosition(animals[4], t);
  const pulse = 0.5 + Math.sin(t * 14) * 0.5;

  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = `rgba(158, 228, 147, ${0.55 + pulse * 0.28})`;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#9ee493";
  ctx.font = "900 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("collision changes another animal path", (c.x + d.x) / 2, (c.y + d.y) / 2 - 28);
  drawImpactStar((c.x + d.x) / 2, (c.y + d.y) / 2);
  ctx.restore();
}

function drawImpactStar(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffd166";
  ctx.strokeStyle = "#171a1f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 17 : 7;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function animalPosition(animal, t) {
  const retreat = retreatVector(animal, t);
  const decision = decisionVector(animal, t);
  const state = animalScareState(animal, t);
  const chainK = smoothstep((t - Math.max(14.2, animal.triggerAt + 4.5)) / 1.2) * (t < 16.2 ? 1 : 0);
  const retreatK = state.sinceTrigger < 0.45
    ? 0
    : state.sinceTrigger < 1.65
      ? smoothstep((state.sinceTrigger - 0.45) / 1.2)
      : t < 16.2
        ? 1 - smoothstep((t - 15.4) / 0.8) * 0.18
        : 0;
  const decisionK = state.sinceTrigger < 2.4
    ? 0
    : state.sinceTrigger < 4.5
      ? smoothstep((state.sinceTrigger - 2.4) / 2.1)
      : t < 16.2
        ? 1
        : 1 - smoothstep((t - 16.2) / 1.2);
  return {
    x: animal.x + retreat.x * retreatK + decision.x * decisionK + animal.chain.x * chainK,
    y: animal.y + retreat.y * retreatK + decision.y * decisionK + animal.chain.y * chainK,
  };
}

function retreatStop(animal, t) {
  const v = retreatVector(animal, t);
  return { x: animal.x + v.x, y: animal.y + v.y };
}

function decisionStopPoint(animal, t) {
  const r = retreatVector(animal, t);
  const d = decisionVector(animal, t);
  return { x: animal.x + r.x + d.x, y: animal.y + r.y + d.y };
}

function retreatVector(animal, t) {
  const threat = threatAnchor(t);
  const away = normalized(animal.x - threat.x, animal.y - threat.y);
  return { x: away.x * animal.retreat, y: away.y * animal.retreat };
}

function decisionVector(animal, t) {
  const threat = threatAnchor(t);
  const away = normalized(animal.x - threat.x, animal.y - threat.y);
  const sideways = { x: -away.y, y: away.x };
  const sideSign = animal.id % 2 === 0 ? 1 : -1;
  const oppositeThreatBias = 0.78;
  return {
    x: (away.x * oppositeThreatBias + sideways.x * 0.22 * sideSign) * animal.decision,
    y: (away.y * oppositeThreatBias + sideways.y * 0.22 * sideSign) * animal.decision,
  };
}

function threatAnchor(t) {
  const p1 = handTip(hands[0], t);
  const p2 = handTip(hands[1], t);
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function handTip(hand, t) {
  const progress = handProgress(hand, t);
  return lanePoint(hand.angle, 318 - (318 - 70) * progress);
}

function isMovingHand(hand, t) {
  return hand.active && ((hand.id === "p1" && t > 1.2 && t < 7.8) || (hand.id === "p2" && t > 3.1 && t < 8.3));
}

function animalScareState(animal, t) {
  const sinceTrigger = t - animal.triggerAt;
  return {
    sinceTrigger,
    trigger: sinceTrigger >= 0 && sinceTrigger < 0.45,
    retreat: sinceTrigger >= 0.45 && sinceTrigger < 1.65,
    wait: sinceTrigger >= 1.65 && sinceTrigger < 1.65 + retreatPauseSeconds,
    recheck: sinceTrigger >= 1.65 + retreatPauseSeconds && sinceTrigger < 4.5,
    chain: t >= 14.2 && t < 16.2 && sinceTrigger >= 3.2,
  };
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

function drawHamster() {
  ctx.fillStyle = "#e7c98b";
  ctx.beginPath();
  ctx.arc(-16, -10, 7, 0, Math.PI * 2);
  ctx.arc(16, -10, 7, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillText("note 1-4 demo", 0, 39);
  ctx.restore();
}

function drawRuleCard(t) {
  ctx.save();
  ctx.translate(816, 142);
  ctx.fillStyle = "#fff0ca";
  ctx.strokeStyle = "#6b472e";
  ctx.lineWidth = 3;
  roundRect(ctx, -102, -82, 204, 192, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#47311f";
  ctx.font = "900 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Note.1-4 model", 0, -58);
  ctx.font = "700 11px system-ui";
  [
    "1. Sightline sees hand",
    "2. Retreat short step",
    `2. Pause ${retreatPauseSeconds.toFixed(2)}s`,
    "3. Recheck movement",
    "3. Bias opposite threat",
    "4. Individual triggers",
    "4. Collision affects path",
  ].forEach((line, i) => ctx.fillText(line, 0, -34 + i * 20));
  ctx.fillStyle = "#a53d38";
  ctx.fillText(`Threat ${Math.round(threatStack(t) * 100)}%`, 0, 94);
  ctx.restore();
}

function drawTimeline(t, phase) {
  const steps = [
    ["1", "Sightline", "Sightlines"],
    ["2", "Move", "Motion Seen"],
    ["3", "Stack", "Threat Stack"],
    ["4", "Trigger", "Per-Animal Trigger"],
    ["5", "Retreat", "Retreat Short Step"],
    ["6", "Wait", "Wait 0.75s"],
    ["7", "Recheck", "Recheck Direction"],
    ["8", "Bump", "Chain Influence"],
  ];
  ctx.save();
  ctx.translate(34, 648);
  steps.forEach((step, i) => {
    const active = phase.key === step[2];
    const x = i * 119;
    ctx.fillStyle = active ? "#ffd166" : "#fff0ca";
    ctx.strokeStyle = "#7f5332";
    ctx.lineWidth = 2;
    roundRect(ctx, x, -38, 108, 58, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1d4d7a";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`${step[0]}. ${step[1]}`, x + 9, -5);
  });
  ctx.restore();
}

function threatStack(t) {
  if (t < 2.1) return 0;
  if (t < 4.8) return smoothstep((t - 2.1) / 2.7) * 0.42;
  if (t < 7.1) return 0.42 + smoothstep((t - 4.8) / 2.3) * 0.5;
  if (t < 10.1) return 0.92 + Math.sin(t * 5) * 0.04;
  if (t < 12.35) return 0.68 + Math.sin(t * 4) * 0.05;
  if (t < 14.2) return 0.5 + Math.sin(t * 4) * 0.04;
  if (t < 16.2) return 0.38;
  return Math.max(0, 0.38 - smoothstep((t - 16.2) / 1.8) * 0.38);
}

function drawArrowHead(x, y, fromX, fromY, color) {
  const angle = Math.atan2(y - fromY, x - fromX);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-12, -7);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-12, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function lanePoint(angle, radius) {
  return {
    x: table.x + Math.cos(angle) * radius,
    y: table.y + Math.sin(angle) * radius,
  };
}

function normalized(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
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
      mode: "autoplay-note1-4-animation",
      phase: phaseAt(t).key,
      threat: Number(threatStack(t).toFixed(2)),
      retreatPauseSeconds,
      animalTriggers: animals.map((animal) => ({ label: animal.label, triggerAt: animal.triggerAt })),
      oppositeThreatBias: 0.78,
      chainReaction: true,
      controlsEnabled: false,
    };
  },
};

requestAnimationFrame(draw);

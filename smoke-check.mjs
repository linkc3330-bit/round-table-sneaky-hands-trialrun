import { readFile } from "node:fs/promises";

const requiredFiles = ["index.html", "styles.css", "game.js"];
const requiredStrings = [
  ["index.html", "Sightline Scare Study"],
  ["index.html", "Autoplay diagram"],
  ["index.html", "Notes 1-4"],
  ["game.js", "autoplay-note1-4-animation"],
  ["game.js", "drawSightlines"],
  ["game.js", "drawVisionCone"],
  ["game.js", "retreatPauseSeconds"],
  ["game.js", "Wait 0.75s"],
  ["game.js", "oppositeThreatBias"],
  ["game.js", "chainReaction"],
  ["game.js", "threatStack"],
  ["game.js", "Collision affects path"],
  ["game.js", "controlsEnabled: false"],
  ["styles.css", "aspect-ratio"],
];

for (const file of requiredFiles) {
  const text = await readFile(new URL(file, import.meta.url), "utf8");
  if (!text.trim()) throw new Error(`${file} is empty`);
}

for (const [file, needle] of requiredStrings) {
  const text = await readFile(new URL(file, import.meta.url), "utf8");
  if (!text.includes(needle)) throw new Error(`${file} missing ${needle}`);
}

console.log("smoke-check passed: note.1-4 autoplay movement animation exists");

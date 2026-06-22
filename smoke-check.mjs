import { readFile } from "node:fs/promises";

const requiredFiles = ["index.html", "styles.css", "game.js"];
const requiredStrings = [
  ["index.html", "Sightline Scare Study"],
  ["index.html", "Autoplay diagram"],
  ["game.js", "autoplay-note1-animation"],
  ["game.js", "drawSightlines"],
  ["game.js", "drawVisionCone"],
  ["game.js", "threatStack"],
  ["game.js", "Scare triggers retreat"],
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

console.log("smoke-check passed: note.1 autoplay sightline animation exists");

import { readFile } from "node:fs/promises";

const requiredFiles = ["index.html", "styles.css", "game.js"];
const requiredStrings = [
  ["index.html", "gameCanvas"],
  ["index.html", "data-hold=\"p1\""],
  ["index.html", "data-hold=\"p2\""],
  ["game.js", "drawLogo"],
  ["game.js", "drawRuleCard"],
  ["game.js", "drawFlowCards"],
  ["game.js", "contextmenu"],
  ["game.js", "nearestLane"],
  ["game.js", "compressedTableRadius"],
  ["game.js", "Both hands reached the inner ring"],
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

console.log("smoke-check passed: diagram-first board remake files and hooks exist");

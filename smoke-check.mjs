import { readFile } from "node:fs/promises";

const requiredFiles = ["index.html", "styles.css", "game.js"];
const requiredStrings = [
  ["index.html", "gameCanvas"],
  ["index.html", "p1Score"],
  ["index.html", "p2Score"],
  ["index.html", "data-hold=\"p1\""],
  ["index.html", "data-hold=\"p2\""],
  ["game.js", "catchAnimal"],
  ["game.js", "scareDistance"],
  ["game.js", "contextmenu"],
  ["game.js", "nearestLane"],
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

console.log("smoke-check passed: static prototype files and key game hooks exist");

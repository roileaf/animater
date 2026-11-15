// Measures every bundled sound: sample peak, loudest 100 ms RMS (the props audit's match metric) and noise floor.
// Writes one JSON object per line as it goes, so a run that is stopped is still worth having.
import { execFile } from "node:child_process";
import { createWriteStream, readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.argv[2];
const OUT = process.argv[3];
const JOBS = Number(process.argv[4] || 6);
const SR = 44100;
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

const walk = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.toLowerCase().endsWith(".ogg")) out.push(p);
  }
  return out;
};

const decode = (abs) => new Promise((resolve) => {
  execFile("ffmpeg", ["-v", "quiet", "-i", abs, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"],
    { maxBuffer: 1 << 28, encoding: "buffer" },
    (err, stdout) => {
      if (err || !stdout?.length) return resolve(null);
      resolve(new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 4)));
    });
});

const measure = (s) => {
  let peak = 0;
  for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > peak) peak = a; }
  const win = Math.round(0.1 * SR), hop = Math.round(0.01 * SR);
  let best = 0;
  for (let st = 0; st + win <= s.length; st += hop) {
    let sum = 0;
    for (let i = st; i < st + win; i++) sum += s[i] * s[i];
    const r = Math.sqrt(sum / win);
    if (r > best) best = r;
  }
  if (!best && s.length) { let sum = 0; for (let i = 0; i < s.length; i++) sum += s[i] * s[i]; best = Math.sqrt(sum / s.length); }
  // noise floor: quietest 5% of 20 ms blocks
  const bw = Math.round(0.02 * SR), blocks = [];
  for (let st = 0; st + bw <= s.length; st += bw) {
    let sum = 0;
    for (let i = st; i < st + bw; i++) sum += s[i] * s[i];
    blocks.push(Math.sqrt(sum / bw));
  }
  blocks.sort((a, b) => a - b);
  const floor = blocks.length ? blocks[Math.max(0, Math.floor(blocks.length * 0.05) - 1)] : 0;
  // a clipped run: four samples at full scale in a row
  let run = 0, clipped = false;
  for (let i = 0; i < s.length; i++) { if (Math.abs(s[i]) >= 0.985) { if (++run >= 4) { clipped = true; break; } } else run = 0; }
  return { secs: s.length / SR, peak: db(peak), rms: db(best), floor: db(floor), clipped };
};

const files = (await walk(ROOT)).sort();
const done = new Set();
if (existsSync(OUT)) for (const l of readFileSync(OUT, "utf8").split("\n")) { if (!l.trim()) continue; try { done.add(JSON.parse(l).rel); } catch { /* half-written last line */ } }
const todo = files.filter((f) => !done.has(path.relative(ROOT, f).split(path.sep).join("/")));
console.log(`${files.length} files, ${done.size} already measured, ${todo.length} to go`);

const out = createWriteStream(OUT, { flags: "a" });
let n = 0;
const worker = async () => {
  for (;;) {
    const abs = todo.pop();
    if (!abs) return;
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    const s = await decode(abs);
    const row = s ? { rel, ...measure(s) } : { rel, error: true };
    out.write(JSON.stringify(row) + "\n");
    if (++n % 250 === 0) console.log(`${n} of ${todo.length + n}`);
  }
};
await Promise.all(Array.from({ length: JOBS }, worker));
out.end();
console.log("measured", n);

// Finds CC0 creature footsteps on Freesound for the gaits that have none of their own yet (paws, hooves, a dragon's
// tread on hard floors, a snake's slither), cuts each candidate recording into single footfalls, matches them to the
// bundled steps' loudness, and writes a local listening page to pick the keepers by ear. Nothing ships until --apply.
//
//   node tools/audition-creature-steps.mjs --key <Freesound API key>      search, cut, write the audition page
//   node tools/audition-creature-steps.mjs --apply <approved.json>        copy the approved cuts into the module
//
// The key is a free one from https://freesound.org/apiv2/apply (FREESOUND_API_KEY works too). Only the official API
// and its public previews are used. Output lives in .cache/creature-steps/ (never pushed); the page is
// .cache/creature-steps/audition.html. Needs ffmpeg on the PATH.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FOOTSTEP_FILES, GAIT_STEP_FILES } from '../scripts/engines/motion/movement-feel.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = path.join(root, '.cache', 'creature-steps');
const RAW = path.join(OUT, 'raw'), CUTS = path.join(OUT, 'audition');
const ASSETS = path.join(root, 'assets', 'sounds', 'surfaces', 'freesound');
const RATE = 44100;

// What each gait's feet sound like, per floor variant (movement-feel.mjs floorVariant: 'hard' stone, wood and ice;
// 'soft' dirt, grass, sand and snow; 'wet' mud and water; 'any' everywhere). Each query is searched among CC0 sounds
// only; `want` must appear in a candidate's name, tags or description, `avoid` must not (people's shoes, voices,
// music, loops, synths). `max` is the longest one footfall may ring (ms).
const HUMAN = 'shoe shoes boot boots heel heels sneaker sneakers human person man woman girl boy people high-heels';
const NOISE = 'music loop loops song beat synth synthesized 8bit 8-bit chiptune cartoon voice talking speech ambience ambiance atmosphere drone';
const FAMILIES = {
  paws: {
    label: 'Paws (wolves, dogs, cats, bears)', max: 380,
    avoid: `${HUMAN} ${NOISE} bark barking barks growl whine howl meow purr collar leash tags jingle`,
    variants: {
      hard: { label: 'stone, wood, ice: claws ticking', want: 'paw paws claw claws nails dog cat', queries: ['dog nails floor', 'dog claws wooden floor', 'dog paws tile', 'dog walking hardwood', 'dog footsteps floor', 'cat walking wood floor'] },
      soft: { label: 'dirt, grass, sand, snow: soft pads', want: 'paw paws dog cat wolf footsteps steps walking', queries: ['dog footsteps grass', 'dog walking dirt', 'dog paws snow', 'dog walking gravel path', 'paws footsteps', 'dog footsteps sand'] },
      wet: { label: 'mud, water: wet pads', want: 'paw paws dog footsteps walking', queries: ['dog walking mud', 'dog paws water', 'dog footsteps puddle', 'dog walking wet'] },
    },
  },
  hooves: {
    label: 'Hooves (horses, deer, goats, centaurs, minotaurs)', max: 480,
    avoid: `${HUMAN} ${NOISE} neigh neighing whinny snort snorting carriage cart wagon coconut bell bells saddle`,
    variants: {
      hard: { label: 'stone, wood, ice: a ringing clop', want: 'hoof hooves horse donkey pony goat', queries: ['horse hooves cobblestone', 'horse walking concrete', 'horse hooves stone', 'horse hoof asphalt', 'horse walking wooden bridge', 'goat hooves'] },
      soft: { label: 'dirt, grass, sand, snow: a dull thud', want: 'hoof hooves horse donkey pony', queries: ['horse hooves dirt', 'horse walking grass', 'horse walking sand', 'horse hooves snow', 'horse walking gravel', 'horse footsteps field'] },
      wet: { label: 'mud, water: a sucking squelch', want: 'hoof hooves horse', queries: ['horse hooves mud', 'horse walking mud', 'horse walking water', 'horse hooves puddle'] },
    },
  },
  dragon: {
    label: 'Dragon tread (dragons, drakes, lizards, crocodiles)', max: 900,
    avoid: `${HUMAN} ${NOISE} roar roaring growl scream laser robot mech`,
    variants: {
      hard: { label: 'stone, wood, ice: heavy clawed tread', want: 'monster creature giant dinosaur beast heavy claws footstep footsteps step stomp', queries: ['monster footsteps stone', 'monster footsteps concrete', 'giant footsteps', 'heavy creature footsteps', 'dinosaur footsteps', 'creature claws footsteps', 'beast footstep stomp'] },
    },
  },
  slither: {
    label: 'Slither (snakes, nagas, worms)', max: 1400,
    avoid: `${HUMAN} ${NOISE} hiss hissing rattle rattlesnake rope zipper plastic bag`,
    variants: {
      any: { label: 'everywhere: scales sliding', want: 'snake serpent slither slithering scales slide sliding reptile', queries: ['snake slither', 'snake slithering', 'snake moving', 'serpent slither', 'scales sliding', 'snake crawl sand'] },
    },
  },
};
const PER_QUERY = 15;        // results read per query
const RECORDINGS = 6;        // recordings auditioned per variant (the best by fit)
const CUTS_PER_RECORDING = 4; // footfalls cut from each

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => execFile(cmd, args, { maxBuffer: 1 << 28, windowsHide: true, ...opts },
  (e, out, err) => (e ? reject(new Error(`${cmd} ${args.slice(0, 4).join(' ')}: ${err || e.message}`)) : resolve(out))));
const decode = async (file) => {
  const out = await run('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { encoding: 'buffer' });
  return new Float32Array(out.buffer, out.byteOffset, Math.floor(out.byteLength / 4));
};
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
// Level per 5 ms window, in dB.
export function envelope(x, ms = 5) {
  const w = Math.round((RATE * ms) / 1000), out = [];
  for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += x[j] * x[j]; out.push(db(Math.sqrt(s / w))); }
  return out;
}
const percentile = (list, p) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
// The loudest 50 ms of a sound (dB RMS): how loud a footfall lands. The bundled steps are matched the same way.
export function punch(x) {
  const w = Math.round(RATE * 0.05); let best = 0, s = 0;
  for (let i = 0; i < x.length; i++) { s += x[i] * x[i]; if (i >= w) s -= x[i - w] * x[i - w]; if (i >= w - 1) best = Math.max(best, s / w); }
  return db(Math.sqrt(best || 0));
}

// Single footfalls in a recording: onsets that rise well above its noise floor, each cut from just before the onset to
// where it has died away (or the next one starts), never longer than `max`. Each gets a score: how far it stands out of
// the floor, how cleanly it starts and decays, and that it is not clipped.
export function footfalls(x, max) {
  const env = envelope(x), floor = percentile(env, 0.15), top = Math.max(...env);
  if (top - floor < 18) return [];
  const rise = Math.max(floor + 15, top - 30), out = [];
  let i = 1;
  while (i < env.length) {
    if (env[i] < rise || env[i - 1] >= rise) { i++; continue; }
    let start = i; while (start > 0 && env[start - 1] > floor + 6 && i - start < 6) start--;
    let peak = i; for (let k = i; k < Math.min(env.length, i + 20); k++) if (env[k] > env[peak]) peak = k;
    const quiet = Math.max(env[peak] - 32, floor + 5);
    let end = peak, below = 0;
    while (end < env.length - 1 && (end - start) * 5 < max) { end++; if (env[end] < quiet) { if (++below >= 8) break; } else below = 0; if (env[end] > env[peak] - 3 && end - peak > 24) break; }
    const ms = (end - start) * 5;
    const tail = env.slice(Math.min(end, env.length - 1), Math.min(env.length, end + 12));
    const clean = !tail.some((v) => v > env[peak] - 10);
    let clip = 0; for (let k = start * 220; k < Math.min(x.length, end * 220); k++) if (Math.abs(x[k]) > 0.995) clip++;
    if (ms >= 60) out.push({ startMs: Math.max(0, start * 5 - 10), ms: ms + 10, snr: env[peak] - floor, attackMs: (peak - start) * 5, clean, clip, score: (env[peak] - floor) + (clean ? 6 : -8) - (clip > 3 ? 20 : 0) - Math.max(0, (peak - start) * 5 - 40) / 4 });
    i = end + 20; // the next footfall starts at least 100 ms later
  }
  return out;
}

const words = (text) => new Set(String(text).toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean));
// How well a Freesound result fits a variant: what it says it is, what it must not be, and what its listeners thought.
function fit(sound, family, variant) {
  const text = words(`${sound.name} ${(sound.tags ?? []).join(' ')} ${sound.description ?? ''}`);
  const avoid = [...words(family.avoid)].filter((w) => text.has(w));
  if (avoid.length) return { score: -Infinity, why: `mentions ${avoid.slice(0, 3).join(', ')}` };
  const want = [...words(variant.want)].filter((w) => text.has(w));
  if (!want.length) return { score: -Infinity, why: 'says nothing of what it should be' };
  const score = want.length * 3 + (sound.avg_rating ?? 0) + Math.log10(1 + (sound.num_downloads ?? 0)) - Math.max(0, (sound.duration ?? 0) - 30) / 10;
  return { score, why: `fits: ${want.slice(0, 4).join(', ')}` };
}

async function search(key, query) {
  const url = new URL('https://freesound.org/apiv2/search/text/');
  url.search = new URLSearchParams({
    query, filter: 'license:"Creative Commons 0" duration:[0.3 TO 90]', page_size: String(PER_QUERY), sort: 'score',
    fields: 'id,name,username,license,duration,tags,description,avg_rating,num_downloads,previews,url',
  }).toString();
  const res = await fetch(url, { headers: { Authorization: `Token ${key}` } });
  if (res.status === 401) throw new Error('Freesound refused the API key (401). Get one at https://freesound.org/apiv2/apply');
  if (!res.ok) throw new Error(`Freesound search "${query}" failed: ${res.status} ${await res.text().catch(() => '')}`.trim());
  return (await res.json()).results ?? [];
}
async function download(sound) {
  const file = path.join(RAW, `${sound.id}.ogg`);
  if (fs.existsSync(file)) return file;
  const res = await fetch(sound.previews['preview-hq-ogg']);
  if (!res.ok) throw new Error(`preview ${sound.id}: ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// The bundled steps' median punch: every new footfall lands at the same level before the runtime scales it by weight.
export async function targetLevel() {
  const files = [...Object.values(FOOTSTEP_FILES).flat(), ...Object.values(GAIT_STEP_FILES).flatMap((f) => Object.values(f).flat())]
    .map((p) => path.join(root, p.replace(/^modules\/animater\//, ''))).filter((p) => fs.existsSync(p));
  const levels = [];
  for (const f of files) levels.push(punch(await decode(f)));
  return { level: percentile(levels, 0.5), from: levels.length };
}

// One footfall: trimmed, a 3 ms fade in and a fade over its last third, rumble below 40 Hz removed, matched to `level`
// and kept 1 dB under full scale; mono 44.1 kHz Vorbis like the bundled steps.
export async function cut(raw, fall, level, out) {
  const start = fall.startMs / 1000, len = fall.ms / 1000, fade = Math.max(0.02, len / 3);
  const tmp = `${out}.wav`;
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', String(len), '-i', raw, '-ac', '1', '-ar', String(RATE),
    '-af', `highpass=f=40,afade=t=in:d=0.003,afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade.toFixed(3)}`, tmp]);
  const x = await decode(tmp);
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(level - punch(x), -1 - db(peak));
  await run('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'libvorbis', '-q:a', '3', out]);
  fs.rmSync(tmp);
  return +gain.toFixed(1);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function page(groups, target) {
  const reference = (variant, family) => {
    const files = family === 'dragon' ? GAIT_STEP_FILES.dragon.soft : FOOTSTEP_FILES[{ hard: 'stone', soft: 'dirt', wet: 'mud', any: 'dirt' }[variant]];
    return (files ?? []).slice(0, 2).map((f) => `<audio controls preload="none" src="../../${esc(f.replace(/^modules\/animater\//, ''))}"></audio>`).join('');
  };
  const body = groups.map((g) => `
<section><h2>${esc(g.familyLabel)} <small>${esc(g.variantLabel)}</small></h2>
<p class="ref">For comparison, today's step here: ${reference(g.variant, g.family)}</p>
${g.recordings.length ? '' : '<p class="none">No CC0 recording fit. This variant keeps stepping as it does today.</p>'}
${g.recordings.map((r) => `<div class="rec"><h3><a href="${esc(r.url)}" target="_blank">${esc(r.name)}</a> by ${esc(r.username)} <small>${esc(r.why)} · rated ${(r.avg_rating ?? 0).toFixed(1)} · ${r.num_downloads ?? 0} downloads</small></h3>
<div class="cuts">${r.cuts.map((c) => `<label class="cut"><input type="checkbox" data-family="${g.family}" data-variant="${g.variant}" data-file="${esc(c.file)}" data-credit="${esc(c.credit)}">
<audio controls preload="none" src="audition/${esc(c.file)}"></audio><span>${c.ms} ms · ${c.snr} dB clear${c.clean ? '' : ' · runs on'}</span></label>`).join('')}</div></div>`).join('')}
</section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Creature steps audition</title>
<style>
:root{--bg:#f6f5f2;--fg:#1d1c1a;--muted:#6b6862;--card:#fff;--line:#dedbd4;--accent:#7a4bd1}
@media (prefers-color-scheme:dark){:root{--bg:#161514;--fg:#ecebe8;--muted:#a09c94;--card:#211f1d;--line:#36332f;--accent:#b49bff}}
body{background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px}
h1{font-size:22px}h2{font-size:18px;margin-top:32px;border-bottom:1px solid var(--line);padding-bottom:6px}h2 small,h3 small{color:var(--muted);font-weight:400}
h3{font-size:14px;margin:14px 0 6px}a{color:var(--accent)}.rec{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:8px 0}
.cuts{display:flex;flex-wrap:wrap;gap:10px}.cut{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}audio{height:32px;max-width:220px}
.ref,.none{color:var(--muted)}.bar{position:sticky;top:0;background:var(--bg);padding:10px 0;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
button{font:inherit;padding:6px 14px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
</style></head><body>
<h1>Creature steps audition</h1>
<p>Every cut is one footfall from a CC0 Freesound recording, levelled to the bundled steps (${target.level.toFixed(1)} dB, the median of ${target.from}). Tick the ones that sound right; a variant needs at least 3 (ideally from 2 or more recordings) or it keeps stepping as it does today. Then save the list and run <code>node tools/audition-creature-steps.mjs --apply approved.json</code>.</p>
<div class="bar"><button id="save">Save approved.json</button><span id="count">0 ticked</span></div>
${body}
<script>
const boxes=[...document.querySelectorAll('input[type=checkbox]')];
const pick=()=>boxes.filter(b=>b.checked).map(b=>({family:b.dataset.family,variant:b.dataset.variant,file:b.dataset.file,credit:b.dataset.credit}));
boxes.forEach(b=>b.addEventListener('change',()=>{document.getElementById('count').textContent=pick().length+' ticked'}));
document.getElementById('save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(pick(),null,2)],{type:'application/json'}));a.download='approved.json';a.click();};
</script></body></html>`;
}

async function audition(key) {
  fs.mkdirSync(RAW, { recursive: true });
  fs.rmSync(CUTS, { recursive: true, force: true }); fs.mkdirSync(CUTS, { recursive: true });
  const target = await targetLevel();
  console.log(`Bundled steps land at ${target.level.toFixed(1)} dB (median of ${target.from}).`);
  const groups = [];
  for (const [family, spec] of Object.entries(FAMILIES)) for (const [variant, v] of Object.entries(spec.variants)) {
    const seen = new Map();
    for (const q of v.queries) for (const s of await search(key, q)) if (!seen.has(s.id)) seen.set(s.id, { ...s, ...fit(s, spec, v) });
    const ranked = [...seen.values()].filter((s) => s.score > -Infinity && /Creative Commons 0|publicdomain\/zero/i.test(s.license)).sort((a, b) => b.score - a.score);
    const recordings = [];
    for (const s of ranked) {
      if (recordings.length >= RECORDINGS) break;
      try {
        const raw = await download(s);
        const falls = footfalls(await decode(raw), spec.max).filter((f) => f.clip <= 3).sort((a, b) => b.score - a.score).slice(0, CUTS_PER_RECORDING);
        if (falls.length < 2) { console.log(`  skip ${s.id} "${s.name}": fewer than 2 clean footfalls`); continue; }
        falls.sort((a, b) => a.startMs - b.startMs);
        const cuts = [];
        for (const [n, f] of falls.entries()) {
          const file = `${family}-step-${s.id}-${n}.ogg`;
          await cut(raw, f, target.level, path.join(CUTS, file));
          cuts.push({ file, ms: f.ms, snr: Math.round(f.snr), clean: f.clean, credit: `"${s.name}" by ${s.username}, https://freesound.org/people/${s.username}/sounds/${s.id}/` });
        }
        recordings.push({ ...s, cuts });
        console.log(`  ${family}/${variant}: ${s.id} "${s.name}" (${cuts.length} cuts; ${s.why})`);
      } catch (error) { console.log(`  skip ${s.id}: ${error.message}`); }
    }
    groups.push({ family, variant, familyLabel: spec.label, variantLabel: v.label, recordings });
  }
  fs.writeFileSync(path.join(OUT, 'audition.html'), page(groups, target));
  console.log(`\nOpen ${path.join(OUT, 'audition.html')} to listen and pick.`);
}

// Copies the approved cuts into the module's Freesound folder and credits each in its License.txt (kept sorted).
export function apply(listFile) {
  const picks = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  const license = path.join(ASSETS, 'License.txt');
  const [head, ...rest] = fs.readFileSync(license, 'utf8').split(/\n(?=\S+\.ogg: )/);
  const lines = new Map(rest.join('\n').split('\n').filter(Boolean).map((l) => [l.split(':')[0], l]));
  const byVariant = {};
  for (const p of picks) {
    if (!/^[a-z]+-step-\d+-\d+\.ogg$/.test(p.file)) throw new Error(`not an audition cut: ${p.file}`);
    fs.copyFileSync(path.join(CUTS, p.file), path.join(ASSETS, p.file));
    lines.set(p.file, `${p.file}: ${p.credit}`);
    (byVariant[`${p.family}.${p.variant}`] ??= []).push(p.file.replace(/\.ogg$/, ''));
  }
  fs.writeFileSync(license, `${head.trimEnd()}\n\n${[...lines.keys()].sort().map((k) => lines.get(k)).join('\n')}\n`);
  for (const [k, files] of Object.entries(byVariant)) console.log(`${k}: ${files.length} ${files.length < 3 ? '(fewer than 3: not used)' : ''}\n  ${files.join(', ')}`);
  console.log('\nCopied and credited. GAIT_STEP_FILES in scripts/engines/motion/movement-feel.mjs still has to list them.');
}

const applyFile = arg('--apply');
if (process.argv[1] && path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url)) { /* imported */ }
else if (applyFile) apply(applyFile);
else {
  const key = arg('--key', process.env.FREESOUND_API_KEY);
  if (!key) { console.error('Needs a Freesound API key: --key <key> or FREESOUND_API_KEY (free at https://freesound.org/apiv2/apply).'); process.exit(1); }
  await audition(key);
}

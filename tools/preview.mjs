import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseEntries } from "./asset-databases.mjs";
import { soundInventory } from './sound-databases.mjs';
import {tokenPresetMetadata} from '../scripts/optional-fx.mjs';
import {PRESETS} from '../scripts/fx/presets.mjs';
let soundLibrary;
const modulesRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const foundryPublic =
  "C:/Program Files/Foundry Virtual Tabletop/resources/app/public";
// animater's own token FX presets (the design preview lists them by name).
const tokenPresets=PRESETS.map(p=>tokenPresetMetadata(p));
let catalog = [];
for (const [id, file, fn, dbName, label] of [
  [
    "jb2a_patreon",
    "jb2a_sequencer.js",
    "jb2aPatreonDatabase",
    "patreonDatabase",
    "JB2A Patreon",
  ],
  [
    "JB2A_DnD5e",
    "jb2a_sequencer.js",
    "jb2aFreeDatabase",
    "freeDatabase",
    "JB2A Free",
  ],
]) {
  const source = resolve(modulesRoot, id, "scripts", file);
  if (!existsSync(source)) continue;
  const entries = await databaseEntries(
    await readFile(source, "utf8"),
    fn,
    dbName,
  );
  catalog.push(
    ...entries.map((entry) => ({
      ...entry,
      name: entry.key.slice(5).replaceAll("_", " ").replaceAll(".", " · "),
      file: "/" + entry.file,
      pack: label,
    })),
  );
  if (catalog.length) break;
}
catalog.sort((a, b) => a.key.localeCompare(b.key));
const mime = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if(url.pathname==='/preview-pixi.mjs') {
      const path=resolve(foundryPublic,'../node_modules/pixi.js/dist/pixi.mjs');
      res.writeHead(200,{'Content-Type':'text/javascript'});createReadStream(path).pipe(res);return;
    }
    if(url.pathname==='/preview-token-fx') {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({tokenReady:tokenPresets.length>0,sceneReady:false,presets:tokenPresets,effects:[]}));
      return;
    }
    if(url.pathname==='/preview-media-catalog') {
      soundLibrary ??= soundInventory();
      const sounds=await soundLibrary;
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({entries:[...catalog,...sounds.entries.map(entry=>({...entry,type:'audio',source:entry.title}))]}));
      return;
    }
    if (url.pathname === "/preview-catalog") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(catalog));
      return;
    }
    if (url.pathname === "/") {
      res.writeHead(302, { Location: "/modules/animater/preview/index.html" });
      res.end();
      return;
    }
    if (
      !url.pathname.startsWith("/modules/") &&
      !url.pathname.startsWith("/systems/pf2e/icons/") &&
      !url.pathname.startsWith("/systems/sf2e/icons/") &&
      !url.pathname.startsWith("/icons/") &&
      !url.pathname.startsWith("/foundry/")
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    const core =
      url.pathname.startsWith("/foundry/") ||
      url.pathname.startsWith("/icons/");
    const systemId = url.pathname.startsWith('/systems/sf2e/icons/')?'sf2e':'pf2e';
    const system = url.pathname.startsWith(`/systems/${systemId}/icons/`);
    const path = resolve(
      core
        ? foundryPublic
        : system
          ? resolve(modulesRoot, `../systems/${systemId}/icons`)
          : modulesRoot,
      decodeURIComponent(
        system
          ? url.pathname.slice(`/systems/${systemId}/icons/`.length)
          : url.pathname.startsWith("/icons/")
            ? url.pathname.slice(1)
            : url.pathname.slice(9),
      ),
    );
    // Serve only this module and installed JB2A assets, bound to loopback.
    const allowed = system
      ? path.startsWith(resolve(modulesRoot, `../systems/${systemId}/icons`) + sep)
      : core
        ? ["css", "fonts", "icons"].some((id) =>
            path.startsWith(resolve(foundryPublic, id) + sep),
          )
        : [
            "animater",
            "jb2a_patreon",
            "JB2A_DnD5e",
            "ggg",
            "psfx",
            "soundfxlibrary",
            "pf2e-creature-sounds",
            // Sample token art for the FX gallery (tools/fx-gallery/index.html?art=…).
            "pf2e-tokens-myth-and-magic",
          ].some((id) => path.startsWith(resolve(modulesRoot, id) + sep));
    if (!allowed) {
      res.writeHead(403);
      res.end();
      return;
    }
    const info = await stat(path);
    if (!info.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    let start = 0,
      end = info.size - 1;
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!m) {
        res.writeHead(416);
        res.end();
        return;
      }
      start = Number(m[1]);
      if (m[2]) end = Math.min(end, Number(m[2]));
      if (start > end) {
        res.writeHead(416);
        res.end();
        return;
      }
    }
    const headers = {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Cache-Control": "no-store",
    };
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === "HEAD") res.end();
    else createReadStream(path, { start, end }).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(Number(process.argv[2] ?? 4174), "127.0.0.1", () =>
  console.log(
    `Animater preview: http://127.0.0.1:${process.argv[2] ?? 4174} (${catalog.length} real JB2A variants)`,
  ),
);

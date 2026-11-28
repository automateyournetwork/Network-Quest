// SPDX-License-Identifier: Apache-2.0
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, realpath, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

const repository = "https://github.com/automateyournetwork/Network-Quest";
const indexFile = new URL("../assets-src/source-index.json", import.meta.url);
const help = `Usage: node tools/fetch-sources.mjs [--verify | --audit | --list] [--dir DIRECTORY] [--path EXACT_PATH ...]
Default: retrieve missing files into an existing directory (default: current directory).
--verify  Check existing files offline.    --audit  Read and hash public bytes without saving.
--list    Print SHA-256, bytes and path.    --path   Select one or more paths; default: all.
`;

const sourceDirectories = new Set(["audio", "characters", "feasibility", "images", "integration", "props", "rooms", "sprites"]);
const sourceExtensions = new Set(["aiff", "aup3", "aup4", "blend", "flac", "glb", "html", "json",
  "md", "mjs", "mp3", "ogg", "png", "py", "swift", "txt", "wav"]);
const sourceDocuments = new Set(["NOTICE", "LICENSE", "LICENSE-ASSETS", "assets-src/manifest.json",
  "assets-src/art-direction.md", "assets-src/production-allocation.json"]);
const privateName = /^(?:private(?:-data)?|secrets?|credentials?|operator(?:-records)?|sessions?|player-data|backups?)(?:\.|$)/i;
const reservedDevice = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

function publicSourcePath(path) {
  if (typeof path !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(path)) return false;
  const parts = path.split("/");
  if (parts.some(part => !part || part.startsWith(".") || part.endsWith(".") ||
      privateName.test(part) || reservedDevice.test(part))) return false;
  if (sourceDocuments.has(path)) return true;
  if (parts[0] === "assets-src" && sourceDirectories.has(parts[1]) && parts.length >= 3) {
    return sourceExtensions.has(parts.at(-1).split(".").at(-1));
  }
  return /^docs\/evidence\/spec001\/(?:assets|layouts-t106|presentation|prop-production)\/.+\.(?:png|py)$/.test(path) ||
    /^content\/spec001\/presentation\/R\d{2}\.json$/.test(path);
}

function validateIndex(index) {
  if (index.schemaVersion !== 1 || index.repository !== repository || typeof index.revision !== "string" ||
      !/^[0-9a-f]{40}$/.test(index.revision) || !Array.isArray(index.files) || !index.files.length) {
    throw Error("Invalid source index or repository revision");
  }
  const names = new Map();
  for (const { path, sha256, bytes } of index.files) {
    if (!publicSourcePath(path) || typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256) ||
        !Number.isSafeInteger(bytes) || bytes < 0) throw Error(`Invalid source index entry: ${path}`);
    let current = "";
    const parts = path.split("/");
    for (const [i, part] of parts.entries()) {
      current = current ? current + "/" + part : part;
      const key = current.toLowerCase();
      const directory = i < parts.length - 1;
      const previous = names.get(key);
      if (previous && (!directory || !previous.directory || previous.path !== current)) {
        throw Error(`Colliding source index path: ${current}`);
      }
      names.set(key, { path: current, directory });
    }
  }
}

// Resolve only real directories below the user-selected destination. Concurrent creators
// may make the same directory. Never follow a symlink in an indexed path.
async function sourceTarget(root, path, create) {
  let parent = root;
  const parts = path.split("/");
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part);
    if (create) {
      await mkdir(parent).catch(error => { if (error.code !== "EEXIST") throw error; });
    }
    if (!(await lstat(parent)).isDirectory()) throw Error(`Directory required: ${parent}`);
  }
  return join(parent, parts.at(-1));
}

async function digestStream(source, file, destination, signal) {
  const digest = createHash("sha256");
  let bytes = 0;
  const check = new Transform({
    transform(chunk, encoding, done) {
      bytes += chunk.length;
      if (bytes > file.bytes) return done(Error(`Oversized source: ${file.path}`));
      digest.update(chunk);
      done(null, chunk);
    },
  });
  const sink = destination ?? new Writable({ write(chunk, encoding, done) { done(); } });
  await pipeline(source, check, sink, { signal });
  if (bytes !== file.bytes || digest.digest("hex") !== file.sha256) {
    throw Error(`Source size or SHA-256 mismatch: ${file.path}`);
  }
}

async function verifiedExisting(target, file, signal) {
  const entry = await lstat(target).catch(error => { if (error.code !== "ENOENT") throw error; });
  if (!entry) return false;
  if (!entry.isFile() || entry.size !== file.bytes) throw Error(`Existing file differs: ${file.path}`);
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== entry.dev || stat.ino !== entry.ino) {
      throw Error(`Existing file changed during verification: ${file.path}`);
    }
    await digestStream(handle.createReadStream(), file, null, signal);
    return true;
  } finally {
    await handle.close();
  }
}

async function download(revision, file, target, signal) {
  const url = `https://raw.githubusercontent.com/automateyournetwork/Network-Quest/${revision}/${file.path}`;
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(180_000)]);
  let temporary, handle;
  try {
    const response = await fetch(url, { signal: requestSignal, redirect: "error", credentials: "omit" });
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel();
      const error = Error(`HTTP ${response.status}: ${url}`);
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }
    if (target) {
      const name = join(dirname(target), ".nq-source-" + randomUUID() + ".partial");
      handle = await open(name, "wx", 0o600);
      temporary = name;
    }
    await digestStream(Readable.fromWeb(response.body), file, handle?.createWriteStream(), requestSignal);
    if (!target) return "audited";
    // A hard link publishes an entirely verified regular file only if the destination is absent.
    try {
      await link(temporary, target);
    } catch (error) {
      if (error.code !== "EEXIST" || !await verifiedExisting(target, file, signal)) throw error;
      return "reused";
    }
    return "downloaded";
  } finally {
    await handle?.close();
    if (temporary) await unlink(temporary);
  }
}

async function processFile(mode, revision, file, root, signal) {
  const target = mode === "audit" ? null : await sourceTarget(root, file.path, mode === "fetch");
  if (target && await verifiedExisting(target, file, signal)) return "reused";
  if (mode === "verify") throw Error(`Source is missing: ${file.path}`);
  for (let attempt = 1; ; attempt++) {
    try {
      return await download(revision, file, target, signal);
    } catch (error) {
      const transient = error.retryable || error instanceof TypeError || error.name === "TimeoutError";
      if (!transient || signal.aborted || attempt >= 3) throw error;
      await delay(1000 * 2 ** (attempt - 1), undefined, { signal });
    }
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: "boolean" }, list: { type: "boolean" }, audit: { type: "boolean" },
    verify: { type: "boolean" }, dir: { type: "string" }, path: { type: "string", multiple: true },
  } });
  if (values.help) return process.stdout.write(help);
  const modes = ["list", "audit", "verify"].filter(key => values[key]);
  if (modes.length > 1) throw Error("Choose one action");
  const mode = modes[0] ?? "fetch";
  const index = JSON.parse(await readFile(indexFile, "utf8"));
  validateIndex(index);
  const wanted = new Set(values.path);
  const files = wanted.size ? index.files.filter(file => wanted.has(file.path)) : index.files;
  if (wanted.size && files.length !== wanted.size) {
    const present = new Set(files.map(file => file.path));
    throw Error("Unknown source path: " + [...wanted].filter(path => !present.has(path)).join(", "));
  }
  if (mode === "list") {
    for (const file of files) console.log(`${file.sha256}  ${file.bytes}  ${file.path}`);
    return;
  }
  let root;
  if (mode !== "audit") {
    const selected = resolve(values.dir ?? ".");
    if (!(await lstat(selected)).isDirectory()) throw Error(`Choose an existing directory: ${selected}`);
    root = await realpath(selected);
  }
  const counts = { downloaded: 0, reused: 0, audited: 0 };
  let cursor = 0;
  const controller = new AbortController();
  const interrupt = () => controller.abort(Error("Source retrieval interrupted"));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  async function worker() {
    while (!controller.signal.aborted && cursor < files.length) {
      const file = files[cursor++];
      try {
        const result = await processFile(mode, index.revision, file, root, controller.signal);
        counts[result]++;
      } catch (error) {
        if (!controller.signal.aborted) controller.abort(Error(`${file.path}: ${error.message}`));
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(6, files.length) }, worker));
    controller.signal.throwIfAborted();
    console.log(JSON.stringify({ revision: index.revision, mode, files: files.length,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0), ...counts }));
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

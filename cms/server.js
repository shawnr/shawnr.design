#!/usr/bin/env node
/**
 * shawnr.design CMS — local companion server
 * No npm install required. Pure Node built-ins only.
 * Usage: node server.js
 */

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { execSync } = require("child_process");

const SITECONFIG_PATH = path.join(__dirname, "..", ".siteconfig");
const PORT = 3000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseSiteconfig(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

function loadConfig() {
  const env = parseSiteconfig(SITECONFIG_PATH);
  const hugoContentDir = path.join(__dirname, "..", "content", "projects");
  return {
    hugoContentDir,
    mediaDir:     env.MEDIA_DIR     || path.join(require("os").homedir(), "media", "shawnrdesign"),
    mediaBaseUrl: env.MEDIA_BASE_URL || "https://shawnr.design/media",
    rsync: {
      media: {
        src:  (env.MEDIA_DIR || "") + "/",
        dest: (env.IONOS_HOST && env.IONOS_MEDIA_PATH) ? `${env.IONOS_HOST}:${env.IONOS_MEDIA_PATH}/` : "",
      },
    },
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function err(res, msg, status = 500) {
  json(res, { error: msg }, status);
}

// Parse multipart/form-data boundary
function parseMultipart(buffer, boundary) {
  const sep = Buffer.from("--" + boundary);
  const parts = [];
  let start = 0;

  while (start < buffer.length) {
    const sepIdx = buffer.indexOf(sep, start);
    if (sepIdx === -1) break;
    const afterSep = sepIdx + sep.length;
    if (buffer[afterSep] === 45 && buffer[afterSep + 1] === 45) break; // --boundary--

    // skip \r\n after boundary
    const headerStart = afterSep + 2;
    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(headerStart, headerEnd).toString("utf8");
    const dataStart = headerEnd + 4;
    const nextSep = buffer.indexOf(sep, dataStart);
    const dataEnd = nextSep === -1 ? buffer.length : nextSep - 2; // strip trailing \r\n

    const data = buffer.slice(dataStart, dataEnd);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      contentType: ctMatch ? ctMatch[1].trim() : "application/octet-stream",
      data,
    });

    start = nextSep === -1 ? buffer.length : nextSep;
  }
  return parts;
}

// Parse YAML-ish frontmatter (simple key: value, lists)
function parseFrontmatter(raw) {
  const lines = raw.split("\n");
  const result = {};
  let i = 0;
  let currentKey = null;
  let inList = false;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("  - ") && inList) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(line.slice(4).trim().replace(/^["']|["']$/g, ""));
    } else if (line.startsWith("- ") && inList) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(line.slice(2).trim().replace(/^["']|["']$/g, ""));
    } else {
      const m = line.match(/^(\w+):\s*(.*)/);
      if (m) {
        currentKey = m[1];
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        if (val === "") {
          result[currentKey] = [];
          inList = true;
        } else if (val.startsWith("[")) {
          result[currentKey] = val
            .replace(/^\[|\]$/g, "")
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""));
          inList = false;
        } else {
          result[currentKey] = val;
          inList = false;
        }
      }
    }
    i++;
  }
  return result;
}

function readMarkdownFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  return {
    frontmatter: parseFrontmatter(match[1]),
    body: match[2].trim(),
  };
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function handleGetConfig(res) {
  try {
    const cfg = loadConfig();
    json(res, cfg);
  } catch (e) {
    err(res, "Could not read config.json: " + e.message);
  }
}

async function handleGetProjects(res) {
  try {
    const cfg = loadConfig();
    const dir = cfg.hugoContentDir;
    const entries = await fsp.readdir(dir);
    const projects = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = await fsp.stat(fullPath);
      if (stat.isFile() && entry.endsWith(".md")) {
        try {
          const { frontmatter, body } = readMarkdownFile(fullPath);
          projects.push({ filename: entry, frontmatter, body });
        } catch (e) {
          // skip unparseable files
        }
      }
    }

    // Sort by date descending
    projects.sort((a, b) => {
      const da = a.frontmatter.date || "";
      const db = b.frontmatter.date || "";
      return db.localeCompare(da);
    });

    json(res, projects);
  } catch (e) {
    err(res, "Could not read projects: " + e.message);
  }
}

async function handleSaveProject(req, res) {
  try {
    const cfg = loadConfig();
    const body = await parseBody(req);
    const data = JSON.parse(body.toString("utf8"));

    const { slug, frontmatter, projectBody } = data;
    if (!slug) return err(res, "slug is required", 400);

    // Build frontmatter YAML
    const fm = { ...frontmatter };
    let yaml = "---\n";
    for (const [k, v] of Object.entries(fm)) {
      if (Array.isArray(v)) {
        if (v.length === 0) {
          yaml += `${k}: []\n`;
        } else if (k === "media") {
          yaml += `${k}:\n`;
          for (const item of v) {
            yaml += `  - file: ${item.file}\n`;
            yaml += `    type: ${item.type}\n`;
            if (item.caption) yaml += `    caption: "${item.caption}"\n`;
          }
        } else {
          yaml += `${k}: [${v.map((s) => `"${s}"`).join(", ")}]\n`;
        }
      } else {
        yaml += `${k}: ${v}\n`;
      }
    }
    yaml += "---\n\n";
    yaml += (projectBody || "").trim() + "\n";

    const filePath = path.join(cfg.hugoContentDir, `${slug}.md`);
    await fsp.writeFile(filePath, yaml, "utf8");

    json(res, { ok: true, path: filePath });
  } catch (e) {
    err(res, "Could not save project: " + e.message);
  }
}

async function handleUploadMedia(req, res) {
  try {
    const cfg = loadConfig();
    const ct = req.headers["content-type"] || "";
    const boundaryMatch = ct.match(/boundary=(.+)/);
    if (!boundaryMatch) return err(res, "No multipart boundary", 400);

    const buffer = await parseBody(req);
    const parts = parseMultipart(buffer, boundaryMatch[1]);

    let slug = null;
    const savedFiles = [];

    // First pass: get slug
    for (const p of parts) {
      if (p.name === "slug" && !p.filename) {
        slug = p.data.toString("utf8").trim();
      }
    }
    if (!slug) return err(res, "slug field required in multipart", 400);

    const destDir = path.join(cfg.mediaDir, slug);
    await fsp.mkdir(destDir, { recursive: true });

    // Second pass: save files
    for (const p of parts) {
      if (p.filename && p.name === "files") {
        const safeName = p.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const destPath = path.join(destDir, safeName);
        await fsp.writeFile(destPath, p.data);
        savedFiles.push(safeName);
      }
    }

    json(res, { ok: true, saved: savedFiles, dir: destDir });
  } catch (e) {
    err(res, "Upload failed: " + e.message);
  }
}

async function handleListMedia(req, res) {
  try {
    const cfg = loadConfig();
    const url = new URL("http://x" + req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) return err(res, "slug param required", 400);

    const dir = path.join(cfg.mediaDir, slug);
    let files = [];
    try {
      const entries = await fsp.readdir(dir);
      files = entries.filter((f) => !f.startsWith("."));
    } catch (_) {
      // dir doesn't exist yet, return empty
    }
    json(res, { files });
  } catch (e) {
    err(res, "Could not list media: " + e.message);
  }
}

async function handleDeleteMedia(req, res) {
  try {
    const cfg = loadConfig();
    const body = await parseBody(req);
    const { slug, filename } = JSON.parse(body.toString("utf8"));
    if (!slug || !filename) return err(res, "slug and filename required", 400);

    // Safety: no path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(cfg.mediaDir, slug, safeName);
    await fsp.unlink(filePath);
    json(res, { ok: true });
  } catch (e) {
    err(res, "Delete failed: " + e.message);
  }
}

async function handleSync(req, res) {
  try {
    const cfg = loadConfig();
    const results = {};

    for (const [target, syncCfg] of Object.entries(cfg.rsync)) {
      try {
        const cmd = `rsync -avz --progress "${syncCfg.src}" "${syncCfg.dest}"`;
        const output = execSync(cmd, { encoding: "utf8", timeout: 120000 });
        results[target] = { ok: true, output };
      } catch (e) {
        results[target] = { ok: false, error: e.message };
      }
    }

    json(res, results);
  } catch (e) {
    err(res, "Sync failed: " + e.message);
  }
}

async function handleDeleteProject(req, res) {
  try {
    const cfg = loadConfig();
    const body = await parseBody(req);
    const { slug } = JSON.parse(body.toString("utf8"));
    if (!slug) return err(res, "slug required", 400);

    const filePath = path.join(cfg.hugoContentDir, `${slug}.md`);
    await fsp.unlink(filePath);
    json(res, { ok: true });
  } catch (e) {
    err(res, "Delete failed: " + e.message);
  }
}

// ─── Static file serving (for index.html, app.js, style.css) ───────────────

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function serveStatic(req, res) {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, filePath);
  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
    });
    res.end(data);
  } catch (_) {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }

  const url = req.url.split("?")[0];

  if (url === "/api/config" && req.method === "GET") return handleGetConfig(res);
  if (url === "/api/projects" && req.method === "GET") return handleGetProjects(res);
  if (url === "/api/project" && req.method === "POST") return handleSaveProject(req, res);
  if (url === "/api/project" && req.method === "DELETE") return handleDeleteProject(req, res);
  if (url === "/api/media" && req.method === "POST") return handleUploadMedia(req, res);
  if (url === "/api/media" && req.method === "GET") return handleListMedia(req, res);
  if (url === "/api/media" && req.method === "DELETE") return handleDeleteMedia(req, res);
  if (url === "/api/sync" && req.method === "POST") return handleSync(req, res);

  return serveStatic(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  shawnr.design CMS running at http://localhost:${PORT}\n`);
});

/**
 * shawnr.design CMS — SPA frontend
 * Communicates with server.js on localhost:3000
 */

const API = "http://localhost:3000/api";

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  config: null,
  projects: [],
  currentView: "projects",
  editingSlug: null,       // null = new project
  uploadQueue: [],         // { file, name, status }
  diskMedia: [],           // filenames currently on disk for this slug
  mediaOrder: [],          // [{ file, type, caption }]
  techniques: [],
  materials: [],
  tags: [],
  dragSrc: null,
};

// ─── DOM refs ────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const dom = {
  statusMsg:      $("status-msg"),
  projectList:    $("project-list"),
  projectCount:   $("project-count"),
  formHeading:    $("form-heading"),
  cancelEditBtn:  $("cancel-edit-btn"),
  fTitle:         $("f-title"),
  fDate:          $("f-date"),
  fSlug:          $("f-slug"),
  fCategory:      $("f-category"),
  fCover:         $("f-cover"),
  fBody:          $("f-body"),
  fDraft:         $("f-draft"),
  dropZone:       $("drop-zone"),
  fileInput:      $("file-input"),
  uploadQueue:    $("upload-queue"),
  mediaListHdr:   $("media-list-header"),
  mediaList:      $("media-list"),
  mediaOrderSec:  $("media-order-section"),
  mediaOrderList: $("media-order-list"),
  mediaSlugNote:  $("media-slug-note"),
  saveBtn:        $("save-btn"),
  syncOverlay:    $("sync-overlay"),
  syncTargets:    $("sync-targets"),
  syncLog:        $("sync-log"),
  syncRunBtn:     $("sync-run-btn"),
  syncCloseBtn:   $("sync-close-btn"),
  syncBtn:        $("sync-btn"),
};

// ─── Status ──────────────────────────────────────────────────────────────────

function setStatus(msg, type = "") {
  dom.statusMsg.textContent = msg;
  dom.statusMsg.className = type;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn[data-view]").forEach((b) => b.classList.remove("active"));
  const section = document.getElementById(`view-${name}`);
  if (section) section.classList.add("active");
  const navBtn = document.querySelector(`.nav-btn[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add("active");
  state.currentView = name;
}

document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.view === "new") {
      clearForm();
      dom.formHeading.textContent = "New Project";
      dom.cancelEditBtn.style.display = "none";
      state.editingSlug = null;
    }
    showView(btn.dataset.view);
  });
});

// ─── Tag system ──────────────────────────────────────────────────────────────

function renderTags(field) {
  const container = $(`${field}-tags`);
  container.innerHTML = "";
  state[field].forEach((tag, i) => {
    const pill = document.createElement("div");
    pill.className = "tag-pill";
    pill.innerHTML = `<span>${tag}</span><button type="button" data-i="${i}" data-field="${field}">×</button>`;
    container.appendChild(pill);
  });
}

function addTag(field, value) {
  const v = value.trim().toLowerCase();
  if (!v || state[field].includes(v)) return;
  state[field].push(v);
  renderTags(field);
}

function removeTag(field, i) {
  state[field].splice(i, 1);
  renderTags(field);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-field][data-i]");
  if (btn) removeTag(btn.dataset.field, parseInt(btn.dataset.i));
});

["techniques", "materials", "tags"].forEach((field) => {
  const input = $(`${field}-input`);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(field, input.value);
      input.value = "";
    }
    if (e.key === "Backspace" && !input.value && state[field].length) {
      removeTag(field, state[field].length - 1);
    }
  });
});

document.querySelectorAll(".qtag").forEach((btn) => {
  btn.addEventListener("click", () => addTag(btn.dataset.field, btn.textContent));
});

// ─── Slug generation ─────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

let slugLocked = false;
dom.fTitle.addEventListener("input", () => {
  if (!slugLocked) dom.fSlug.value = slugify(dom.fTitle.value);
});
dom.fSlug.addEventListener("input", () => {
  slugLocked = dom.fSlug.value !== "";
});

// ─── Form clear / populate ───────────────────────────────────────────────────

function clearForm() {
  dom.fTitle.value = "";
  dom.fDate.value = new Date().toISOString().split("T")[0];
  dom.fSlug.value = "";
  dom.fCategory.value = "";
  dom.fCover.value = "";
  dom.fBody.value = "";
  dom.fDraft.checked = false;
  slugLocked = false;
  state.techniques = [];
  state.materials = [];
  state.tags = [];
  state.uploadQueue = [];
  state.diskMedia = [];
  state.mediaOrder = [];
  renderTags("techniques");
  renderTags("materials");
  renderTags("tags");
  dom.uploadQueue.innerHTML = "";
  dom.mediaList.innerHTML = "";
  dom.mediaListHdr.style.display = "none";
  dom.mediaOrderSec.style.display = "none";
  dom.mediaOrderList.innerHTML = "";
  dom.mediaSlugNote.textContent = "";
}

function populateForm(project) {
  const fm = project.frontmatter;
  dom.fTitle.value = fm.title || "";
  dom.fDate.value = fm.date || "";
  dom.fSlug.value = project.filename.replace(".md", "");
  dom.fCategory.value = fm.category || "";
  dom.fCover.value = fm.cover || "";
  dom.fBody.value = project.body || "";
  dom.fDraft.checked = fm.draft === "true" || fm.draft === true;
  slugLocked = true;

  state.techniques = Array.isArray(fm.techniques) ? [...fm.techniques] : [];
  state.materials  = Array.isArray(fm.materials)  ? [...fm.materials]  : [];
  state.tags       = Array.isArray(fm.tags)        ? [...fm.tags]       : [];

  renderTags("techniques");
  renderTags("materials");
  renderTags("tags");

  // Load media order from frontmatter
  state.mediaOrder = Array.isArray(fm.media) ? fm.media.map((m) => ({ ...m })) : [];
  state.uploadQueue = [];
  dom.uploadQueue.innerHTML = "";

  loadDiskMedia(dom.fSlug.value);
}

// ─── Projects List ───────────────────────────────────────────────────────────

async function loadProjects() {
  setStatus("loading projects…", "busy");
  try {
    const res = await fetch(`${API}/projects`);
    state.projects = await res.json();
    renderProjectList();
    setStatus(`${state.projects.length} projects loaded`, "ok");
  } catch (e) {
    setStatus("could not connect to server — is server.js running?", "fail");
    dom.projectList.innerHTML = `<div class="loading-state">⚠ Cannot reach localhost:3000. Run: <code>node server.js</code></div>`;
  }
}

function renderProjectList() {
  dom.projectCount.textContent = state.projects.length;
  if (!state.projects.length) {
    dom.projectList.innerHTML = `<div class="loading-state">no projects yet — create one!</div>`;
    return;
  }

  dom.projectList.innerHTML = "";
  for (const p of state.projects) {
    const fm = p.frontmatter;
    const row = document.createElement("div");
    row.className = "project-row";

    const techChips = (fm.techniques || []).map((t) => `<span class="tag-chip technique">${t}</span>`).join("");
    const matChips  = (fm.materials  || []).map((m) => `<span class="tag-chip material">${m}</span>`).join("");
    const draft     = (fm.draft === "true" || fm.draft === true) ? `<span class="proj-draft-badge">DRAFT</span>` : "";

    row.innerHTML = `
      <span class="proj-date">${fm.date || "—"}</span>
      <span class="proj-title">${fm.title || p.filename}</span>
      <div class="proj-tags">${techChips}${matChips}${draft}</div>
      <div class="proj-actions">
        <button class="proj-edit-btn" data-slug="${p.filename.replace(".md","")}">edit</button>
        <button class="proj-del-btn"  data-slug="${p.filename.replace(".md","")}">del</button>
      </div>
    `;
    dom.projectList.appendChild(row);
  }
}

dom.projectList.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".proj-edit-btn");
  const delBtn  = e.target.closest(".proj-del-btn");

  if (editBtn) {
    const slug = editBtn.dataset.slug;
    const project = state.projects.find((p) => p.filename === `${slug}.md`);
    if (!project) return;
    clearForm();
    populateForm(project);
    state.editingSlug = slug;
    dom.formHeading.textContent = "Edit Project";
    dom.cancelEditBtn.style.display = "";
    showView("new");
  }

  if (delBtn) {
    const slug = delBtn.dataset.slug;
    if (!confirm(`Delete project "${slug}"? This only removes the .md file.`)) return;
    deleteProject(slug);
  }
});

dom.cancelEditBtn.addEventListener("click", () => {
  clearForm();
  state.editingSlug = null;
  showView("projects");
  loadProjects();
});

async function deleteProject(slug) {
  setStatus(`deleting ${slug}…`, "busy");
  try {
    await fetch(`${API}/project`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setStatus(`deleted ${slug}`, "ok");
    loadProjects();
  } catch (e) {
    setStatus("delete failed: " + e.message, "fail");
  }
}

// ─── Media: disk loading ──────────────────────────────────────────────────────

async function loadDiskMedia(slug) {
  if (!slug) return;
  dom.mediaSlugNote.textContent = `slug: ${slug}`;
  try {
    const res = await fetch(`${API}/media?slug=${encodeURIComponent(slug)}`);
    const data = await res.json();
    state.diskMedia = data.files || [];
    renderDiskMedia();
    syncMediaOrder();
  } catch (_) {
    state.diskMedia = [];
  }
}

function renderDiskMedia() {
  if (!state.diskMedia.length) {
    dom.mediaListHdr.style.display = "none";
    dom.mediaList.innerHTML = "";
    return;
  }

  dom.mediaListHdr.style.display = "";
  dom.mediaList.innerHTML = "";

  for (const filename of state.diskMedia) {
    const ext = filename.split(".").pop().toLowerCase();
    const isVideo = ["mp4", "mov", "webm"].includes(ext);
    const row = document.createElement("div");
    row.className = "media-item";
    row.innerHTML = `
      <span class="mi-name">${filename}</span>
      <span class="mi-type">${isVideo ? "▶ video" : "◻ image"}</span>
      <button class="mi-del-btn" title="delete from disk" data-file="${filename}">✕</button>
    `;
    dom.mediaList.appendChild(row);
  }
}

dom.mediaList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".mi-del-btn");
  if (!btn) return;
  const slug = dom.fSlug.value;
  const filename = btn.dataset.file;
  if (!confirm(`Delete ${filename} from disk?`)) return;
  try {
    await fetch(`${API}/media`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, filename }),
    });
    await loadDiskMedia(slug);
  } catch (e) {
    setStatus("delete failed: " + e.message, "fail");
  }
});

// Keep media order list in sync with disk files
function syncMediaOrder() {
  // Add new disk files not already in order
  for (const filename of state.diskMedia) {
    if (!state.mediaOrder.find((m) => m.file === filename)) {
      const ext = filename.split(".").pop().toLowerCase();
      const isVideo = ["mp4", "mov", "webm"].includes(ext);
      state.mediaOrder.push({ file: filename, type: isVideo ? "video" : "image", caption: "" });
    }
  }
  // Remove order entries for files no longer on disk
  state.mediaOrder = state.mediaOrder.filter((m) => state.diskMedia.includes(m.file));
  renderMediaOrder();
}

function renderMediaOrder() {
  if (!state.mediaOrder.length) {
    dom.mediaOrderSec.style.display = "none";
    return;
  }
  dom.mediaOrderSec.style.display = "";
  dom.mediaOrderList.innerHTML = "";

  state.mediaOrder.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "mo-item";
    row.draggable = true;
    row.dataset.i = i;
    row.innerHTML = `
      <span class="mo-handle">⠿</span>
      <span class="mo-filename">${item.file}</span>
      <input class="mo-caption-input" type="text" placeholder="caption…" value="${item.caption || ""}" data-i="${i}" />
    `;
    dom.mediaOrderList.appendChild(row);
  });

  // Drag-to-reorder
  dom.mediaOrderList.querySelectorAll(".mo-item").forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      state.dragSrc = parseInt(row.dataset.i);
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-target"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-target");
      const dst = parseInt(row.dataset.i);
      if (state.dragSrc === dst) return;
      const moved = state.mediaOrder.splice(state.dragSrc, 1)[0];
      state.mediaOrder.splice(dst, 0, moved);
      renderMediaOrder();
    });
  });

  // Caption inputs
  dom.mediaOrderList.querySelectorAll(".mo-caption-input").forEach((input) => {
    input.addEventListener("input", () => {
      state.mediaOrder[parseInt(input.dataset.i)].caption = input.value;
    });
  });
}

// ─── File upload ─────────────────────────────────────────────────────────────

dom.dropZone.addEventListener("click", () => dom.fileInput.click());

dom.dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dom.dropZone.classList.add("drag-over");
});
dom.dropZone.addEventListener("dragleave", () => dom.dropZone.classList.remove("drag-over"));
dom.dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dom.dropZone.classList.remove("drag-over");
  handleFiles([...e.dataTransfer.files]);
});

dom.fileInput.addEventListener("change", () => {
  handleFiles([...dom.fileInput.files]);
  dom.fileInput.value = "";
});

function handleFiles(files) {
  const slug = dom.fSlug.value;
  if (!slug) {
    alert("Enter a title/slug before uploading media.");
    return;
  }
  for (const file of files) {
    const item = { file, name: file.name, status: "queued" };
    state.uploadQueue.push(item);
    renderQueueItem(item);
    uploadFile(item, slug);
  }
}

function renderQueueItem(item) {
  const row = document.createElement("div");
  row.className = "queue-item";
  row.id = `qi-${item.name}`;
  const size = item.file.size > 1024 * 1024
    ? (item.file.size / 1024 / 1024).toFixed(1) + " MB"
    : (item.file.size / 1024).toFixed(0) + " KB";
  row.innerHTML = `
    <span class="qi-name">${item.name}</span>
    <span class="qi-size">${size}</span>
    <span class="qi-status" id="qis-${item.name}">queued</span>
  `;
  dom.uploadQueue.appendChild(row);
}

async function uploadFile(item, slug) {
  const row = $(`qi-${item.name}`);
  const status = $(`qis-${item.name}`);

  row.classList.add("uploading");
  status.textContent = "uploading…";
  setStatus(`uploading ${item.name}…`, "busy");

  const fd = new FormData();
  fd.append("slug", slug);
  fd.append("files", item.file, item.name);

  try {
    const res = await fetch(`${API}/media`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.ok) {
      row.classList.remove("uploading");
      row.classList.add("done");
      status.textContent = "✓";
      item.status = "done";
      setStatus(`uploaded ${item.name}`, "ok");
      await loadDiskMedia(slug);
    } else {
      throw new Error(data.error);
    }
  } catch (e) {
    row.classList.add("error");
    status.textContent = "error";
    item.status = "error";
    setStatus(`upload failed: ${e.message}`, "fail");
  }
}

// ─── Save project ─────────────────────────────────────────────────────────────

dom.fSlug.addEventListener("change", () => {
  const slug = dom.fSlug.value;
  if (slug) loadDiskMedia(slug);
});

dom.saveBtn.addEventListener("click", saveProject);

async function saveProject() {
  const slug = dom.fSlug.value.trim();
  if (!slug) { alert("Slug is required."); return; }

  const frontmatter = {
    title:      dom.fTitle.value,
    date:       dom.fDate.value,
    slug,
    category:   dom.fCategory.value,
    cover:      dom.fCover.value,
    tags:       [...state.tags],
    techniques: [...state.techniques],
    materials:  [...state.materials],
    media:      state.mediaOrder.map((m) => ({
      file:    m.file,
      type:    m.type,
      caption: m.caption || "",
    })),
    draft: dom.fDraft.checked,
  };

  setStatus("saving…", "busy");

  try {
    const res = await fetch(`${API}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, frontmatter, projectBody: dom.fBody.value }),
    });
    const data = await res.json();
    if (data.ok) {
      setStatus(`saved → ${data.path}`, "ok");
      state.editingSlug = slug;
      dom.formHeading.textContent = "Edit Project";
      dom.cancelEditBtn.style.display = "";
    } else {
      throw new Error(data.error);
    }
  } catch (e) {
    setStatus("save failed: " + e.message, "fail");
  }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

dom.syncBtn.addEventListener("click", async () => {
  dom.syncOverlay.classList.remove("hidden");
  dom.syncLog.innerHTML = '<span class="log-info">ready to sync — click RUN RSYNC to push files to server</span>\n';

  // Show targets from config
  try {
    const res = await fetch(`${API}/config`);
    const cfg = await res.json();
    dom.syncTargets.innerHTML = "";
    for (const [key, target] of Object.entries(cfg.rsync || {})) {
      const row = document.createElement("div");
      row.className = "sync-target-row";
      row.innerHTML = `<span class="sync-target-label">${key}</span><span class="sync-target-path">${target.src} → ${target.dest}</span>`;
      dom.syncTargets.appendChild(row);
    }
  } catch (_) {}
});

dom.syncCloseBtn.addEventListener("click", () => dom.syncOverlay.classList.add("hidden"));

dom.syncRunBtn.addEventListener("click", async () => {
  dom.syncLog.innerHTML = '<span class="log-info">running rsync…\n</span>';
  dom.syncRunBtn.disabled = true;
  setStatus("syncing…", "busy");

  try {
    const res = await fetch(`${API}/sync`, { method: "POST" });
    const data = await res.json();
    dom.syncLog.innerHTML = "";

    for (const [target, result] of Object.entries(data)) {
      const hdr = document.createElement("span");
      hdr.className = result.ok ? "log-ok" : "log-err";
      hdr.textContent = `\n── ${target} ${result.ok ? "✓" : "✗"} ──\n`;
      dom.syncLog.appendChild(hdr);

      const body = document.createElement("span");
      body.className = result.ok ? "log-info" : "log-err";
      body.textContent = result.ok ? (result.output || "") : (result.error || "");
      dom.syncLog.appendChild(body);
    }

    const allOk = Object.values(data).every((r) => r.ok);
    setStatus(allOk ? "sync complete" : "sync finished with errors", allOk ? "ok" : "fail");
  } catch (e) {
    dom.syncLog.innerHTML = `<span class="log-err">sync request failed: ${e.message}</span>`;
    setStatus("sync failed", "fail");
  } finally {
    dom.syncRunBtn.disabled = false;
  }
});

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  setStatus("connecting to server…", "busy");
  await loadProjects();
  showView("projects");
}

init();

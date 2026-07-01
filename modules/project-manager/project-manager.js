import { ProjectManagerConfig } from "./config.js";
import { ProjectLogger } from "./logger.js";
import { ImageProcessor } from "./image-processor.js";
import { UploadEngine } from "./upload-engine.js";

const logger = new ProjectLogger("project-manager");
const processor = new ImageProcessor(logger);
const uploadEngine = new UploadEngine({ processor, logger });

const state = {
  step: "upload",
  published: false
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  render();
  logger.info("Project Manager loaded.", { version: ProjectManagerConfig.version });
});

function cacheElements() {
  els.fileInput = document.querySelector("#pm-file-input");
  els.browseButtons = document.querySelectorAll("[data-action='browse']");
  els.dropzone = document.querySelector("#pm-dropzone");
  els.message = document.querySelector("#pm-message");
  els.progress = document.querySelector("#pm-progress span");
  els.steps = document.querySelectorAll("[data-step]");
  els.grid = document.querySelector("#pm-grid");
  els.nextButton = document.querySelector("[data-action='next']");
  els.backButton = document.querySelector("[data-action='back']");
  els.cancelButtons = document.querySelectorAll("[data-action='cancel']");
  els.publishButton = document.querySelector("[data-action='publish']");
  els.summary = document.querySelector("#pm-summary");
  els.logOutput = document.querySelector("#pm-log-output");
}

function bindEvents() {
  els.browseButtons.forEach((button) => button.addEventListener("click", () => els.fileInput.click()));
  els.fileInput.addEventListener("change", (event) => handleFiles(event.target.files));

  els.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  });

  els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("is-dragging"));

  els.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
    handleFiles(event.dataTransfer.files);
  });

  els.nextButton.addEventListener("click", () => {
    if (!uploadEngine.items.length) {
      setMessage(ProjectManagerConfig.messages.noImages, "warning");
      return;
    }
    setStep("review");
  });

  els.backButton.addEventListener("click", () => setStep("upload"));
  els.cancelButtons.forEach((button) => button.addEventListener("click", cancelSession));
  els.publishButton.addEventListener("click", publishProject);

  uploadEngine.addEventListener("items-changed", () => render());
  uploadEngine.addEventListener("cancelled", () => setMessage("", "info"));
  uploadEngine.addEventListener("message", (event) => setMessage(event.detail.text, event.detail.type));
  uploadEngine.addEventListener("progress", (event) => {
    const { current, total, fileName } = event.detail;
    setProgress((current / total) * 100);
    setMessage(`Processing ${current} of ${total}: ${fileName}`, "info");
  });
  uploadEngine.addEventListener("processing-complete", (event) => {
    setProgress(100);
    setMessage(`${event.detail.total} photo${event.detail.total === 1 ? "" : "s"} ready.`, "success");
  });
}

async function handleFiles(files) {
  els.fileInput.value = "";
  setProgress(0);
  await uploadEngine.acceptFiles(files);
}

function setStep(step) {
  state.step = step;
  render();
}

function cancelSession() {
  uploadEngine.clear();
  state.step = "upload";
  state.published = false;
  setMessage("", "info");
  setProgress(0);
  render();
}

function publishProject() {
  const cover = uploadEngine.getCover();

  if (!cover) {
    setMessage("Choose at least one photo before publishing.", "warning");
    return;
  }

  const payload = {
    status: "dev-preview",
    cover: cover.outputName,
    images: uploadEngine.items.map((item) => ({
      originalName: item.originalName,
      outputName: item.outputName,
      featured: item.featured,
      width: item.width,
      height: item.height,
      size: item.imageBlob.size
    })),
    logs: logger.export()
  };

  state.published = true;
  logger.info("Development publish payload prepared.", { imageCount: payload.images.length, cover: payload.cover });
  renderSummary(payload);
  setStep("publish");
}

function render() {
  els.steps.forEach((step) => {
    step.classList.toggle("is-active", step.dataset.step === state.step);
  });

  els.nextButton.disabled = uploadEngine.items.length === 0;
  renderGrid();
  renderLog();
}

function renderGrid() {
  if (!els.grid) return;

  if (!uploadEngine.items.length) {
    els.grid.innerHTML = "<p class='pm-muted'>No photos selected yet.</p>";
    return;
  }

  els.grid.innerHTML = uploadEngine.items.map((item) => `
    <article class="pm-thumb ${item.featured ? "is-featured" : ""}" data-id="${item.id}">
      <span class="pm-cover-badge">⭐ Cover</span>
      <img src="${item.thumbnailUrl}" alt="${escapeHtml(item.originalName)}">
      <div class="pm-thumb-footer">
        <span class="pm-thumb-name" title="${escapeHtml(item.originalName)}">${escapeHtml(item.outputName)}</span>
        <button class="pm-mini" type="button" data-cover="${item.id}">Cover</button>
        <button class="pm-mini remove" type="button" data-remove="${item.id}">×</button>
      </div>
    </article>
  `).join("");

  els.grid.querySelectorAll("[data-cover]").forEach((button) => {
    button.addEventListener("click", () => uploadEngine.setCover(button.dataset.cover));
  });

  els.grid.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => uploadEngine.removeItem(button.dataset.remove));
  });
}

function renderSummary(payload) {
  els.summary.innerHTML = `
    <strong>Development publish ready.</strong>
    <span class="pm-muted">${payload.images.length} image${payload.images.length === 1 ? "" : "s"} prepared.</span>
    <span>Cover: <strong>${escapeHtml(payload.cover)}</strong></span>
    <details>
      <summary>View metadata payload</summary>
      <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </details>
  `;
}

function renderLog() {
  if (!els.logOutput) return;
  els.logOutput.textContent = JSON.stringify(logger.export(), null, 2);
}

function setProgress(percent) {
  els.progress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function setMessage(message, type = "info") {
  els.message.textContent = message;
  els.message.dataset.type = type;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

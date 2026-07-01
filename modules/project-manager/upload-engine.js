import { ProjectManagerConfig } from "./config.js";

export class UploadEngine extends EventTarget {
  constructor({ processor, logger }) {
    super();
    this.processor = processor;
    this.logger = logger;
    this.items = [];
  }

  async acceptFiles(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) {
      this.logger.info("File picker cancelled by user.");
      this.emit("cancelled");
      return this.items;
    }

    if (files.length > ProjectManagerConfig.maxImages) {
      this.logger.warn("Too many images selected.", { selected: files.length, max: ProjectManagerConfig.maxImages });
      this.emit("message", { type: "warning", text: ProjectManagerConfig.messages.maxImages });
      return this.items;
    }

    this.emit("processing-start", { count: files.length });

    const processed = [];

    for (const [index, file] of files.entries()) {
      this.emit("progress", { current: index + 1, total: files.length, fileName: file.name });
      const item = await this.processor.processFile(file);
      if (item) {
        processed.push(item);
      }
    }

    this.items = [...this.items, ...processed].slice(0, ProjectManagerConfig.maxImages);

    if (this.items.length && !this.items.some((item) => item.featured)) {
      this.setCover(this.items[0].id);
    }

    this.logger.info("Files processed.", { selected: files.length, accepted: processed.length, total: this.items.length });
    this.emit("items-changed", { items: this.items });
    this.emit("processing-complete", { accepted: processed.length, total: this.items.length });

    return this.items;
  }

  setCover(id) {
    this.items = this.items.map((item) => ({ ...item, featured: item.id === id }));
    this.logger.info("Cover photo selected.", { id });
    this.emit("items-changed", { items: this.items });
  }

  removeItem(id) {
    const removed = this.items.find((item) => item.id === id);
    this.items = this.items.filter((item) => item.id !== id);

    if (removed?.imageUrl) URL.revokeObjectURL(removed.imageUrl);
    if (removed?.thumbnailUrl) URL.revokeObjectURL(removed.thumbnailUrl);

    if (this.items.length && !this.items.some((item) => item.featured)) {
      this.items[0].featured = true;
    }

    this.logger.info("Image removed before publish.", { id, originalName: removed?.originalName });
    this.emit("items-changed", { items: this.items });
  }

  clear() {
    this.items.forEach((item) => {
      if (item.imageUrl) URL.revokeObjectURL(item.imageUrl);
      if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
    });
    this.items = [];
    this.logger.info("Upload session cleared.");
    this.emit("items-changed", { items: this.items });
  }

  getCover() {
    return this.items.find((item) => item.featured) || this.items[0] || null;
  }

  emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

import { ProjectManagerConfig } from "./config.js";

export class ImageProcessor {
  constructor(logger) {
    this.logger = logger;
    this.usedNames = new Set();
  }

  async processFile(file) {
    if (!file) {
      throw new Error("Missing file.");
    }

    if (!ProjectManagerConfig.acceptedTypes.includes(file.type) && !this.looksLikeImage(file)) {
      this.logger.rejection(file, "Unsupported file type.");
      return null;
    }

    const originalName = file.name || "image";
    const safeBaseName = this.safeBaseName(originalName);
    const outputName = this.uniqueName(`${safeBaseName}.jpg`);

    try {
      const bitmap = await this.decodeImage(file);
      const image = await this.renderToJpeg(bitmap, ProjectManagerConfig.output.maxWidth, ProjectManagerConfig.output.jpegQuality);
      const thumbnail = await this.renderToJpeg(bitmap, ProjectManagerConfig.output.thumbnailWidth, 0.8);

      return {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        originalName,
        outputName,
        type: file.type || "unknown",
        size: file.size || 0,
        width: image.width,
        height: image.height,
        originalFile: file,
        imageBlob: image.blob,
        thumbnailBlob: thumbnail.blob,
        imageUrl: URL.createObjectURL(image.blob),
        thumbnailUrl: URL.createObjectURL(thumbnail.blob),
        featured: false,
        status: "ready"
      };
    } catch (error) {
      this.logger.rejection(file, "Image failed to decode or convert.", { error: error.message });
      return null;
    }
  }

  looksLikeImage(file) {
    return /^image\//i.test(file?.type || "") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file?.name || "");
  }

  async decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" });
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Browser could not read image."));
      };

      img.src = url;
    });
  }

  async renderToJpeg(source, maxWidth, quality) {
    const scale = Math.min(1, maxWidth / source.width);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("JPEG conversion failed."));
          return;
        }
        resolve(result);
      }, "image/jpeg", quality);
    });

    return { blob, width, height };
  }

  safeBaseName(name) {
    return name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project-photo";
  }

  uniqueName(name) {
    const base = name.replace(/\.jpg$/i, "");
    let candidate = `${base}.jpg`;
    let count = 2;

    while (this.usedNames.has(candidate)) {
      candidate = `${base}-${count}.jpg`;
      count += 1;
    }

    this.usedNames.add(candidate);
    return candidate;
  }
}

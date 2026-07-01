export class ProjectLogger {
  constructor(scope = "project-manager") {
    this.scope = scope;
    this.entries = [];
  }

  info(message, data = {}) {
    this.write("info", message, data);
  }

  warn(message, data = {}) {
    this.write("warn", message, data);
  }

  error(message, data = {}) {
    this.write("error", message, data);
  }

  rejection(file, reason, data = {}) {
    this.write("rejected-image", reason, {
      originalName: file?.name || "unknown",
      type: file?.type || "unknown",
      size: file?.size || 0,
      ...data
    });
  }

  write(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      scope: this.scope,
      level,
      message,
      data
    };

    this.entries.push(entry);

    if (level === "error") {
      console.error(`[${this.scope}] ${message}`, data);
      return;
    }

    if (level === "warn" || level === "rejected-image") {
      console.warn(`[${this.scope}] ${message}`, data);
      return;
    }

    console.info(`[${this.scope}] ${message}`, data);
  }

  export() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }
}

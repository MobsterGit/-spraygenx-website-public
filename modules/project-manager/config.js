export const ProjectManagerConfig = {
  appName: "Project Manager",
  version: "0.1.0-sprint1",
  maxImages: 10,
  acceptedTypes: ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"],
  output: {
    jpegQuality: 0.86,
    maxWidth: 2200,
    thumbnailWidth: 420
  },
  paths: {
    devRoot: "/dev/project-manager/",
    logs: "/dev/project-manager/logs/",
    uploads: "/dev/project-manager/uploads/"
  },
  messages: {
    maxImages: "Please select up to 10 photos.",
    noImages: "Select photos to continue.",
    processingFailed: "Some photos could not be processed and were skipped."
  }
};

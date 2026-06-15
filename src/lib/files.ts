/* File-type helpers — icons, previews, categorization. */

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}
export function isVideo(mime: string): boolean {
  return mime.startsWith("video/");
}
export function isAudio(mime: string): boolean {
  return mime.startsWith("audio/");
}
export function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}
export function isText(mime: string, name = ""): boolean {
  if (mime.startsWith("text/")) return true;
  return /\.(txt|md|json|js|ts|tsx|jsx|css|html|py|rs|go|java|c|cpp|sh|yml|yaml|toml|xml|csv)$/i.test(name);
}
export function isArchive(mime: string, name = ""): boolean {
  return /zip|tar|gz|rar|7z/.test(mime) || /\.(zip|tar|gz|rar|7z)$/i.test(name);
}

export function fileIcon(mime: string, name = ""): string {
  if (isImage(mime)) return "ImageIcon";
  if (isVideo(mime)) return "Film";
  if (isAudio(mime)) return "Music";
  if (isPdf(mime)) return "FileText";
  if (isArchive(mime, name)) return "FolderArchive";
  if (isText(mime, name)) return "FileText";
  return "FileIcon";
}

export function extOf(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : "";
}

/** Create an object URL preview for an image/video, else null. Caller revokes. */
export function makePreview(file: File): string | null {
  if (isImage(file.type) || isVideo(file.type)) {
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }
  return null;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

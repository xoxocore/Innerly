// Read an uploaded image file and downscale it to a reasonably small JPEG data
// URL so vision images persist in localStorage without blowing the quota.
export async function fileToDataUrl(
  file: File,
  max = 1280,
  quality = 0.85
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  // Non-raster (e.g. svg) or canvas unavailable: keep as-is.
  if (!/^data:image\/(png|jpe?g|webp|gif)/i.test(dataUrl)) return dataUrl;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    let { width, height } = img;
    const longest = Math.max(width, height);
    if (longest > max) {
      const s = max / longest;
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

// Plain-text preview from rich-text HTML (for card snippets).
export function stripHtml(html?: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ");
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

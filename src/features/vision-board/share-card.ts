import { stripHtml } from "./image";
import type { VisionItem } from "@/lib/types";

const SIZE = 1080;
const PAD = 72;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Greedy wrap, returning at most `maxLines` with an ellipsis on the last.
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxWidth)
      last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

// Paints one vision as a square card so the picture travels with the words.
// A link cannot carry the image — everything lives in this browser — but a
// rendered card can go anywhere a photo can.
export async function renderShareCard(item: VisionItem): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIZE, SIZE);

  const imageH = Math.round(SIZE * 0.62);

  if (item.imageUrl) {
    try {
      const img = await loadImage(item.imageUrl);
      // cover: fill the band, cropping the overflowing axis
      const scale = Math.max(SIZE / img.width, imageH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (SIZE - w) / 2, (imageH - h) / 2, w, h);
    } catch {
      ctx.fillStyle = "#f1e6ec";
      ctx.fillRect(0, 0, SIZE, imageH);
    }
  } else {
    const [from, to] = item.gradient ?? ["#f6d6e0", "#e7e1f0"];
    const g = ctx.createLinearGradient(0, 0, SIZE, imageH);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, imageH);
  }

  const sans =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif';

  let y = imageH + PAD + 12;

  ctx.fillStyle = "#1b1b1b";
  ctx.font = `600 52px ${sans}`;
  ctx.textBaseline = "top";
  for (const line of wrap(ctx, item.title || "A vision", SIZE - PAD * 2, 2)) {
    ctx.fillText(line, PAD, y);
    y += 64;
  }

  const body = stripHtml(item.description);
  if (body) {
    y += 12;
    ctx.fillStyle = "#6b6b6b";
    ctx.font = `400 32px ${sans}`;
    for (const line of wrap(ctx, body, SIZE - PAD * 2, 4)) {
      ctx.fillText(line, PAD, y);
      y += 44;
    }
  }

  ctx.fillStyle = "#a3a3a3";
  ctx.font = `500 26px ${sans}`;
  ctx.fillText("Innerly · Vision Board", PAD, SIZE - PAD - 26);

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
  );
}

export type ShareOutcome = "shared" | "downloaded" | "failed";

export async function shareVision(item: VisionItem): Promise<ShareOutcome> {
  const blob = await renderShareCard(item);
  if (!blob) return "failed";

  const name =
    (item.title || "vision").replace(/[^\w\s-]/g, "").trim().slice(0, 40) ||
    "vision";
  const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  const text = [item.title, stripHtml(item.description)]
    .filter(Boolean)
    .join(" — ");

  // The native sheet is the real answer on a phone: it hands the card to
  // WhatsApp, Messages or Mail with the picture attached.
  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: item.title, text });
      return "shared";
    } catch (e) {
      // A cancelled sheet is not a failure worth falling back from.
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

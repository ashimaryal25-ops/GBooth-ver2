import { toPng } from "html-to-image";

export async function renderCardAsPng(node: HTMLElement) {
  const exportPromise = toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#f7f3ea",
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("Card export timed out.")), 10000);
  });

  const dataUrl = await Promise.race([exportPromise, timeoutPromise]);

  return dataUrl;
}

export function downloadPng(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function makeCardFilename(name: string) {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `cardifybooth-${cleanName || "card"}.png`;
}

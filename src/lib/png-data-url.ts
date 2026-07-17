const pngDataUrlPrefix = "data:image/png;base64,";
const maxPngBytes = 20 * 1024 * 1024;

export function decodePngDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith(pngDataUrlPrefix)) {
    throw new Error("Expected a PNG data URL.");
  }

  const base64 = dataUrl.slice(pngDataUrlPrefix.length);
  const buffer = Buffer.from(base64, "base64");
  const hasPngSignature =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (!hasPngSignature) {
    throw new Error("Print output must be a PNG image.");
  }

  if (buffer.length > maxPngBytes) {
    throw new Error("Print output is too large.");
  }

  return buffer;
}

/**
 * Laptop-only camera fallback.
 *
 * On the booth the camera is owned by `public/camera-mirror.html` running on the
 * second screen, and the app asks it for stills over BroadcastChannel/`/api/mirror`.
 * That mirror window isn't running during laptop testing, so with
 * NEXT_PUBLIC_DEV_CAMERA=1 the booth page grabs the webcam itself and serves the
 * same stills locally.
 *
 * The stream is acquired once and kept in a single always-playing hidden <video>.
 * Capturing from a video that is already playing avoids the black-frame race you
 * get from creating a fresh element and drawing before it has any dimensions.
 *
 * The flag must stay unset on the kiosk so the mirror path is untouched.
 */

const GLOBAL_KEY = "__boothCamera";

interface DevCamera {
  stream: MediaStream;
  video: HTMLVideoElement;
}

export function isDevCamera(): boolean {
  return (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_DEV_CAMERA === "1"
  );
}

function existing(): DevCamera | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as Record<string, DevCamera | undefined>)[GLOBAL_KEY] ?? null;
}

/** Acquire the webcam once and park it in a hidden, playing <video>. */
export async function startDevCamera(): Promise<DevCamera | null> {
  if (!isDevCamera()) return null;

  const already = existing();
  if (already) return already;

  // Deliberately loose: laptop webcams reject `exact` sizes and facingMode with
  // OverconstrainedError, which is the usual reason this fails on a new machine.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.style.display = "none";
  document.body.appendChild(video);
  await video.play();

  // Wait for real dimensions, otherwise the first capture draws nothing.
  if (!video.videoWidth) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener("loadedmetadata", done, { once: true });
      window.setTimeout(done, 2000);
    });
  }

  const camera: DevCamera = { stream, video };
  (window as unknown as Record<string, DevCamera>)[GLOBAL_KEY] = camera;
  return camera;
}

export function stopDevCamera(): void {
  const camera = existing();
  if (!camera) return;
  camera.stream.getTracks().forEach((track) => track.stop());
  camera.video.srcObject = null;
  camera.video.remove();
  delete (window as unknown as Record<string, DevCamera | undefined>)[GLOBAL_KEY];
}

/**
 * Grab a mirrored still, matching what the mirror window returns so the card and
 * collage flows can't tell the difference.
 */
export function captureDevPhoto(): string | null {
  const camera = existing();
  if (!camera) return null;

  const { video } = camera;
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.9);
}

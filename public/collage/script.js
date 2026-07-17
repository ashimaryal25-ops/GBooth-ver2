// STATE MANAGEMENT CONTEXT
let appState = {
  currentLayoutSlots: 4,
  capturedPhotos: [],
  cachedImages: [],
  stripBgColor: "#ffffff",
  selectedPreset: "none",
  watermarkText: "GETTYSBURG PHOTOBOOTH",
  stickersOnStrip: [],
};
let currentFilter = "none";

// Canvas Base Structural Dimension Framework
const STRIP_WIDTH = 320;
const CANVAS_PADDING = 15;
const FRAME_BORDER_BOTTOM = 60;

let draggingTargetSticker = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

const pages = {
  home: document.getElementById("page-home"),
  layout: document.getElementById("page-layout"),
  camera: document.getElementById("page-camera"),
  decor: document.getElementById("page-decor"),
  download: document.getElementById("page-download"),
};

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initCameraFlow();
  initDecorSuite();
  initExportActions();
  switchView("home");
});

function switchView(targetKey) {
  Object.keys(pages).forEach((key) => {
    if (key === targetKey) {
      pages[key].classList.remove("hidden");
    } else {
      pages[key].classList.add("hidden");
    }
  });
  document.body.className = `min-h-screen flex items-center justify-center font-sans antialiased text-gray-800 bg-state-${targetKey}`;
}

// FIXED: Clean touch panel helper that routes clicks without blocking focus or state changes
function setupTouchAndClick(element, callback) {
  if (!element) return;

  element.addEventListener("click", (e) => {
    callback(element, e);
  });
}

function initNavigation() {
  setupTouchAndClick(document.getElementById("btn-start"), () =>
    switchView("layout"),
  );

  document.querySelectorAll(".back-btn-nav").forEach((btn) => {
    setupTouchAndClick(btn, () => {
      const targetView = btn.getAttribute("data-target");
      if (targetView === "layout") stopCameraStream();
      if (targetView === "camera") startCameraStream();
      switchView(targetView);
    });
  });

  document.querySelectorAll(".layout-card").forEach((card) => {
    setupTouchAndClick(card, () => {
      const slots = parseInt(card.getAttribute("data-slots"));
      appState.currentLayoutSlots = slots;
      setupCameraViewSlots();
      switchView("camera");
      startCameraStream();
    });
  });

  setupTouchAndClick(document.getElementById("btn-restart"), () => {
    appState.capturedPhotos = [];
    appState.cachedImages = [];
    appState.stickersOnStrip = [];
    appState.stripBgColor = "#ffffff";
    appState.selectedPreset = "none";
    currentFilter = "none";

    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    const originalFilterBtn = document.querySelector('[data-filter="none"]');
    if (originalFilterBtn) originalFilterBtn.classList.add("active");

    document.getElementById("strip-color-picker").value = "#ffffff";
    document.getElementById("lbl-color").innerText = "#FFFFFF";
    document.getElementById("qr-container").classList.add("hidden");
    document.getElementById("qrcode").innerHTML = "";
    switchView("home");
  });
}

let streamReference = null;
const videoElement = document.getElementById("video");

async function startCameraStream(retries = 3) {
  try {
    if (streamReference) stopCameraStream();
    streamReference = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    videoElement.srcObject = streamReference;
    videoElement.onloadedmetadata = () => videoElement.play();
  } catch (err) {
    if (retries > 0) {
      console.warn("Camera busy, retrying in 2s...", err);
      setTimeout(() => startCameraStream(retries - 1), 2000);
    } else {
      console.error(err);
    }
  }
}

function stopCameraStream() {
  if (streamReference) {
    streamReference.getTracks().forEach((track) => track.stop());
    streamReference = null;
  }
}

window.addEventListener('unload', stopCameraStream);

function setupCameraViewSlots() {
  const previewContainer = document.getElementById("camera-slots-preview");
  previewContainer.innerHTML = "";
  appState.capturedPhotos = [];
  appState.cachedImages = [];

  for (let i = 0; i < appState.currentLayoutSlots; i++) {
    const slotEl = document.createElement("div");
    slotEl.id = `cam-slot-${i}`;
    slotEl.className =
      "sidebar-preview-thumbnail flex items-center justify-center text-[10px] font-black text-gray-400 bg-gray-100";
    slotEl.innerText = `Photo ${i + 1}`;
    previewContainer.appendChild(slotEl);
  }

  document.getElementById("btn-snap").disabled = false;
  document.getElementById("btn-snap").innerText = "📸 TAKE PICTURE";
  document.getElementById("btn-to-decor").disabled = true;
  document.getElementById("btn-retake").classList.add("hidden");
}

function initCameraFlow() {
  const snapBtn = document.getElementById("btn-snap");
  const countdownOverlay = document.getElementById("countdown");

  setupTouchAndClick(snapBtn, () => {
    if (appState.capturedPhotos.length >= appState.currentLayoutSlots) return;

    let count = 3;
    countdownOverlay.innerText = count;
    countdownOverlay.classList.remove("hidden");
    snapBtn.disabled = true;

    const countdownInterval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownOverlay.innerText = count;
      } else {
        clearInterval(countdownInterval);
        countdownOverlay.classList.add("hidden");
        executeCapture();
        snapBtn.disabled =
          appState.capturedPhotos.length >= appState.currentLayoutSlots;
      }
    }, 1000);
  });

  setupTouchAndClick(document.getElementById("btn-retake"), () =>
    setupCameraViewSlots(),
  );

  setupTouchAndClick(document.getElementById("btn-to-decor"), () => {
    stopCameraStream();
    switchView("decor");

    appState.cachedImages = [];
    let loadedCount = 0;

    appState.capturedPhotos.forEach((dataUrl) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === appState.capturedPhotos.length) {
          renderCanvasWorkspace();
        }
      };
      appState.cachedImages.push(img);
    });
  });
}

function executeCapture() {
  const currentIdx = appState.capturedPhotos.length;
  if (currentIdx >= appState.currentLayoutSlots) return;

  const snapCanvas = document.createElement("canvas");
  snapCanvas.width = 640;
  snapCanvas.height = 480;
  const ctx = snapCanvas.getContext("2d");

  ctx.translate(snapCanvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoElement, 0, 0, snapCanvas.width, snapCanvas.height);

  const dataUrl = snapCanvas.toDataURL("image/png");
  appState.capturedPhotos.push(dataUrl);

  const targetedSlot = document.getElementById(`cam-slot-${currentIdx}`);
  if (targetedSlot) {
    targetedSlot.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover" />`;
    targetedSlot.classList.remove("bg-gray-100", "text-gray-400");
    targetedSlot.classList.add("filled");
  }

  if (appState.capturedPhotos.length === appState.currentLayoutSlots) {
    document.getElementById("btn-snap").innerText = "✅ STRIP COMPLETED";
    document.getElementById("btn-snap").disabled = true;
    document.getElementById("btn-to-decor").disabled = false;
  }
  document.getElementById("btn-retake").classList.remove("hidden");
}

const workspaceCanvas = document.getElementById("decor-canvas");
const wsCtx = workspaceCanvas.getContext("2d");

function calculateDynamicCanvasHeight() {
  const singlePhotoHeight = (STRIP_WIDTH - CANVAS_PADDING * 2) * (3 / 4);
  return (
    appState.currentLayoutSlots * singlePhotoHeight +
    (appState.currentLayoutSlots + 1) * CANVAS_PADDING +
    FRAME_BORDER_BOTTOM
  );
}

function renderCanvasWorkspace() {
  const generatedHeight = calculateDynamicCanvasHeight();
  workspaceCanvas.width = STRIP_WIDTH;
  workspaceCanvas.height = generatedHeight;

  wsCtx.fillStyle = appState.stripBgColor;
  wsCtx.fillRect(0, 0, STRIP_WIDTH, generatedHeight);

  renderDecorationPresets(generatedHeight);

  const singlePhotoWidth = STRIP_WIDTH - CANVAS_PADDING * 2;
  const singlePhotoHeight = singlePhotoWidth * (3 / 4);

  appState.cachedImages.forEach((photoImg, index) => {
    const computedY =
      CANVAS_PADDING + index * (singlePhotoHeight + CANVAS_PADDING);

    wsCtx.save();

    // Explicit filter assignment string maps applied directly onto canvas state
    if (currentFilter === "bw") {
      wsCtx.filter = "grayscale(1)";
    } else if (currentFilter === "warm") {
      wsCtx.filter = "sepia(0.6) saturate(1.4) contrast(1.1)";
    } else if (currentFilter === "blue") {
      wsCtx.filter = "contrast(1.2) saturate(1.3) hue-rotate(190deg)";
    } else if (currentFilter === "pink") {
      wsCtx.filter = "contrast(1.1) saturate(1.5) hue-rotate(-30deg)";
    } else if (currentFilter === "vhs") {
      wsCtx.filter = "contrast(1.3) saturate(0.6) brightness(1.1)";
    } else {
      wsCtx.filter = "none";
    }

    wsCtx.drawImage(
      photoImg,
      CANVAS_PADDING,
      computedY,
      singlePhotoWidth,
      singlePhotoHeight,
    );
    wsCtx.restore();
  });

  renderStickersLayer();
  appendStripWatermark(generatedHeight);
}

function renderDecorationPresets(totalHeight) {
  wsCtx.save();
  if (appState.selectedPreset === "retro") {
    wsCtx.fillStyle = "rgba(244, 114, 182, 0.15)";
    wsCtx.font = "14px Arial";
    for (let y = 15; y < totalHeight - 40; y += 40) {
      wsCtx.fillText("❤️", 4, y);
      wsCtx.fillText("❤️", STRIP_WIDTH - 18, y + 20);
    }
  } else if (appState.selectedPreset === "stars") {
    wsCtx.fillStyle = "rgba(253, 224, 71, 0.25)";
    wsCtx.font = "16px Arial";
    for (let y = 10; y < totalHeight - 40; y += 50) {
      wsCtx.fillText("⭐", 2, y);
      wsCtx.fillText("✨", STRIP_WIDTH - 20, y + 25);
    }
  } else if (appState.selectedPreset === "grid") {
    wsCtx.strokeStyle = "rgba(0, 0, 0, 0.07)";
    wsCtx.lineWidth = 1;
    for (let x = 0; x < STRIP_WIDTH; x += 20) {
      wsCtx.beginPath();
      wsCtx.moveTo(x, 0);
      wsCtx.lineTo(x, totalHeight);
      wsCtx.stroke();
    }
    for (let y = 0; y < totalHeight; y += 20) {
      wsCtx.beginPath();
      wsCtx.moveTo(0, y);
      wsCtx.lineTo(STRIP_WIDTH, y);
      wsCtx.stroke();
    }
  }
  wsCtx.restore();
}

function renderStickersLayer() {
  wsCtx.save();
  appState.stickersOnStrip.forEach((sticker) => {
    wsCtx.font = `${sticker.size}px Arial`;
    wsCtx.textBaseline = "middle";
    wsCtx.textAlign = "center";
    wsCtx.fillText(sticker.emoji, sticker.x, sticker.y);
  });
  wsCtx.restore();
}

function appendStripWatermark(totalHeight) {
  wsCtx.save();
  wsCtx.fillStyle = "#4a3e3d";
  wsCtx.font = "bold 10px monospace";
  wsCtx.textAlign = "center";
  wsCtx.fillText(
    appState.watermarkText.toUpperCase(),
    STRIP_WIDTH / 2,
    totalHeight - 25,
  );
  wsCtx.restore();
}

function initDecorSuite() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    setupTouchAndClick(btn, () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderCanvasWorkspace();
    });
  });

  const cp = document.getElementById("strip-color-picker");
  cp.addEventListener("input", (e) => {
    appState.stripBgColor = e.target.value;
    document.getElementById("lbl-color").innerText =
      e.target.value.toUpperCase();
    renderCanvasWorkspace();
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    setupTouchAndClick(btn, () => {
      document
        .querySelectorAll(".preset-btn")
        .forEach((b) =>
          b.classList.remove("border-pink-500", "bg-pink-50", "text-pink-700"),
        );
      btn.classList.add("border-pink-500", "bg-pink-50", "text-pink-700");
      appState.selectedPreset = btn.getAttribute("data-preset");
      renderCanvasWorkspace();
    });
  });

  document.querySelectorAll(".sticker-item").forEach((st) => {
    setupTouchAndClick(st, () => {
      const emojiStr = st.getAttribute("data-sticker");
      appState.stickersOnStrip.push({
        id: Date.now() + Math.random(),
        emoji: emojiStr,
        x: STRIP_WIDTH / 2,
        y: calculateDynamicCanvasHeight() / 2,
        size: 40,
      });
      renderCanvasWorkspace();
    });
  });

  workspaceCanvas.addEventListener("pointerdown", handleDragStart);
  workspaceCanvas.addEventListener("pointermove", handleDragMove);
  workspaceCanvas.addEventListener("pointerup", handleDragEnd);
  workspaceCanvas.addEventListener("pointercancel", handleDragEnd);

  setupTouchAndClick(document.getElementById("btn-to-download"), () => {
    const finalDataUrl = workspaceCanvas.toDataURL("image/png");
    document.getElementById("download-link").href = finalDataUrl;
    switchView("download");
  });
}

function getCanvasMouseCoordinates(e) {
  const rect = workspaceCanvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * workspaceCanvas.width,
    y: ((e.clientY - rect.top) / rect.height) * workspaceCanvas.height,
  };
}

function handleDragStart(e) {
  const coords = getCanvasMouseCoordinates(e);
  draggingTargetSticker = null;
  for (let i = appState.stickersOnStrip.length - 1; i >= 0; i--) {
    const stk = appState.stickersOnStrip[i];
    const distance = Math.sqrt(
      (coords.x - stk.x) ** 2 + (coords.y - stk.y) ** 2,
    );
    if (distance < stk.size / 1.2) {
      draggingTargetSticker = stk;
      dragOffsetX = coords.x - stk.x;
      dragOffsetY = coords.y - stk.y;
      workspaceCanvas.setPointerCapture(e.pointerId);
      break;
    }
  }
}

function handleDragMove(e) {
  if (!draggingTargetSticker) return;
  const coords = getCanvasMouseCoordinates(e);
  draggingTargetSticker.x = coords.x - dragOffsetX;
  draggingTargetSticker.y = coords.y - dragOffsetY;
  renderCanvasWorkspace();
}

function handleDragEnd(e) {
  if (draggingTargetSticker) {
    workspaceCanvas.releasePointerCapture(e.pointerId);
    draggingTargetSticker = null;
  }
}

function initExportActions() {
  setupTouchAndClick(document.getElementById("btn-print"), async (button) => {
    const originalLabel = button.innerText;
    button.disabled = true;
    button.innerText = "Printing...";

    try {
      const imgUrl = workspaceCanvas.toDataURL("image/png");
      const response = await fetch("/api/collage/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl: imgUrl,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data && typeof data.error === "string"
            ? data.error
            : "Could not send collage to the kiosk printer.",
        );
      }

      window.parent.postMessage("collage_activity", "*");
      window.parent.postMessage("collage_printed", "*");
      button.innerText = "Sent to Printer";
      window.setTimeout(() => {
        button.innerText = originalLabel;
        button.disabled = false;
      }, 1800);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not print collage.");
      button.innerText = originalLabel;
      button.disabled = false;
    }
  });

  setupTouchAndClick(document.getElementById("btn-qr"), () => {
    const qrBox = document.getElementById("qr-container");
    const qrOutputTarget = document.getElementById("qrcode");
    qrOutputTarget.innerHTML = "";
    qrBox.classList.remove("hidden");
    new QRCode(qrOutputTarget, {
      text: "https://photobooth.nashallery.com/gallery/mock-strip-id-99823",
      width: 140,
      height: 140,
      colorDark: "#db2777",
      colorLight: "#ffffff",
    });
  });
}

// Activity Broadcast for Idle Timer
['touchstart', 'mousedown', 'keydown'].forEach(evt => {
  window.addEventListener(evt, () => {
    window.parent.postMessage("collage_activity", "*");
  });
});

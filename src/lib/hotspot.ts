/**
 * Booth hotspot details for the "join the Wi-Fi" QR on the final screens.
 *
 * When the booth serves downloads off its own hotspot, the guest has to be on
 * that network before the download link resolves. A phone camera can act on
 * exactly one QR at a time, so joining and downloading cannot be combined into
 * a single code: the join QR is shown as step 1 and the download QR as step 2.
 *
 * These are NEXT_PUBLIC_ because the browser builds the QR, and neither value
 * is a secret — both are displayed on screen to guests anyway.
 */

export type HotspotConfig = {
  ssid: string;
  password: string;
};

/** `;` `,` `:` `"` and `\` are delimiters in the WIFI: payload and must be escaped. */
function escapeWifiValue(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

/** The format phone cameras recognise as "join this network". */
export function buildWifiQrPayload({ ssid, password }: HotspotConfig): string {
  const parts = [`T:${password ? "WPA" : "nopass"}`, `S:${escapeWifiValue(ssid)}`];

  if (password) {
    parts.push(`P:${escapeWifiValue(password)}`);
  }

  return `WIFI:${parts.join(";")};;`;
}

/**
 * Read once at module scope: NEXT_PUBLIC_ values are inlined at build time, so
 * this is constant and safe to use as a stable value in effects.
 */
function readHotspotConfig(): HotspotConfig | null {
  const ssid = process.env.NEXT_PUBLIC_CARDIFYBOOTH_HOTSPOT_SSID?.trim();

  if (!ssid) return null;

  return {
    ssid,
    password: process.env.NEXT_PUBLIC_CARDIFYBOOTH_HOTSPOT_PASSWORD?.trim() ?? "",
  };
}

/** Null when the booth is not running its own hotspot; the join step is hidden. */
export const HOTSPOT_CONFIG = readHotspotConfig();

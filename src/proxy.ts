import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the kiosk itself off the guest Wi-Fi.
 *
 * In hotspot download mode the booth listens on the LAN so guests' phones can
 * fetch their own PNG. That would otherwise expose the entire app to anyone on
 * the hotspot: they could drive the booth UI, trigger prints and burn the dye
 * sub media, or read /api/local-cards and page through OTHER guests' photos.
 *
 * So requests that arrive on a LAN address may only reach the download route.
 * The booth's own browser uses localhost and is unaffected — which is how
 * KIOSK_SETUP.md already tells you to open it.
 *
 * Limits worth knowing: this keys off the Host header, so it stops guests
 * poking around from a phone browser, not a determined person crafting
 * requests by hand. It is a booth-privacy measure, not a hardened boundary.
 * Do not put anything on this machine that would be damaging to leak.
 */

/** Reachable from the guest network: a guest fetching their own download. */
const LAN_ALLOWED_PREFIXES = ["/api/local-downloads"];

/** Only when the LCD/camera mirror runs on a separate device (see KIOSK_SETUP.md). */
const REMOTE_MIRROR_PREFIXES = ["/camera-mirror.html", "/api/mirror"];

function isBoothHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    return true;
  }

  // Escape hatch if the kiosk browser cannot use localhost for some reason.
  const trusted = process.env.CARDIFYBOOTH_TRUSTED_HOSTS?.trim();
  if (!trusted) return false;

  return trusted
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(hostname.toLowerCase());
}

function isAllowedFromLan(pathname: string): boolean {
  const prefixes = [...LAN_ALLOWED_PREFIXES];

  if (process.env.CARDIFYBOOTH_ALLOW_REMOTE_MIRROR?.trim() === "true") {
    prefixes.push(...REMOTE_MIRROR_PREFIXES);
  }

  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Must come from the Host header, not request.nextUrl.hostname: Next normalises
 * nextUrl to the server's own origin, so it reads "localhost" even for a
 * request that arrived over the LAN, which would let everything through.
 */
function hostnameFromRequest(request: NextRequest): string {
  const host = request.headers.get("host");
  if (!host) return "";

  // IPv6 literals arrive bracketed, e.g. "[::1]:3000".
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return (end === -1 ? host : host.slice(0, end + 1)).toLowerCase();
  }

  return host.split(":")[0].toLowerCase();
}

export default function proxy(request: NextRequest) {
  if (isBoothHost(hostnameFromRequest(request))) {
    return NextResponse.next();
  }

  if (isAllowedFromLan(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return new NextResponse("This booth is not available from here.", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Content-Security-Policy for Personal OS. Pure function so it can be unit-tested.
//  * scripts: per-request nonce + 'strict-dynamic' (Next.js applies the nonce to its own inline scripts)
//  * styles: 'unsafe-inline' is required for style="" attributes (React, Recharts); nonces cannot cover attributes
//  * connect: the app itself and the Supabase project (REST, Auth, Storage over https; Realtime over wss)
//  * the app can never be framed, and forms can only post to itself
export function buildCsp({ nonce, supabaseUrl, isDev }: { nonce: string; supabaseUrl: string; isDev: boolean }): string {
  let supabase = "";
  try {
    const u = new URL(supabaseUrl);
    supabase = `${u.origin} wss://${u.host}`;
  } catch {
    supabase = "";
  }
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${supabase ? " " + supabase.split(" ")[0] : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? " " + supabase : ""}${isDev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Static security headers applied to every response (see next.config.ts). */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

import type { NextConfig } from "next";

const testnet = process.env.NEXT_PUBLIC_API_BASE_URL_TESTNET ?? "";
const mainnet = process.env.NEXT_PUBLIC_API_BASE_URL_MAINNET ?? "";
const onionTest = process.env.NEXT_PUBLIC_ONION_API_URL_TESTNET ?? "";
const onionMain = process.env.NEXT_PUBLIC_ONION_API_URL_MAINNET ?? "";
const lwdTest = process.env.NEXT_PUBLIC_LIGHTWALLETD_URL_TESTNET ?? "";
const lwdMain = process.env.NEXT_PUBLIC_LIGHTWALLETD_URL_MAINNET ?? "";

const connectSrc = ["'self'", testnet, mainnet, onionTest, onionMain, lwdTest, lwdMain]
  .filter(Boolean)
  .join(" ");

// Next's dev server needs eval for hot reload. Production builds use the
// strict policy from the architecture note, including wasm-unsafe-eval for
// the proof circuit and the Argon2 WASM.
// Next's app router boots from inline scripts. A nonce would also work, but
// this site is statically prerendered, so those script tags cannot carry a
// per-request nonce. 'unsafe-inline' lets that boot sequence run.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "worker-src 'self' blob:",
  `connect-src ${connectSrc}`,
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/credits", destination: "/wallet?action=withdraw", permanent: false },
      { source: "/deposit", destination: "/wallet?action=deposit", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/circuits/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

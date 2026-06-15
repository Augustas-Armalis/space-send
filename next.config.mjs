/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Set GITHUB_PAGES=true to produce a fully static export (out/) for GitHub Pages
// or any static host. PAGES_BASE_PATH is the repo subpath, e.g. "/space-send".
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = process.env.PAGES_BASE_PATH || "";

const base = {
  reactStrictMode: true,
  outputFileTracingRoot: import.meta.dirname,
  eslint: { ignoreDuringBuilds: true },
};

const nextConfig = isPages
  ? {
      ...base,
      output: "export",
      basePath: basePath || undefined,
      assetPrefix: basePath || undefined,
      trailingSlash: true,
      images: { unoptimized: true },
      // Mirror basePath to the client so share links include it.
      env: { NEXT_PUBLIC_BASE_PATH: basePath },
    }
  : {
      ...base,
      // Header rules aren't supported under `output: export`, so only here.
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
    };

export default nextConfig;

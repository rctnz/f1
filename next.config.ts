import type { NextConfig } from "next";

// GitHub Pages serves the site under /f1; the deploy workflow sets NEXT_PUBLIC_BASE_PATH=/f1.
// Locally it stays empty, so `npm run dev` keeps working at http://localhost:3000.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export", // plain HTML/CSS/JS in out/, no server needed
  basePath,
  trailingSlash: true,
  // Cache Components (PPR) cannot run in export mode; this one-page site has no data to cache.
};

export default nextConfig;

import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this project so Next doesn't infer it from a
  // stray parent lockfile (silences the workspace-root warning).
  outputFileTracingRoot: path.dirname(new URL(import.meta.url).pathname),
};

export default nextConfig;

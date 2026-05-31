import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep firebase-admin (and its transitive deps like google-auth-library, gcp-metadata,
  // gtoken, etc.) out of the server bundle so they resolve from node_modules at runtime.
  // Bundling them breaks dynamic requires inside firebase-admin on Vercel + pnpm.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;

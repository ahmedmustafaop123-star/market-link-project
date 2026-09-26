import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded PostgreSQL (WASM) must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  async redirects() {
    return [
      { source: "/mandi", destination: "/mandi-rates", permanent: false },
      { source: "/dashboard", destination: "/login", permanent: false },
      { source: "/signup", destination: "/register", permanent: false },
    ];
  },
};

export default nextConfig;

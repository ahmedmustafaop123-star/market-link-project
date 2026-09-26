import type { NextConfig } from "next";

/**
 * Hosts that may load Next.js *development* resources (HMR, dev chunks).
 * Without this, running `npm run dev` behind a tunnel / cloud preview proxy makes the browser get
 * "Blocked cross-origin request to Next.js dev resource …" for every script and stylesheet, so the
 * page looks broken. Nothing here affects production builds (`npm run build && npm start`) — the
 * check only exists in dev mode. Add your own host with ALLOWED_DEV_ORIGINS=a.example.com,b.example.com
 */
const devOrigins = [
  "*.e2b.app", // cloud sandbox live previews (https://<port>-<sandbox>.e2b.app)
  "*.e2b.dev",
  "*.trycloudflare.com", // npx cloudflared tunnel --url http://localhost:3000
  "*.loca.lt", // npx localtunnel --port 3000
  "*.ngrok-free.app",
  ...(process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
];

const nextConfig: NextConfig = {
  // Embedded PostgreSQL (WASM) must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: devOrigins,
  async redirects() {
    return [
      { source: "/mandi", destination: "/mandi-rates", permanent: false },
      { source: "/dashboard", destination: "/login", permanent: false },
      { source: "/signup", destination: "/register", permanent: false },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server behind a proxy with another hostname: ALLOWED_DEV_ORIGINS=dev.example.com
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  // No next/image in the app. Turning the optimizer off closes the unused
  // /_next/image endpoint and keeps untrusted images away from sharp.
  images: { unoptimized: true },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === "true";
// Where the site lives under its host. On the GitHub Pages preview that is /CW-enterprise; on the customer's own
// domain (SITE_BASE_PATH set to "" by the workflow when SITE_DOMAIN is configured) it is the root.
const basePath = isGithubPages ? (process.env.SITE_BASE_PATH ?? "/CW-enterprise") : "";

const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/webp"],
  },
  // Plain files in public/ (such as the photos) need the base path added by hand.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Only applied for the GitHub Pages build (see .github/workflows/deploy-pages.yml).
  // The real deployment (Vercel etc.) keeps a normal Next.js server build.
  ...(isGithubPages && {
    output: "export",
    basePath,
    trailingSlash: true,
  }),
};

export default nextConfig;

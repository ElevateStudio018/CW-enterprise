/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPages ? "/CW-enterprise" : "";

const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/webp"],
  },
  // Plain files in public/ (such as the photos) need the base path added by hand.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Only applied for the GitHub Pages preview build (see .github/workflows/deploy-pages.yml).
  // The real deployment (Vercel etc.) keeps a normal Next.js server build.
  ...(isGithubPages && {
    output: "export",
    basePath,
    trailingSlash: true,
  }),
};

export default nextConfig;

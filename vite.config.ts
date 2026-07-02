import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

/** Manifest icon with optional `media` for light/dark (Chrome 96+). */
type ThemedManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
  media?: string;
};

const themedIcons: ThemedManifestIcon[] = [
  {
    src: "/icons/icon-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
    media: "(prefers-color-scheme: light)",
  },
  {
    src: "/icons/icon-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
    media: "(prefers-color-scheme: light)",
  },
  {
    src: "/icons/icon-192-dark.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
    media: "(prefers-color-scheme: dark)",
  },
  {
    src: "/icons/icon-512-dark.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
    media: "(prefers-color-scheme: dark)",
  },
  {
    src: "/icons/icon-maskable-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
    media: "(prefers-color-scheme: light)",
  },
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
    media: "(prefers-color-scheme: light)",
  },
  {
    src: "/icons/icon-maskable-192-dark.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
    media: "(prefers-color-scheme: dark)",
  },
  {
    src: "/icons/icon-maskable-512-dark.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
    media: "(prefers-color-scheme: dark)",
  },
];

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: "auto",
      includeAssets: [
        "favicon.svg",
        "favicon-light.svg",
        "favicon-dark.svg",
        "icons/apple-touch-icon.png",
        "icons/apple-touch-icon-light.png",
        "icons/apple-touch-icon-dark.png",
      ],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      manifest: {
        name: "Expense Manager",
        short_name: "Expenses",
        description: "A production-quality personal expense manager.",
        theme_color: "#0066cc",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        id: "/",
        icons: themedIcons,
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});

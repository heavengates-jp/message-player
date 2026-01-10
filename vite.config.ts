import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      filename: "sw-pwa.js",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "\u30E1\u30C3\u30BB\u30FC\u30B8\u30D7\u30EC\u30FC\u30E4\u30FC",
        short_name: "\u30E1\u30C3\u30BB\u30FC\u30B8",
        description:
          "Google Drive\u306e\u8aac\u6559\u30fb\u30e1\u30c3\u30bb\u30fc\u30b8\u97f3\u58f0\u3092\u30af\u30ea\u30c3\u30d7\u3057\u3066\u805e\u304d\u3084\u3059\u304f\u3059\u308bPWA",
        lang: "ja-JP",
        theme_color: "#0b1b2b",
        background_color: "#0b1b2b",
        display: "standalone",
        start_url: "/message-player/",
        scope: "/message-player/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ]
});
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const buildId = Date.now().toString();

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      {
        name: "inject-build-id",
        transformIndexHtml(html: string) {
          return html.replace(/__APP_BUILD_ID__/g, buildId);
        },
      },
      VitePWA({
        // injectManifest instead of the old generateSW -- generateSW
        // auto-writes the whole worker from this config and has no hook
        // for a custom `push` event listener. src/sw.ts is hand-written
        // (imports workbox-* directly) and replicates every runtime-
        // caching rule this config used to express declaratively; see its
        // own header comment. registerType: autoUpdate still applies to
        // how the client registers/updates this worker.
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        },
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "favicon.png", "images/ost-logo.png"],
        manifest: {
          name: "Our School Tech",
          short_name: "OurSchool",
          description: "Smart School Management for Modern Education",
          start_url: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color: "#0F766E",
          background_color: "#ffffff",
          icons: [
            {
              src: "/pwa-icon-512.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-icon-maskable-512.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/pwa-icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    build: {
      outDir: "build",
      assetsDir: "static",
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-dropdown-menu',
            ],
            'vendor-charts': ['recharts'],
            'vendor-pdf': ['jspdf', 'html2canvas'],
            'vendor-excel': ['exceljs'],
            'vendor-motion': ['framer-motion'],
          },
        },
      },
    },
    optimizeDeps: {
      include: ["date-fns"],
    },
  };
});
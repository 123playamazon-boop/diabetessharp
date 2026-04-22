import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { dbxApiProxyPlugin } from "./dbxApiProxyPlugin";

const scrapeApiTarget = process.env.SCRAPE_API_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [dbxApiProxyPlugin({ target: scrapeApiTarget }), react(), tailwindcss()],
  server: {
    /** `true` = IPv4 + IPv6 (`localhost` no Mac não fica só em ::1 sem listener na 5173). */
    host: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
});

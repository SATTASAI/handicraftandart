import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { devApi } from "./scripts/dev-api.mjs";
export default defineConfig({
  plugins: [react(), devApi()],
  server: { host: "0.0.0.0", port: 4173, strictPort: true },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName =
  process.env.VITE_REPOSITORY_NAME ?? "the-office-of-interim-comedy";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? `/${repositoryName}/`,
});

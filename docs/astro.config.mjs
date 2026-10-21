// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "cat-status",
      description: "CLI docs for cat-status — HTTP status codes to http.cat URLs.",
      sidebar: [
        { label: "Introduction", slug: "index" },
        { label: "Install", slug: "install" },
        { label: "Quick start", slug: "quick-start" },
        { label: "Command reference", slug: "command-reference" },
        { label: "Troubleshooting", slug: "troubleshooting" },
        { label: "Changelog", slug: "changelog" },
      ],
    }),
  ],
});

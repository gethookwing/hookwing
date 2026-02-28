import { defineConfig } from "tinacms";

const branch =
  process.env.TINA_BRANCH ||
  process.env.HEAD ||
  process.env.CF_PAGES_BRANCH ||
  "main";

export default defineConfig({
  branch,
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",
  build: {
    outputFolder: "admin",
    publicFolder: ".",
  },
  media: {
    tina: {
      mediaRoot: "assets",
      publicFolder: ".",
    },
  },
  schema: {
    collections: [
      {
        name: "blog",
        label: "Blog",
        path: "content/blog",
        format: "md",
        fields: [
          { type: "string", name: "title", label: "Title", required: true },
          { type: "string", name: "slug", label: "Slug", required: true },
          { type: "datetime", name: "date", label: "Date", required: true },
          { type: "boolean", name: "draft", label: "Draft" },
          { type: "string", name: "summary", label: "Summary" },
          { type: "rich-text", name: "body", label: "Body", isBody: true },
        ],
      },
      {
        name: "docs",
        label: "Docs",
        path: "content/docs",
        format: "md",
        fields: [
          { type: "string", name: "title", label: "Title", required: true },
          { type: "string", name: "slug", label: "Slug", required: true },
          {
            type: "datetime",
            name: "updatedAt",
            label: "Updated At",
            required: true,
          },
          { type: "string", name: "summary", label: "Summary" },
          { type: "rich-text", name: "body", label: "Body", isBody: true },
        ],
      },
    ],
  },
});

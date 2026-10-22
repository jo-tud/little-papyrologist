import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { parse } from "yaml";

// Lets the app import the YAML files in data/ as plain objects.
function yamlData(): Plugin {
  return {
    name: "yaml-data",
    transform(code, id) {
      if (!id.endsWith(".yaml")) return null;
      return { code: `export default ${JSON.stringify(parse(code))};`, map: null };
    },
  };
}

// One self-contained index.html, so the trainer also runs offline from the folder.
export default defineConfig({
  base: "./",
  plugins: [yamlData(), viteSingleFile()],
  build: { target: "es2022" },
});

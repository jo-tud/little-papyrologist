import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { parse } from "yaml";

/** Resolve the same source files and YAML data as the browser build. */
export function browserModuleHooks() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) {
        const candidate = new URL(`${specifier}.ts`, context.parentURL);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".yaml")) return {
        format: "module",
        source: `export default ${JSON.stringify(parse(readFileSync(new URL(url), "utf8")))};`,
        shortCircuit: true,
      };
      return nextLoad(url, context);
    },
  });
}

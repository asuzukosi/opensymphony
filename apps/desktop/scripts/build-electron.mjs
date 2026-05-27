import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const appRoot = path.resolve(__dirname, "..");
export const repoRoot = path.resolve(appRoot, "..", "..");
export const outDir = path.join(appRoot, ".electron");

const mainEntry = path.join(appRoot, "src/main.ts");
const preloadEntry = path.join(appRoot, "src/preload.ts");
const mainOutfile = path.join(outDir, "main.js");
const preloadOutfile = path.join(outDir, "preload.js");

function resolveAliasTarget(basePath) {
  if (existsSync(`${basePath}.ts`)) return `${basePath}.ts`;
  if (existsSync(`${basePath}.tsx`)) return `${basePath}.tsx`;
  if (existsSync(path.join(basePath, "index.ts"))) {
    return path.join(basePath, "index.ts");
  }
  if (existsSync(basePath)) return basePath;
  return basePath;
}

const aliasPlugin = {
  name: "symphony-alias",
  setup(pluginBuild) {
    const aliasTable = [
      { re: /^@\/(.+)$/, to: path.join(appRoot, "src", "$1") },
      { re: /^@core\/(.+)$/, to: path.join(repoRoot, "packages/core/src", "$1") },
      { re: /^@db\/(.+)$/, to: path.join(repoRoot, "packages/db/src", "$1") },
    ];

    for (const { re, to } of aliasTable) {
      pluginBuild.onResolve({ filter: re }, (args) => {
        const match = args.path.match(re);
        if (!match) return null;
        const resolved = resolveAliasTarget(to.replace("$1", match[1] ?? ""));
        return { path: resolved };
      });
    }
  },
};

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  external: ["electron", "better-sqlite3"],
  plugins: [aliasPlugin],
  logLevel: "info",
};

export async function buildElectronEntrypoints() {
  await Promise.all([
    build({
      ...common,
      entryPoints: [mainEntry],
      outfile: mainOutfile,
    }),
    build({
      ...common,
      entryPoints: [preloadEntry],
      outfile: preloadOutfile,
    }),
  ]);
}

export async function watchElectronEntrypoints() {
  const mainCtx = await context({
    ...common,
    entryPoints: [mainEntry],
    outfile: mainOutfile,
  });
  const preloadCtx = await context({
    ...common,
    entryPoints: [preloadEntry],
    outfile: preloadOutfile,
  });

  await Promise.all([mainCtx.watch(), preloadCtx.watch()]);

  return { mainCtx, preloadCtx };
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  buildElectronEntrypoints().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Writes design/tokens.json into the farmer app and the ERP, and copies the logo, so both always match.
 *
 *   node design/build-tokens.mjs           write the generated files
 *   node design/build-tokens.mjs --check   fail if any generated file is out of date (for CI / before a PR)
 *
 * Outputs (never edit by hand):
 *   mobile/src/theme/tokens.generated.ts   colour palette, semantic colours, spacing, radius, type sizes
 *   web/src/app/tokens.generated.css       the same, as Tailwind v4 theme variables
 *   web/public/brand/logo.jpg, web/src/app/icon.png   logo and browser-tab icon, copied from the app
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "design/tokens.json"), "utf8"));
const check = process.argv.includes("--check");

const HEADER = "GENERATED from design/tokens.json by design/build-tokens.mjs. Do not edit; change tokens.json and re-run.";
const strip = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith("$")));
const color = strip(tokens.color);

/** "gray900" → "#171C14"; literal values ("rgba(...)", "#...") pass through. */
function resolve(value) {
  if (value.startsWith("#") || value.startsWith("rgb")) return value;
  if (!(value in color)) throw new Error(`Unknown colour "${value}" in tokens.json`);
  return color[value];
}
function resolveTree(node) {
  if (typeof node === "string") return resolve(node);
  return Object.fromEntries(Object.entries(strip(node)).map(([k, v]) => [k, resolveTree(v)]));
}
const semantic = resolveTree(tokens.semantic);
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// ---------- mobile (TypeScript) ----------

const ts = (name, obj) => `export const ${name} = ${JSON.stringify(obj, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, "$1:")} as const;\n`;
const mobile = [
  `/** ${HEADER} */\n`,
  ts("color", color),
  ts("spacing", strip(tokens.spacing)),
  ts("radius", strip(tokens.radius)),
  ts("fontSize", strip(tokens.fontSize)),
  ts("lineHeight", strip(tokens.lineHeight)),
  "/** What each colour is for (text, surfaces, buttons, status…), resolved to values. */\n",
  ts("semanticColor", semantic),
].join("\n");

// ---------- web (Tailwind v4 CSS variables) ----------

const lines = [];
const out = (name, value) => lines.push(`  --${name}: ${value};`);
lines.push("  /* Palette: utilities like bg-green600, text-gray700 */");
for (const [k, v] of Object.entries(color)) out(`color-${k}`, v);
lines.push("", "  /* Meaning: utilities like bg-surface-brand, text-text-muted, border-border-default */");
function flatten(prefix, node) {
  for (const [k, v] of Object.entries(node)) {
    const name = `${prefix}-${kebab(k)}`;
    if (typeof v === "string") out(`color-${name}`, v);
    else flatten(name, v);
  }
}
for (const [group, node] of Object.entries(semantic)) {
  if (typeof node === "string") out(`color-${kebab(group)}`, node);
  else flatten(kebab(group), node);
}
lines.push(
  "",
  "  /* Short names the ERP screens use (same values as above) */",
);
const alias = {
  "brand-50": semantic.surface.brandSoft,
  "brand-100": semantic.surface.brandMid,
  "brand-600": semantic.interactive.primaryBg,
  "brand-700": semantic.interactive.primaryBgHover,
  "brand-800": semantic.surface.brandDeep,
  accent: color.amber500,
  "accent-soft": color.amber50,
  ink: semantic.text.primary,
  muted: semantic.text.muted,
  line: semantic.border.default,
  canvas: semantic.surface.canvas,
  surface: semantic.surface.base,
  danger: semantic.status.dangerText,
  "danger-bg": semantic.status.dangerBg,
  warning: semantic.status.warningText,
  "warning-bg": semantic.status.warningBg,
  success: semantic.status.successText,
  "success-bg": semantic.status.successBg,
  info: semantic.status.infoText,
  "info-bg": semantic.status.infoBg,
};
for (const [k, v] of Object.entries(alias)) out(`color-${k}`, v);
lines.push("", "  /* Corner radius: rounded-sm/md/lg/xl */");
for (const [k, v] of Object.entries(strip(tokens.radius))) out(`radius-${k}`, `${v}px`);
lines.push("", "  /* Type sizes: text-micro … text-hero (with matching line height) */");
const lh = strip(tokens.lineHeight);
for (const [k, v] of Object.entries(strip(tokens.fontSize))) {
  out(`text-${k}`, `${v / 16}rem`);
  if (lh[k]) out(`text-${k}--line-height`, `${lh[k] / 16}rem`);
}
lines.push("", "  /* Spacing named like the app (the Tailwind 4px grid already matches: xs=2, md=4, lg=6 …) */");
for (const [k, v] of Object.entries(strip(tokens.spacing))) out(`spacing-${k}`, `${v}px`);
const font = strip(tokens.font);
lines.push(
  "",
  "  /* Fonts: loaded by next/font in layout.tsx, which sets these variables */",
  `  --font-sans: var(--font-inter), var(--font-noto-telugu), ${font.text.map((f) => `"${f}"`).join(", ")}, ui-sans-serif, system-ui, sans-serif;`,
  `  --font-display: var(--font-baloo), "${font.display}", var(--font-inter), ui-sans-serif, system-ui, sans-serif;`,
);
const web = `/* ${HEADER} */\n@theme {\n${lines.join("\n")}\n}\n`;

// ---------- write or check ----------

const files = [
  [join(root, "mobile/src/theme/tokens.generated.ts"), Buffer.from(mobile)],
  [join(root, "web/src/app/tokens.generated.css"), Buffer.from(web)],
  [join(root, "web/public/brand/logo.jpg"), readFileSync(join(root, tokens.brand.logo))],
  [join(root, "web/src/app/icon.png"), readFileSync(join(root, tokens.brand.icon))],
];
let stale = 0;
for (const [path, content] of files) {
  const same = existsSync(path) && readFileSync(path).equals(content);
  const shown = path.slice(root.length + 1).replaceAll("\\", "/");
  if (check) {
    if (!same) {
      console.error(`out of date: ${shown}`);
      stale++;
    }
  } else if (!same) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`wrote ${shown}`);
  }
}
if (check) {
  if (stale) {
    console.error(`\n${stale} file(s) don't match design/tokens.json. Run: node design/build-tokens.mjs`);
    process.exit(1);
  }
  console.log("Design tokens are in sync (app and ERP).");
}

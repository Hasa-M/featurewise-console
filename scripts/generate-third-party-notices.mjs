import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontend = resolve(root, "frontend");
const lock = JSON.parse(
  readFileSync(resolve(frontend, "package-lock.json"), "utf8"),
);
const sections = [
  "Featurewise Console — third-party runtime dependency notices\n\nGenerated from frontend/package-lock.json and installed package license files.\nThese packages retain their own licenses; the repository license does not replace them.",
];
const missing = [];
let count = 0;
for (const [location, metadata] of Object.entries(lock.packages).sort(
  ([a], [b]) => a.localeCompare(b),
)) {
  if (!location || metadata.dev) continue;
  const directory = resolve(frontend, location);
  if (!existsSync(directory)) {
    missing.push(`${location} (not installed)`);
    continue;
  }
  const manifest = JSON.parse(
    readFileSync(resolve(directory, "package.json"), "utf8"),
  );
  const files = readdirSync(directory, { withFileTypes: true }).filter(
    (entry) =>
      entry.isFile() &&
      /^(licen[cs]e|copying|notice)(?:[. -]|$)/i.test(entry.name),
  );
  const fallbackVersions = {
    "cm6-theme-basic-light": "0.2.0",
    format: "0.2.2",
    "mdast-util-highlight-mark": "1.2.2",
    "micromark-extension-highlight-mark": "1.2.0",
    "react-remove-scroll-bar": "2.3.8",
  };
  const fallback = resolve(root, "docs/licenses", `${manifest.name}.txt`);
  if (
    !files.length &&
    fallbackVersions[manifest.name] === manifest.version &&
    existsSync(fallback)
  ) {
    sections.push(
      `${manifest.name}@${manifest.version}\n${readFileSync(fallback, "utf8")}`,
    );
    count++;
    continue;
  }
  if (!files.length) {
    missing.push(
      `${manifest.name}@${manifest.version} (${manifest.license ?? metadata.license ?? "unknown"})`,
    );
    continue;
  }
  sections.push(
    `${manifest.name}@${manifest.version}\nLicense: ${typeof manifest.license === "string" ? manifest.license : (metadata.license ?? "see below")}\n${files.map((file) => `${file.name}\n${readFileSync(resolve(directory, file.name), "utf8")}`).join("\n\n")}`,
  );
  count++;
}
if (missing.length) {
  console.error(
    "Missing license text; notices were not generated:\n" + missing.join("\n"),
  );
  process.exitCode = 1;
} else {
  writeFileSync(
    resolve(frontend, "public/THIRD_PARTY_NOTICES.txt"),
    sections.join("\n\n" + "=".repeat(72) + "\n\n").trimEnd() + "\n",
  );
  console.log(
    `Preserved license texts for ${count} runtime packages, including bundled fonts and icons.`,
  );
}

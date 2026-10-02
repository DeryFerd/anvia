import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gitResult = spawnSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
  { encoding: "utf8" },
);

if (gitResult.status !== 0) {
  process.stderr.write(gitResult.stderr);
  process.exit(gitResult.status ?? 1);
}

const files = gitResult.stdout.split("\0").filter(Boolean);

if (files.length === 0) {
  console.log("No staged files to check.");
  process.exit(0);
}

function resolveBin(pkgName) {
  const pkgPath = fileURLToPath(import.meta.resolve(`${pkgName}/package.json`));
  const manifest = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const binEntry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin[pkgName];
  return path.resolve(path.dirname(pkgPath), binEntry);
}

const checks = [
  [resolveBin("oxfmt"), "--check", "--no-error-on-unmatched-pattern", "--", ...files],
  [resolveBin("oxlint"), "--no-error-on-unmatched-pattern", "--", ...files],
];

for (const [bin, ...args] of checks) {
  const result = spawnSync(process.execPath, [bin, ...args], { stdio: "inherit" });

  if (result.error !== undefined) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

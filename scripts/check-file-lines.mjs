import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function runFileLineCheck(argumentsList = process.argv) {
  const maxLines = readMaxLines(argumentsList);
  const files = argumentsList.includes("--changed")
    ? collectChangedFiles()
    : argumentsList.slice(2).filter((argument) => !argument.startsWith("--"));
  const checkableFiles = files.filter((file) => isCheckableFile(file) && existsSync(file));
  const violations = findLineCountViolations(checkableFiles, maxLines);

  for (const violation of violations) {
    console.error(
      `文件行数超限：${violation.file} ${violation.lineCount} > ${violation.maxLines}`,
    );
  }
  if (violations.length > 0) {
    return 1;
  }
  console.log(`文件行数检查通过：${checkableFiles.length} 个文件，阈值 ${maxLines} 行。`);
  return 0;
}

export function findLineCountViolations(files, limit) {
  return files
    .map((file) => ({ file, lineCount: countLines(file), maxLines: limit }))
    .filter((entry) => entry.lineCount > entry.maxLines);
}

function readMaxLines(argumentsList) {
  const index = argumentsList.indexOf("--max-lines");
  if (index < 0) {
    return 500;
  }
  const value = Number(argumentsList[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--max-lines 必须是正整数，收到：${argumentsList[index + 1]}`);
  }
  return value;
}

function collectChangedFiles() {
  const tracked = git(["diff", "--name-only", "HEAD", "--"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort();
}

function git(argumentsList) {
  return execFileSync("git", argumentsList, { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

function isCheckableFile(file) {
  return /^(src|tests|scripts)\/.*\.(?:ts|mjs|css)$/.test(file);
}

function countLines(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).length - 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runFileLineCheck());
}

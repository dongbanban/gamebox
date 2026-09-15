#!/bin/sh
set -eu

max_lines=$1
status=0
checkable_files=0
changed_files=$(mktemp "${TMPDIR:-/tmp}/gamebox-line-check.XXXXXX")
trap 'rm -f "$changed_files"' EXIT

if ! git diff --name-only HEAD -- > "$changed_files"; then
  printf '读取改动文件失败：git diff\n' >&2
  exit 1
fi
if ! git ls-files --others --exclude-standard >> "$changed_files"; then
  printf '读取改动文件失败：git ls-files\n' >&2
  exit 1
fi

while IFS= read -r file; do
  case "$file" in
    src/*.ts|src/*.mjs|src/*.css|tests/*.ts|tests/*.mjs|tests/*.css|scripts/*.ts|scripts/*.mjs|scripts/*.css|scripts/*.sh)
      [ -f "$file" ] || continue
      checkable_files=$((checkable_files + 1))
      lines=$(wc -l < "$file")
      if [ "$lines" -gt "$max_lines" ]; then
        printf '文件行数超限：%s %s > %s\n' "$file" "$lines" "$max_lines" >&2
        status=1
      fi
      ;;
  esac
done < "$changed_files"

if [ "$status" -ne 0 ]; then
  exit "$status"
fi
printf '文件行数检查通过：%s 个文件，阈值 %s 行。\n' "$checkable_files" "$max_lines"

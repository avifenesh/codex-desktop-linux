#!/bin/bash
set -Eeuo pipefail

pattern_path="${1:?usage: select-latest-package.sh /path/to/package-pattern}"
directory="$(dirname "$pattern_path")"
pattern="$(basename "$pattern_path")"
record=""

while IFS= read -r -d '' candidate; do
    record="$candidate"
    break
done < <(
    find "$directory" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\0' |
        sort -z -nr
)

[ -n "$record" ] || exit 1
printf '%s\n' "${record#* }"

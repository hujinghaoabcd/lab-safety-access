#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

report_dir="${1:-.history-audit}"
mkdir -p "$report_dir"
paths_report="$report_dir/sensitive-paths.txt"
secrets_report="$report_dir/suspected-secret-paths.txt"
summary_report="$report_dir/summary.txt"
: > "$paths_report"
: > "$secrets_report"

# Only report object id, object size, and historical path. Blob contents are
# never printed or copied to the report.
while IFS=' ' read -r object_id object_path; do
  [ -n "${object_path:-}" ] || continue
  lower_path="$(printf '%s' "$object_path" | tr '[:upper:]' '[:lower:]')"

  case "$lower_path" in
    *.xlsx|*.xls|*.db|*.sqlite|*.sqlite3|*.pem|*.key|*.p12|*.pfx|*.env|*.env.*)
      # Public templates and examples contain no real credentials/data.
      case "$lower_path" in
        .env.example|*/.env.example|*template*.xlsx|*template*.xls) continue ;;
      esac
      size="$(git cat-file -s "$object_id" 2>/dev/null || printf '?')"
      printf '%s\t%s\t%s\n' "$object_id" "$size" "$object_path" >> "$paths_report"
      ;;
  esac
done < <(git rev-list --objects --all)

sort -u -o "$paths_report" "$paths_report"

secret_regex='BEGIN ([A-Z ]+ )?PRIVATE KEY|JWT_SECRET[[:space:]]*[:=][[:space:]]*[^$<{[:space:]][^[:space:]]+|ADMIN_PASSWORD[[:space:]]*[:=][[:space:]]*[^$<{[:space:]][^[:space:]]+|DEPLOY_SSH_KEY|HISTORICAL_ADMIN_PASSWORD_REMOVED'

# Search every reachable revision but emit filenames only. This avoids placing
# any matching secret value or surrounding source line into CI logs/artifacts.
while IFS= read -r commit; do
  git grep -I -l -E "$secret_regex" "$commit" -- 2>/dev/null \
    | sed "s#^${commit}:#${commit}\t#" >> "$secrets_report" || true
done < <(git rev-list --all)

sort -u -o "$secrets_report" "$secrets_report"

path_count="$(wc -l < "$paths_report" | tr -d ' ')"
secret_path_count="$(wc -l < "$secrets_report" | tr -d ' ')"
{
  printf 'sensitive_path_objects=%s\n' "$path_count"
  printf 'suspected_secret_paths=%s\n' "$secret_path_count"
} > "$summary_report"

cat "$summary_report"

if [ "$path_count" -gt 0 ] || [ "$secret_path_count" -gt 0 ]; then
  printf 'Historical sensitive objects or credential paths require review.\n' >&2
  exit 2
fi

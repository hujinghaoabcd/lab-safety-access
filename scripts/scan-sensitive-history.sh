#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

report_dir="${1:-history-audit}"
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
    *.xlsx|*.xls|*.db|*.sqlite|*.sqlite3|*.pem|*.key|*.p12|*.pfx|.env|*/.env|.env.*|*/.env.*)
      case "$lower_path" in
        .env.example|*/.env.example|*template*.xlsx|*template*.xls) continue ;;
      esac
      size="$(git cat-file -s "$object_id" 2>/dev/null || printf '?')"
      printf '%s\t%s\t%s\n' "$object_id" "$size" "$object_path" >> "$paths_report"
      ;;
  esac
done < <(git rev-list --objects --all)

sort -u -o "$paths_report" "$paths_report"

# Look for private-key blocks and source-code fallbacks that replace missing
# production secrets with string literals. The historical administrator
# password itself is intentionally no longer retained by the scanner after the
# repository rewrite. A sanitized marker may remain in rewritten legacy commits
# and must not be treated as a secret.
secret_regex="BEGIN ([A-Z ]+ )?PRIVATE KEY|process\\.env\\.JWT_SECRET[[:space:]]*\\|\\|[[:space:]]*['\"]|process\\.env\\.ADMIN_PASSWORD[[:space:]]*\\|\\|[[:space:]]*['\"]"
temporary_secret_paths="$report_dir/.suspected-secret-paths.tmp"
: > "$temporary_secret_paths"

while IFS= read -r commit; do
  git grep -I -l -E "$secret_regex" "$commit" -- 2>/dev/null \
    | sed -E 's/^[0-9a-f]{40}://' >> "$temporary_secret_paths" || true

  # Retain a regression check for a fixed administrator password without
  # storing the historical secret value itself. Rewritten legacy commits use
  # HISTORICAL_ADMIN_PASSWORD_REMOVED, which is an explicit safe placeholder.
  legacy_admin_path='backend/src/controllers/adminController.js'
  if git cat-file -e "$commit:$legacy_admin_path" 2>/dev/null; then
    legacy_admin_content="$(git show "$commit:$legacy_admin_path")"
    if printf '%s' "$legacy_admin_content" \
      | grep -Eq "password[[:space:]]*(===|!==|==|!=)[[:space:]]*['\"][^'\"]+['\"]" \
      && ! printf '%s' "$legacy_admin_content" \
        | grep -Eq "password[[:space:]]*(===|!==|==|!=)[[:space:]]*['\"]HISTORICAL_ADMIN_PASSWORD_REMOVED['\"]"; then
      printf '%s\n' "$legacy_admin_path" >> "$temporary_secret_paths"
    fi
  fi
done < <(git rev-list --all)

grep -v -E '^(\.github/|docs/|scripts/|backend/test/|README\.md$|deploy/bootstrap-centos9\.sh$)' \
  "$temporary_secret_paths" \
  | sort -u > "$secrets_report" || true
rm -f "$temporary_secret_paths"

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

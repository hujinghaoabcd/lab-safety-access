#!/usr/bin/env bash
set -euo pipefail

# Destructive Git-history maintenance tool.
#
# Run only from a fresh --mirror clone. By default this script performs the
# rewrite and local verification but does NOT push rewritten refs. Remote force
# push requires both explicit confirmation variables below.

if [ "$(git rev-parse --is-bare-repository 2>/dev/null || true)" != "true" ]; then
  echo "ERROR: run this script from a fresh 'git clone --mirror' repository." >&2
  exit 1
fi

if ! command -v git-filter-repo >/dev/null 2>&1 && ! git filter-repo --help >/dev/null 2>&1; then
  echo "ERROR: git-filter-repo is required." >&2
  echo "Install it first, for example: python3 -m pip install --user git-filter-repo" >&2
  exit 1
fi

historical_admin_password="${HISTORICAL_ADMIN_PASSWORD_VALUE:-}"
if [ -z "$historical_admin_password" ]; then
  echo "ERROR: HISTORICAL_ADMIN_PASSWORD_VALUE is required for the confirmed historical credential replacement." >&2
  exit 1
fi

origin_url="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$origin_url" ]; then
  echo "ERROR: origin remote is required." >&2
  exit 1
fi

# Rewrite source branches and tags, but deliberately preserve the orphan
# deployment-artifact branch. GitHub pull-request refs are server-managed and
# are not force-pushed by this script.
mapfile -t rewrite_refs < <(
  git for-each-ref --format='%(refname)' refs/heads refs/tags \
    | grep -v '^refs/heads/deploy-artifacts$' \
    | sort
)

if [ "${#rewrite_refs[@]}" -eq 0 ]; then
  echo "ERROR: no source branches or tags found to rewrite." >&2
  exit 1
fi

printf 'Refs selected for rewrite:\n'
printf '  %s\n' "${rewrite_refs[@]}"
printf '\nExcluded ref:\n  refs/heads/deploy-artifacts\n\n'

replacement_file="$(mktemp)"
cleanup() {
  rm -f "$replacement_file"
}
trap cleanup EXIT

# The historical password value is supplied only at execution time so the
# current repository does not retain the leaked literal merely to purge it.
printf 'literal:%s==>HISTORICAL_ADMIN_PASSWORD_REMOVED\n' "$historical_admin_password" > "$replacement_file"
cat >> "$replacement_file" <<'EOF'
regex:process\.env\.JWT_SECRET\s*\|\|\s*['\"][^'\"]*['\"]==>process.env.JWT_SECRET
regex:process\.env\.ADMIN_PASSWORD\s*\|\|\s*['\"][^'\"]*['\"]==>process.env.ADMIN_PASSWORD
EOF

# Remove the confirmed personal-data workbook and rewrite confirmed weak
# credential fallbacks without printing any historical credential value.
git filter-repo --force \
  --path 'admin-web/src/assets/Student-2021-10-03.xlsx' \
  --invert-paths \
  --replace-text "$replacement_file" \
  --refs "${rewrite_refs[@]}"

# git-filter-repo may remove origin as a safety feature; restore only the saved
# URL so verification and the optional push use the exact original repository.
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$origin_url"
fi

# Recompute refs after rewrite because commit IDs changed.
mapfile -t rewritten_refs < <(
  git for-each-ref --format='%(refname)' refs/heads refs/tags \
    | grep -v '^refs/heads/deploy-artifacts$' \
    | sort
)

# Verify the same classes of historical risk as scan-sensitive-history.sh,
# scoped to rewritten source refs. Blob contents and credential values are never
# printed.
sensitive_path_count=0
while IFS=' ' read -r _object_id object_path; do
  [ -n "${object_path:-}" ] || continue
  lower_path="$(printf '%s' "$object_path" | tr '[:upper:]' '[:lower:]')"
  case "$lower_path" in
    *.xlsx|*.xls|*.db|*.sqlite|*.sqlite3|*.pem|*.key|*.p12|*.pfx|.env|*/.env|.env.*|*/.env.*)
      case "$lower_path" in
        .env.example|*/.env.example|*template*.xlsx|*template*.xls) continue ;;
      esac
      sensitive_path_count=$((sensitive_path_count + 1))
      ;;
  esac
done < <(git rev-list --objects "${rewritten_refs[@]}")

escaped_historical_admin_password="$(
  HISTORICAL_ADMIN_PASSWORD_VALUE="$historical_admin_password" python3 - <<'PY'
import os
import re
print(re.escape(os.environ['HISTORICAL_ADMIN_PASSWORD_VALUE']), end='')
PY
)"
secret_regex="BEGIN ([A-Z ]+ )?PRIVATE KEY|${escaped_historical_admin_password}|process\\.env\\.JWT_SECRET[[:space:]]*\\|\\|[[:space:]]*['\"]|process\\.env\\.ADMIN_PASSWORD[[:space:]]*\\|\\|[[:space:]]*['\"]"
suspected_secret_paths="$(mktemp)"
trap 'rm -f "$replacement_file" "$suspected_secret_paths"' EXIT
: > "$suspected_secret_paths"

while IFS= read -r commit; do
  git grep -I -l -E "$secret_regex" "$commit" -- 2>/dev/null \
    | sed -E 's/^[0-9a-f]{40}://' >> "$suspected_secret_paths" || true
done < <(git rev-list "${rewritten_refs[@]}")

grep -v -E '^(\.github/|docs/|scripts/|backend/test/|README\.md$|deploy/bootstrap-centos9\.sh$)' \
  "$suspected_secret_paths" > "${suspected_secret_paths}.filtered" || true
mv "${suspected_secret_paths}.filtered" "$suspected_secret_paths"

secret_path_count="$(sort -u "$suspected_secret_paths" | sed '/^$/d' | wc -l | tr -d ' ')"

printf 'Post-rewrite verification: sensitive_path_objects=%s, suspected_secret_paths=%s\n' \
  "$sensitive_path_count" "$secret_path_count"

if [ "$sensitive_path_count" -ne 0 ] || [ "$secret_path_count" -ne 0 ]; then
  echo "ERROR: rewritten source refs still contain sensitive-history findings; nothing was pushed." >&2
  exit 2
fi

if [ "${CONFIRM_HISTORY_REWRITE:-NO}" != "YES" ] || [ "${ALLOW_FORCE_PUSH:-NO}" != "YES" ]; then
  echo "Local rewrite and verification succeeded."
  echo "Remote refs were NOT modified."
  echo "To force-push the verified rewrite, rerun from a fresh mirror with both confirmation variables enabled."
  exit 0
fi

echo "Both destructive-operation confirmations are present; force-pushing rewritten refs."
# A --mirror clone configures origin as a mirror remote. Disable that push mode
# before sending explicit per-ref refspecs; otherwise Git rejects the refspecs.
git config remote.origin.mirror false
for ref in "${rewritten_refs[@]}"; do
  git push --force origin "$ref:$ref"
done

echo "Rewritten branches/tags were pushed."
echo "Next: rotate JWT/admin credentials, reclone local copies, rerun CI/history audit, and contact GitHub Support if cached views or pull-request refs must also be purged."

#!/bin/sh
set -eu

base_url="${PRODUCTION_BASE_URL:-https://abidinyildiz.com}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

verify_health() {
  endpoint="$1"
  expected_status="$2"
  body_file="$tmp_dir/$(printf '%s' "$endpoint" | tr '/' '_').json"
  http_status="$(curl --silent --show-error --location \
    --output "$body_file" \
    --write-out '%{http_code}' \
    "$base_url$endpoint")"

  [ "$http_status" = "200" ] || {
    echo "$endpoint HTTP $http_status döndürdü." >&2
    exit 1
  }

  jq -e --arg expected "$expected_status" '.status == $expected' "$body_file" >/dev/null
  echo "PRODUCTION_CHECK_OK endpoint=$endpoint status=$expected_status http=200"
}

verify_health "/api/health/live" "ok"
verify_health "/api/health/ready" "ready"

login_status="$(curl --silent --show-error --location \
  --output /dev/null \
  --write-out '%{http_code}' \
  "$base_url/login")"
[ "$login_status" = "200" ] || {
  echo "/login HTTP $login_status döndürdü." >&2
  exit 1
}
echo "PRODUCTION_CHECK_OK endpoint=/login http=200"

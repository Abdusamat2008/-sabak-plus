#!/usr/bin/env bash
# Единый прогон: SQL-схемы на чистой БД + все браузерные тесты. Нужны: postgres, node, playwright (глобально).
set -u
cd "$(dirname "$0")/.."
export NODE_PATH=$(npm root -g)
(curl -s -o /dev/null localhost:8765 || (nohup python3 -m http.server 8765 >/dev/null 2>&1 &)); sleep 1
fail=0
for t in smoke demo v06 v07 v08 v11 v12 v13 xss chron; do
  echo "== $t"; node tests/$t.test.js 2>&1 | tail -3 || fail=1
  [ "${PIPESTATUS[0]}" -ne 0 ] && fail=1
done
echo "SQL: выполните supabase/schema_v2..v11.sql на чистой БД и tests_v*.sql (см. docs/DEVELOPMENT.md)"
[ $fail -eq 0 ] && echo "ВСЁ ЗЕЛЁНОЕ" || { echo "ЕСТЬ ПАДЕНИЯ"; exit 1; }

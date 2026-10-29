# Автотесты SABAK+

Запускать из корня проекта, когда сайт открыт на http://localhost:8765 (`npm run serve` в соседнем терминале). Нужны `npm i` и `npx playwright install chromium`.

| Команда | Что проверяет | Что нужно |
|---|---|---|
| `npm run test:smoke` | вход, регистрация (экраны), демо запускается без ошибок | только сайт |
| `npm run test:demo` | демо-режим: оценки, фото, «дело», аналитика, экспорт, офлайн | только сайт |
| `npm run test:privacy` | окно «Политика данных» (RU/KY) | только сайт |
| `npm run test:photo` | серверные проверки фото (`supabase/functions/verify-photo/core.js`) на примерах из `tests/img` | `jpeg-js` |
| `npm run test:live` | живой режим целиком: цепочка доверия, RLS, очередь, фото, «дело» | локальный Postgres 16 + PostgREST + схема `supabase/schema_v2.sql` (см. комментарии в файле; порты 5544/3001); `CONFIRM=1` проверяет вход с кодом из письма |

Скриншоты тестов складываются в `tests/out/`.

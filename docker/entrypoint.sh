#!/bin/sh
# Точка входа контейнера фабрики.
#
# Единственная задача — увести накопительные файлы состояния из корня
# репозитория в том /app/state.
#
# Зачем. providers/agent_usage.py, providers/agy.py и providers/quota_probe.py
# держат историю расхода и квот в файлах рядом с кодом:
#
#     Path(__file__).resolve().parent.parent / ".agy_quota_history.json"
#
# Путь захардкожен, переменной окружения для него нет. В контейнере корень
# репозитория — это слой образа, то есть при каждом деплое история обнулялась
# бы. Симлинк решает это без правок кода: все три модуля пишут через
# `open(path, "w")`, то есть в существующий файл по ссылке, а не подменяют его
# atomic-rename'ом — симлинк переживает запись.

set -e

STATE_DIR=/app/state
mkdir -p "$STATE_DIR"

for name in \
    .agent_usage_history.json \
    .agy_quota_history.json \
    .agy_quota_live.json \
    .token_usage_totals.json
do
    target="$STATE_DIR/$name"
    link="/app/$name"

    # Первый запуск: если в образе лежал файл с данными, а в томе пусто —
    # переносим, чтобы не потерять то, что приехало из репозитория.
    if [ ! -e "$target" ] && [ -f "$link" ] && [ ! -L "$link" ]; then
        cp "$link" "$target"
    fi

    # Пустышку не создаём намеренно. Все три читателя проверяют файл через
    # .exists()/.is_file() — а это следует по ссылке и на висячем симлинке
    # даёт False, то есть ровно «истории пока нет». Придуманный `{}` вместо
    # этого сломал бы agent_usage.py, который ждёт список.
    if [ ! -L "$link" ]; then
        rm -f "$link"
        ln -s "$target" "$link"
    fi
done

exec "$@"

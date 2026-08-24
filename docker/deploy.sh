#!/usr/bin/env bash
# Разворачивает новую версию фабрики на мини-ПК.
#
# Запускается НЕ из workflow, а systemd-юнитом на хосте (docker/systemd/):
# job в раннере только трогает файл-триггер. Благодаря этому раннеру не нужен
# /var/run/docker.sock — то есть код из workflow не может управлять демоном
# Docker хоста, на котором рядом крутятся раннеры организации.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zavod2}"
LOCK="/tmp/zavod2-deploy.lock"

log() { echo "[deploy $(date '+%H:%M:%S')] $*"; }

# Два деплоя подряд (быстрые пуши) не должны пересечься на docker build.
exec 9>"$LOCK"
if ! flock -n 9; then
    log "деплой уже идёт — выхожу"
    exit 0
fi

cd "$REPO_DIR"

log "забираю изменения"
git fetch --prune origin

# Именно --ff-only, а не reset --hard. В workspace/ лежат сгенерированные игры,
# они трекаются git-ом (правило репозитория), и часть из них в момент деплоя
# может быть ещё не закоммичена. reset --hard стёр бы их молча.
if ! git merge --ff-only origin/main; then
    log "ОШИБКА: fast-forward не прошёл."
    log "Скорее всего в рабочей копии есть незакоммиченные игры в workspace/."
    log "Разбери руками — насильно перезаписывать я не буду:"
    log "  cd $REPO_DIR && git status"
    exit 1
fi

log "версия: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# Пересобираем и перезапускаем ТОЛЬКО фабрику.
#
# runner трогать нельзя: деплой запущен джобом, который прямо сейчас в этом
# раннере и выполняется. Перезапуск контейнера убил бы собственный job, и
# GitHub показал бы упавшую сборку при удачном деплое. Раннер обновляется
# руками: docker compose up -d --build runner
log "собираю образ"
docker compose build factory

log "перезапускаю фабрику"
docker compose up -d --no-deps factory

# Слои от прошлых сборок иначе копятся гигабайтами: на этой машине кэш сборки
# уже разрастался до десятков ГБ.
log "убираю висячие образы"
docker image prune -f >/dev/null

log "готово"
docker compose ps factory

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

# Исход деплоя для того, кто его запросил.
#
# Job в раннере умеет только тронуть файл-триггер: всё остальное происходит
# здесь, на хосте, вне GitHub. Значит и падение происходит вне GitHub — деплой
# вставал на `git merge --ff-only`, а в Actions горела зелёная галочка. «CI
# зелёный» переставало означать «обновилось», и узнать об этом можно было
# только глазами на экране фабрики.
#
# Поэтому исход пишется обратно в тот же каталог, который видит раннер
# (.deploy смонтирован ему как /deploy), а job его дожидается. Лог полного
# прогона кладётся рядом: journalctl раннеру недоступен, а без хвоста лога
# «деплой упал» — сообщение ни о чём.
STATE_DIR="${STATE_DIR:-$REPO_DIR/.deploy}"
STATUS="$STATE_DIR/status"
STEP_FILE="$STATE_DIR/step"
LOG_FILE="$STATE_DIR/last.log"
STARTED_AT="$(date +%s)"
STEP="старт"

mkdir -p "$STATE_DIR"
# Лог именно перезаписывается: job читает его как хвост своего прогона, и
# приклеенный хвост предыдущего увёл бы разбор не туда.
exec > >(tee "$LOG_FILE") 2>&1

log() { echo "[deploy $(date '+%H:%M:%S')] $*"; }

# Текущий шаг — отдельным файлом, а не только в итоговом статусе.
#
# Итог пишется на выходе, то есть через минуты. До него тот, кто ждёт деплой,
# не знает даже, дошло ли дело до сборки образа: лог может молчать, пока docker
# тянет слои. Один короткий файл превращает ожидание в наблюдение.
step() {
    STEP="$1"
    printf '%s\t%s\n' "$STEP" "$(date +%s)" > "$STEP_FILE.tmp" 2>/dev/null || return 0
    mv -f "$STEP_FILE.tmp" "$STEP_FILE" 2>/dev/null || true
}

# Исход пишется на ЛЮБОМ выходе, включая падение по `set -e` и по сигналу.
# Запись только на успешном пути означала бы, что упавший деплой неотличим от
# не начинавшегося, и job ждал бы его до таймаута.
write_status() {
    local code="$1"
    local outcome="fail"
    [ "$code" = "0" ] && outcome="ok"
    local head="unknown"
    head="$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
    # Во временный файл и переименованием: job читает этот файл в цикле и не
    # должен поймать его наполовину записанным.
    cat > "$STATUS.tmp" <<EOF
sha=$head
outcome=$outcome
code=$code
step=$STEP
started=$STARTED_AT
finished=$(date +%s)
EOF
    mv -f "$STATUS.tmp" "$STATUS"
    rm -f "$STEP_FILE" 2>/dev/null || true
}

# Два деплоя подряд (быстрые пуши) не должны пересечься на docker build.
#
# Ждём освобождения, а не выходим сразу. Выход означал бы потерянный деплой:
# второй пуш пришёл, пока собирался первый, и его изменения не доехали бы до
# следующего пуша вообще. Ожидание безопасно — цикл в конце всё равно
# проверит, не сдвинулся ли origin/main за это время.
exec 9>"$LOCK"
step "ожидание предыдущего деплоя"
if ! flock -w 1800 9; then
    log "ОШИБКА: предыдущий деплой не закончился за полчаса — выхожу"
    exit 1
fi

cd "$REPO_DIR"

# Игры на диске переживают любой деплой.
#
# Раньше сгенерированные игры ехали в git вместе с кодом. Когда их оттуда
# убирают, merge видит удаление файлов и стирает их из рабочего дерева — то
# есть один пуш выносит всю папку игр на мини-ПК. Локальные правки (а фабрика
# пишет в игры непрерывно) при этом ещё и не дают merge пройти: он встаёт с
# «your local changes would be overwritten».
#
# Поэтому перед таким merge папки игр уводятся в сторону обычным mv — это
# переименование внутри той же файловой системы, мгновенное и для гигабайта.
# git видит файлы отсутствующими, спокойно проводит удаление в индексе, после
# чего папки возвращаются на место уже нетрекаемыми.
#
# Условие намеренно общее, а не «одноразовая миграция»: деплою вообще незачем
# уметь удалять игры. Игру удаляют кнопкой в фабрике, а не пушем в main.
GAME_DIRS="workspace output"
STASHED_DIR=""

restore_games() {
    [ -n "$STASHED_DIR" ] || return 0
    for dir in $GAME_DIRS; do
        if [ -d "$STASHED_DIR/$dir" ]; then
            rm -rf "${REPO_DIR:?}/$dir"
            mv "$STASHED_DIR/$dir" "$REPO_DIR/$dir"
        fi
    done
    rmdir "$STASHED_DIR" 2>/dev/null || true
    STASHED_DIR=""
}

# Возврат обязан случиться и при падении посреди merge — иначе игры останутся
# лежать во временном каталоге, а фабрика поднимется пустой.
trap 'code=$?; restore_games; write_status "$code"' EXIT

merge_would_delete_games() {
    git diff --name-only --diff-filter=D HEAD origin/main -- $GAME_DIRS 2>/dev/null | grep -q .
}

stash_games() {
    STASHED_DIR="$(mktemp -d "$REPO_DIR/../.zavod2-games-XXXXXX")"
    for dir in $GAME_DIRS; do
        [ -d "$REPO_DIR/$dir" ] && mv "$REPO_DIR/$dir" "$STASHED_DIR/$dir"
    done
    log "игры уведены в $STASHED_DIR на время merge — с диска они не денутся"
}

deploy_once() {
step "git fetch"
log "забираю изменения"
git fetch --prune origin

step "перенос игр из git"
if merge_would_delete_games; then
    log "входящий коммит снимает игры с учёта git"
    stash_games
fi

# Именно --ff-only, а не reset --hard. В workspace/ лежат сгенерированные игры,
# они трекаются git-ом (правило репозитория), и часть из них в момент деплоя
# может быть ещё не закоммичена. reset --hard стёр бы их молча.
step "git merge --ff-only"
if ! git merge --ff-only origin/main; then
    log "ОШИБКА: fast-forward не прошёл — в рабочей копии есть свои коммиты."
    log "Разбери руками — насильно перезаписывать я не буду:"
    log "  cd $REPO_DIR && git status && git log --oneline origin/main..HEAD"
    exit 1
fi

# Вернуть до сборки образа: docker compose build читает рабочее дерево.
restore_games

log "версия: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# Пересобираем и перезапускаем ТОЛЬКО фабрику.
#
# runner трогать нельзя: деплой запущен джобом, который прямо сейчас в этом
# раннере и выполняется. Перезапуск контейнера убил бы собственный job, и
# GitHub показал бы упавшую сборку при удачном деплое. Раннер обновляется
# руками: docker compose up -d --build runner
step "docker compose build"
log "собираю образ"
docker compose build factory

step "docker compose up"
log "перезапускаю фабрику"
docker compose up -d --no-deps factory

# Слои от прошлых сборок иначе копятся гигабайтами: на этой машине кэш сборки
# уже разрастался до десятков ГБ.
log "убираю висячие образы"
docker image prune -f >/dev/null

log "готово"
docker compose ps factory
}

# Догоняем, если во время сборки прилетел ещё один пуш.
#
# Причина не гипотетическая, это случилось. Триггер — systemd .path с
# PathModified: пока сервис деплоя работает, юнит пути деактивирован, и запись
# в файл-триггер, случившаяся в этот момент, до systemd не доходит. Пуш
# считался задеплоенным, а на машине оставалась предыдущая версия — молча, с
# зелёной галочкой в GitHub.
#
# Поэтому после сборки перепроверяем origin/main своими глазами. Три круга —
# потолок: если пуши идут чаще, чем успевает собираться образ, догонять
# бесполезно, следующий деплой всё равно возьмёт самое свежее.
for attempt in 1 2 3; do
    deploy_once
    git fetch --prune --quiet origin
    if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
        break
    fi
    log "пока собирал, прилетел ещё пуш — иду на круг $((attempt + 1))"
done

step "готово"
# tee из `exec` — отдельный процесс, и без паузы последние строки лога могут
# не успеть долететь до файла раньше, чем job его прочитает.
sync || true

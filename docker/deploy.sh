#!/usr/bin/env bash
# Разворачивает новую версию фабрики на мини-ПК.
#
# Запускается по ssh из workflow (docker/deploy-command.sh — форсированная
# команда ключа) и вручную с самой машины. Оба пути одинаковы: скрипт печатает
# всё, что делает, в свой stdout, а ssh транслирует это прямо в лог Actions.
#
# Почему не как раньше. Раньше job трогал файл-триггер, systemd на хосте видел
# запись и запускал этот скрипт где-то в стороне, а job опрашивал файлы со
# статусом. Схема разъезжалась двумя способами сразу: пропущенный триггер
# (`.path` с `PathModified` глух, пока сервис работает) — деплой не случался
# вовсе; отчёт со старой версии скрипта — job ждал того, чего не будет. И то и
# другое выглядело как зелёная галочка при не обновившемся сайте.
#
# Теперь связь синхронная: ssh держит соединение до конца, код возврата
# скрипта — это код возврата шага. Терять сигнал больше негде.

set -euo pipefail

# ---------------------------------------------------------------------------
# Скрипт закрепляет сам себя копией до того, как что-то делать.
#
# bash читает файл скрипта по мере выполнения, а `git merge` ниже переписывает
# этот же файл. Дочитанное со сдвинутого смещения — это исполнение мусора
# посреди деплоя: класс отказов, который невозможно воспроизвести и незачем
# терпеть. Копия в /tmp от merge не зависит.
# ---------------------------------------------------------------------------
if [ "${ZAVOD_DEPLOY_PINNED:-}" != "1" ]; then
    pinned="$(mktemp /tmp/zavod2-deploy.XXXXXX)"
    cat "$0" > "$pinned"
    ZAVOD_DEPLOY_PINNED=1 ZAVOD_DEPLOY_PINNED_FILE="$pinned" exec bash "$pinned" "$@"
fi
# Удаляем сразу: bash продолжает читать уже открытый inode, а файл в /tmp не
# переживёт даже падения по сигналу.
if [ -n "${ZAVOD_DEPLOY_PINNED_FILE:-}" ]; then
    rm -f "$ZAVOD_DEPLOY_PINNED_FILE"
fi

REPO_DIR="${REPO_DIR:-/opt/zavod2}"
SITE_PORT="${SITE_PORT:-7860}"
CONTAINER="${FACTORY_CONTAINER:-zavod2-factory}"
LOCK="/tmp/zavod2-deploy.lock"

# Лог на хосте — для разбора задним числом, когда лог прогона в Actions уже
# ушёл по ротации. Основной канал теперь не он, а сам stdout.
STATE_DIR="${STATE_DIR:-$REPO_DIR/.deploy}"
LOG_FILE="$STATE_DIR/last.log"
if mkdir -p "$STATE_DIR" 2>/dev/null && : > "$LOG_FILE" 2>/dev/null; then
    exec > >(tee "$LOG_FILE") 2>&1
else
    exec 2>&1
fi

STEP="старт"
GROUP_OPEN=0

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Каждый шаг — свёрнутая группа в логе Actions. GitHub понимает эти маркеры от
# любого шага, поэтому «видно каждый шаг» получается без единого лишнего шага
# в самом workflow.
step() {
    close_group
    STEP="$1"
    echo "::group::$1"
    GROUP_OPEN=1
}

close_group() {
    if [ "$GROUP_OPEN" = "1" ]; then
        echo "::endgroup::"
        GROUP_OPEN=0
    fi
}

# ---------------------------------------------------------------------------
# Игры на диске переживают деплой. Это требование, а не пожелание.
#
# Защит три, и они разного рода.
#
# 1. Игры не в git (см. .gitignore) — значит git их и не трогает. Это главное:
#    всё остальное здесь на случай, если кто-то это свойство сломает.
# 2. Никаких `reset --hard` и `git clean`. Обе команды сносят нетрекаемое
#    молча и на успешном пути, то есть ровно там, где никто не смотрит.
# 3. Опись до и после. Пропавшая игра валит деплой с именами пропавших, а не
#    обнаруживается через неделю.
#
# Плюс разовый случай: коммит, снимающий игры с учёта git, merge проводит как
# удаление файлов — и выносит папку с диска. Такие папки уводятся в сторону
# обычным mv (переименование в пределах ФС, мгновенное и для гигабайта), а
# после merge возвращаются уже нетрекаемыми.
# ---------------------------------------------------------------------------
GAME_DIRS="workspace output"
STASHED_DIR=""
INVENTORY_BEFORE="$(mktemp /tmp/zavod2-games.XXXXXX)"

inventory() {
    for dir in $GAME_DIRS; do
        [ -d "$REPO_DIR/$dir" ] || continue
        find "$REPO_DIR/$dir" -mindepth 1 -maxdepth 1 -type d -printf "$dir/%P\n" 2>/dev/null
    done | grep -v '/\.factory$' | LC_ALL=C sort
}

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

stash_games() {
    STASHED_DIR="$(mktemp -d "$REPO_DIR/../.zavod2-games-XXXXXX")"
    for dir in $GAME_DIRS; do
        [ -d "$REPO_DIR/$dir" ] && mv "$REPO_DIR/$dir" "$STASHED_DIR/$dir"
    done
    log "игры уведены в $STASHED_DIR на время merge — с диска они не денутся"
}

merge_would_delete_games() {
    git diff --name-only --diff-filter=D HEAD origin/main -- $GAME_DIRS 2>/dev/null | grep -q .
}

# Возврат обязан случиться и при падении посреди merge, и по сигналу — иначе
# игры останутся во временном каталоге, а фабрика поднимется пустой.
on_exit() {
    code=$?
    restore_games
    close_group
    if [ "$code" != "0" ]; then
        echo "::error::Деплой упал на шаге «$STEP» (код $code). Версия в $REPO_DIR: $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
    fi
    rm -f "$INVENTORY_BEFORE" 2>/dev/null || true
    exit "$code"
}
trap on_exit EXIT

# ---------------------------------------------------------------------------
# Какой коммит от нас ждут.
#
# Форсированная команда ключа не принимает аргументов, но исходную команду ssh
# кладёт в SSH_ORIGINAL_COMMAND. Оттуда берётся sha — и в конце проверяется,
# что он действительно в рабочей копии. Без этого «деплой прошёл» означает
# лишь «что-то задеплоилось».
#
# Значение только читается и только как аргумент git, но проверка формата всё
# равно жёсткая: строка приходит снаружи.
# ---------------------------------------------------------------------------
WANT_SHA=""
case "${SSH_ORIGINAL_COMMAND:-}" in
    "deploy "*)
        candidate="${SSH_ORIGINAL_COMMAND#deploy }"
        case "$candidate" in
            *[!0-9a-f]* | "") ;;
            *) WANT_SHA="$candidate" ;;
        esac
        ;;
esac

step "Очередь"
# Два деплоя подряд не должны пересечься на docker build. Ждём, а не выходим:
# выход означал бы потерянный деплой — его изменения не доехали бы до
# следующего пуша вообще.
exec 9>"$LOCK"
if flock -n 9; then
    log "свободно, начинаю"
else
    log "идёт предыдущий деплой — жду его окончания (потолок полчаса)"
    if ! flock -w 1800 9; then
        echo "::error::Предыдущий деплой не закончился за полчаса. Смотреть: journalctl -u zavod2-deploy, docker ps"
        exit 1
    fi
    log "дождался"
fi

cd "$REPO_DIR"

step "Игры на диске"
inventory > "$INVENTORY_BEFORE"
log "найдено игр: $(wc -l < "$INVENTORY_BEFORE")"
sed 's/^/  · /' "$INVENTORY_BEFORE"

step "Обновление кода"
log "было: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
git fetch --prune origin

if merge_would_delete_games; then
    log "входящий коммит снимает игры с учёта git — увожу их из-под merge"
    stash_games
fi

# Именно --ff-only. reset --hard стёр бы незакоммиченное молча, а нам нужно
# наоборот: скорее встать с внятной ошибкой, чем что-то потерять.
if ! git merge --ff-only origin/main; then
    echo "::error::Fast-forward не прошёл: в рабочей копии на мини-ПК есть свои коммиты. Насильно перезаписывать не буду."
    echo "::error::Разобрать руками: cd $REPO_DIR && git status && git log --oneline origin/main..HEAD"
    exit 1
fi

# Вернуть до сборки: docker compose build читает рабочее дерево.
restore_games

# «Already up to date» при HEAD впереди origin/main — тоже успешный merge, и
# именно так молча разъезжаются машина и репозиторий: на мини-ПК остаётся
# правка, сделанная руками год назад, а деплой каждый раз зелёный.
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "::warning::В рабочей копии есть коммиты, которых нет в main:"
    git log --oneline origin/main..HEAD | head -n 5 | sed 's/^/::warning::  · /'
    echo "::warning::Фабрика поднимется вместе с ними. Убрать: cd $REPO_DIR && git reset --hard origin/main — игры не в git и не пострадают."
fi

log "стало: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

if [ -n "$WANT_SHA" ]; then
    if git merge-base --is-ancestor "$WANT_SHA" HEAD 2>/dev/null; then
        log "запрошенный коммит ${WANT_SHA:0:12} в рабочей копии"
    else
        echo "::error::После обновления запрошенного коммита $WANT_SHA в рабочей копии нет."
        echo "::error::Так бывает после force-push в main. Проверить: cd $REPO_DIR && git log --oneline -5"
        exit 1
    fi
fi

step "Сборка образа"
# Пересобираем ТОЛЬКО фабрику. Контейнер раннера трогать нельзя: в нём прямо
# сейчас выполняется job, который этот деплой и запустил. Раннер обновляется
# руками: docker compose up -d --build runner
docker compose build --progress plain factory

step "Перезапуск фабрики"
docker compose up -d --no-deps factory
docker compose ps factory

step "Уборка"
# Слои от прошлых сборок иначе копятся гигабайтами: на этой машине кэш сборки
# уже разрастался до десятков ГБ.
docker image prune -f
df -h "$REPO_DIR" | tail -n 1

step "Проверка"
# Без этого «деплой прошёл» означало бы «docker не выругался». Контейнер,
# упавший на старте (сломанный .env, занятый порт, битая миграция), — это
# ровно та ситуация, ради которой шаг и нужен.
ok=""
for _ in $(seq 1 45); do
    state="$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "нет")"
    code="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$SITE_PORT/healthz" 2>/dev/null || true)"
    if [ "$state" = "running" ] && [ "$code" = "200" ]; then
        ok="1"
        break
    fi
    sleep 2
done

if [ -z "$ok" ]; then
    echo "::error::Фабрика не ответила на /healthz за 90 с. Состояние контейнера: ${state:-нет}, http: ${code:-нет ответа}"
    docker compose logs --tail 60 factory || true
    exit 1
fi
log "фабрика отвечает: http://127.0.0.1:$SITE_PORT/healthz → 200"

# Опись после. Сравниваем именно имена, а не количество: обмен «одна пропала,
# одна появилась» количество не меняет.
after="$(mktemp /tmp/zavod2-games.XXXXXX)"
inventory > "$after"
lost="$(LC_ALL=C comm -23 "$INVENTORY_BEFORE" "$after" || true)"
rm -f "$after"
if [ -n "$lost" ]; then
    echo "::error::С диска пропали игры за время деплоя:"
    printf '%s\n' "$lost" | sed 's/^/::error::  · /'
    exit 1
fi
log "игры на месте: $(wc -l < "$INVENTORY_BEFORE") шт."

close_group
echo "✅ Фабрика обновлена: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

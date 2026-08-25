#!/usr/bin/env bash
# Разворачивает новую схему деплоя на мини-ПК одной командой:
#
#   curl -fsSL https://raw.githubusercontent.com/Choclate-games/zavod2/main/docker/bootstrap.sh -o /tmp/b.sh && bash /tmp/b.sh
#
# Существует ради одного: чтобы не пришлось помнить, что обновляться здесь
# надо НЕ через `git pull`.
#
# Пока игры числятся в git, входящий коммит снимает их с учёта, а merge
# проводит снятие как удаление файлов — то есть обычный pull выносит папку игр
# с диска, молча и с кодом 0. Новый deploy.sh уводит игры из-под merge сам,
# поэтому первым делом запускается именно он, взятый прямо из origin, а не
# лежащая на машине старая копия.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zavod2}"

say() { echo; echo "── $*"; }
die() { echo; echo "  ❌ $*" >&2; exit 1; }

[ "$(id -u)" != "0" ] || die "запускать надо от обычного пользователя (oem), а не от root: ключ заводится в его \$HOME"
[ -d "$REPO_DIR/.git" ] || die "в $REPO_DIR нет клона репозитория (переопределяется переменной REPO_DIR)"

cd "$REPO_DIR"

say "1/3 · забираю main"
git fetch --prune origin
echo "  на машине: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
echo "  в origin:  $(git rev-parse --short origin/main) — $(git log -1 --pretty=%s origin/main)"

if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
    say "2/3 · код уже свежий, обновление пропускаю"
else
    say "2/3 · обновляю код новым скриптом (не pull — он снёс бы игры)"
    RUNNER="$(mktemp /tmp/zavod2-deploy-boot.XXXXXX)"
    git show origin/main:docker/deploy.sh > "$RUNNER"
    trap 'rm -f "$RUNNER"' EXIT
    bash "$RUNNER"
    rm -f "$RUNNER"
    trap - EXIT
fi

say "3/3 · настраиваю ключ деплоя"
[ -x "$REPO_DIR/docker/setup-deploy.sh" ] || die "после обновления нет $REPO_DIR/docker/setup-deploy.sh — что-то пошло не так, смотри вывод выше"
bash "$REPO_DIR/docker/setup-deploy.sh"

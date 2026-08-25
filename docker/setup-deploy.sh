#!/usr/bin/env bash
# Разовая настройка автодеплоя на мини-ПК.
#
#   bash docker/setup-deploy.sh
#
# Если репозиторий на машине ещё не обновлён, обновлять его надо НЕ через
# `git pull`: пока игры числятся в git, входящий коммет снимает их с учёта, а
# merge проводит это как удаление файлов — то есть выносит папку игр с диска.
# Безопасный способ — прогнать новый deploy.sh прямо из origin, он уводит игры
# из-под merge сам:
#
#   git fetch origin
#   git show origin/main:docker/deploy.sh > /tmp/zavod2-deploy.sh && bash /tmp/zavod2-deploy.sh
#
# Что делает: заводит ключ, которым контейнер раннера сможет попросить хост
# развернуть новую версию, и проверяет, что этот путь действительно работает —
# из самого контейнера, а не «по идее должно».
#
# Ключ ограничен форсированной командой (docker/deploy-command.sh): им нельзя
# открыть сессию, пробросить порт или выполнить что-то своё. Ровно одна
# кнопка «разверни» — то же самое, что раньше давал файл-триггер, только
# синхронно и с живым логом в Actions.
#
# Скрипт идемпотентен: повторный запуск ничего не ломает и заново печатает
# ключ, если он потерялся.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY="$HOME/.ssh/zavod2-deploy"
AUTHORIZED="$HOME/.ssh/authorized_keys"
COMMAND_SCRIPT="$REPO_DIR/docker/deploy-command.sh"
MARK="zavod2-deploy"
SSH_PORT="${DEPLOY_PORT:-22}"
RUNNER="${RUNNER_CONTAINER:-zavod2-runner}"

say()  { echo; echo "── $*"; }
ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
die()  { echo; echo "  ❌ $*" >&2; exit 1; }

[ "$(id -u)" != "0" ] || die "запускать надо от обычного пользователя (oem), а не от root: ключ заводится в его \$HOME"
[ -x "$COMMAND_SCRIPT" ] || die "нет $COMMAND_SCRIPT — репозиторий на машине старее main.
     Обновить безопасно (git pull здесь снёс бы игры — они ещё числятся в git):
       cd $REPO_DIR && git fetch origin
       git show origin/main:docker/deploy.sh > /tmp/zavod2-deploy.sh && bash /tmp/zavod2-deploy.sh"

say "1/6 · sshd на хосте"
if systemctl is-active --quiet ssh || systemctl is-active --quiet sshd; then
    ok "работает"
else
    die "sshd не запущен. Поставить и включить: sudo apt install -y openssh-server && sudo systemctl enable --now ssh"
fi
UFW="$(command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null || true)"
if [ "${UFW#*Status: active}" != "$UFW" ]; then
    warn "включён ufw — если проверка связи ниже не пройдёт, дело в нём: sudo ufw allow from 172.16.0.0/12 to any port $SSH_PORT"
fi

say "2/6 · ключ деплоя"
if [ -f "$KEY" ]; then
    ok "уже есть: $KEY"
else
    install -d -m 700 "$HOME/.ssh"
    ssh-keygen -t ed25519 -N '' -C "$MARK" -f "$KEY" >/dev/null
    ok "создан: $KEY"
fi

say "3/6 · доступ ключу — только команда деплоя"
# `restrict` выключает всё разом: сессию, проброс портов, агент, X11, tty.
# Даже если ключ утечёт, им нельзя сделать ничего, кроме запуска деплоя.
LINE="command=\"$COMMAND_SCRIPT\",restrict $(cat "$KEY.pub")"
install -d -m 700 "$HOME/.ssh"
touch "$AUTHORIZED"
chmod 600 "$AUTHORIZED"
# Старую строку этого же ключа убираем: иначе при смене пути к скрипту
# осталась бы действовать первая, а правки бы «не применялись».
if grep -q "$MARK" "$AUTHORIZED" 2>/dev/null; then
    grep -v "$MARK" "$AUTHORIZED" > "$AUTHORIZED.tmp" || true
    mv "$AUTHORIZED.tmp" "$AUTHORIZED"
    chmod 600 "$AUTHORIZED"
fi
printf '%s\n' "$LINE" >> "$AUTHORIZED"
ok "прописан вызов $COMMAND_SCRIPT"

say "4/6 · старый триггер через systemd"
# Файл-триггер больше не нужен: job теперь ходит по ssh и ждёт результата сам.
# Оставленный включённым .path запускал бы деплой ещё и по старой записи —
# два деплоя на один пуш.
# Подстановкой, а не трубой в `grep -q`: та закрывает трубу на первой строке,
# писатель получает SIGPIPE, и под pipefail это читается как «юнита нет» —
# то есть шаг молча пропускается.
UNITS="$(systemctl list-unit-files 2>/dev/null || true)"
if [ "${UNITS#*zavod2-deploy.path}" != "$UNITS" ]; then
    if sudo -n true 2>/dev/null || [ -t 0 ]; then
        sudo systemctl disable --now zavod2-deploy.path || warn "не удалось выключить zavod2-deploy.path — сделай руками"
        ok "zavod2-deploy.path выключен"
    else
        warn "нужен sudo: sudo systemctl disable --now zavod2-deploy.path"
    fi
else
    ok "не установлен"
fi
echo "  (zavod2-deploy.service остаётся — им удобно развернуть руками: sudo systemctl start zavod2-deploy)"

say "5/6 · контейнер раннера"
# Раннеру нужны две новые вещи: клиент ssh в образе и имя host.docker.internal,
# по которому из контейнера виден хост. Обе приезжают пересборкой.
docker compose build runner
docker compose up -d --force-recreate --no-deps runner
for _ in $(seq 1 30); do
    [ "$(docker inspect -f '{{.State.Status}}' "$RUNNER" 2>/dev/null || echo нет)" = "running" ] && break
    sleep 1
done
docker exec "$RUNNER" sh -c 'command -v ssh >/dev/null' || die "в контейнере раннера нет ssh — пересборка не подхватилась"
ok "раннер поднят, ssh внутри есть"

say "6/6 · проверка связи — из самого контейнера раннера"
# Смысл именно в этом шаге: он проходит ровно тот путь, которым пойдёт
# workflow. Проверка «с хоста на localhost» доказывала бы только половину.
# Скрипт пробы передаётся аргументом, а не через stdin: stdin занят самим
# ключом — так он не оседает ни в аргументах, ни в истории команд.
PROBE_SRC="$(cat <<'PROBE'
set -euo pipefail
port="$1"; user="$2"
install -d -m 700 "$HOME/.ssh"
cat > "$HOME/.ssh/probe-key"
chmod 600 "$HOME/.ssh/probe-key"
rc=0
ssh -i "$HOME/.ssh/probe-key" \
    -o StrictHostKeyChecking=accept-new \
    -o BatchMode=yes -o ConnectTimeout=10 \
    -p "$port" "$user@host.docker.internal" ping || rc=$?
rm -f "$HOME/.ssh/probe-key"
exit $rc
PROBE
)"
if docker exec -i -u runner "$RUNNER" bash -c "$PROBE_SRC" _ "$SSH_PORT" "$USER" < "$KEY"
then
    ok "контейнер раннера достучался до хоста и получил ответ"
else
    die "контейнер раннера не достучался до хоста.
     Проверить по порядку:
       docker exec $RUNNER getent hosts host.docker.internal   ← имя должно резолвиться
       sudo ss -lntp | grep :$SSH_PORT                          ← sshd слушает не только 127.0.0.1
       sudo tail -n 30 /var/log/auth.log                        ← что сказал sshd про ключ"
fi

cat <<INSTRUCTIONS

═══════════════════════════════════════════════════════════════════════
Осталось одно действие — в браузере.

1. Открой   https://github.com/Choclate-games/zavod2/settings/secrets/actions
2. New repository secret
     Name:   DEPLOY_SSH_KEY
     Secret: весь блок ниже, вместе со строками BEGIN и END
3. Пушни что-нибудь в main — деплой пойдёт сам, каждый шаг будет виден
   в логе прогона.

Если хост, пользователь или порт отличаются от умолчаний
($(hostname) / $USER / $SSH_PORT), задай переменные репозитория
DEPLOY_HOST, DEPLOY_USER, DEPLOY_PORT там же, во вкладке Variables.
═══════════════════════════════════════════════════════════════════════

INSTRUCTIONS
cat "$KEY"
echo
echo "(это приватный ключ; он умеет ровно одно — запустить деплой на этой машине)"

#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPO:?GITHUB_REPO не задан (ожидается owner/repo)}"
: "${GITHUB_PAT:?GITHUB_PAT не задан в .env}"

RUNNER_NAME="${RUNNER_NAME:-minipc-zavod2}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,zavod2}"

cd /home/runner

log() { echo "[entrypoint] $*"; }

# Токен регистрации живёт час, хранить его в .env бессмысленно. Берём свежий
# на каждый старт — контейнер самовосстанавливается после перезапуска,
# перезагрузки хоста и завершения ephemeral-джоба.
#
# Эндпоинт репозиторный, а не организационный: раннер обслуживает ровно один
# репозиторий. PAT нужен со scope `repo` (для fine-grained — Administration:
# Read and write на этом репозитории).
get_registration_token() {
  curl -fsSL -X POST \
    -H "Authorization: Bearer ${GITHUB_PAT}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${GITHUB_REPO}/actions/runners/registration-token" \
  | jq -r .token
}

deregister() {
  local token
  if token=$(get_registration_token 2>/dev/null) && [ -n "$token" ] && [ "$token" != "null" ]; then
    ./config.sh remove --token "$token" || log "снятие с регистрации не удалось"
  fi
  # Если снятие не прошло (нет сети, протух PAT), локальный конфиг всё равно
  # надо убрать: иначе следующий старт упадёт на "already configured".
  rm -f .runner .credentials .credentials_rsaparams
}

on_stop() {
  log "получен сигнал остановки"
  if [ -n "${RUNNER_PID:-}" ]; then
    kill -TERM "$RUNNER_PID" 2>/dev/null || true
    wait "$RUNNER_PID" 2>/dev/null || true
  fi
  deregister
  exit 0
}
trap on_stop SIGTERM SIGINT

log "запрашиваю токен регистрации для репозитория ${GITHUB_REPO}"
REG_TOKEN=$(get_registration_token)
if [ -z "$REG_TOKEN" ] || [ "$REG_TOKEN" = "null" ]; then
  echo "[entrypoint] ОШИБКА: не удалось получить токен регистрации." >&2
  echo "  Проверь: репозиторий '${GITHUB_REPO}' существует и доступен," >&2
  echo "  у PAT есть scope 'repo' (classic) либо Administration: Read and write" >&2
  echo "  на этом репозитории (fine-grained)." >&2
  exit 1
fi

# После краша или kill -9 предыдущий конфиг остаётся в файловой системе
# контейнера, и config.sh откажется работать с "already configured".
if [ -f .runner ]; then
  log "нашёл конфиг от прошлого запуска, вычищаю"
  ./config.sh remove --token "$REG_TOKEN" || true
  rm -f .runner .credentials .credentials_rsaparams
  REG_TOKEN=$(get_registration_token)
fi

log "регистрирую раннер ${RUNNER_NAME} (метки: ${RUNNER_LABELS})"
./config.sh \
  --unattended \
  --replace \
  --ephemeral \
  --url "https://github.com/${GITHUB_REPO}" \
  --token "$REG_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work /home/runner/_work

# --ephemeral: раннер берёт ровно один job и выходит. restart: always в compose
# поднимает его заново с чистой регистрацией, состояние между джобами не течёт.
log "жду задание"
# Не exec: он заменил бы шелл и вместе с ним потерялся бы trap, а значит
# раннер не снимался бы с регистрации при остановке.
./run.sh &
RUNNER_PID=$!
wait "$RUNNER_PID"

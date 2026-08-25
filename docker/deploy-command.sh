#!/usr/bin/env bash
# Единственное, что умеет ключ деплоя.
#
# Прописывается в ~/.ssh/authorized_keys как форсированная команда:
#
#   command="/opt/zavod2/docker/deploy-command.sh",restrict ssh-ed25519 AAAA...
#
# Из-за `command=` ssh запускает ровно этот файл, что бы ни просил клиент;
# просьба клиента приезжает в SSH_ORIGINAL_COMMAND и разбирается здесь. Смысл
# именно в этом: контейнеру раннера отдаётся не доступ к машине, а одна
# кнопка. Скомпрометированный workflow может запустить деплой — то же самое,
# что он мог и раньше, когда трогал файл-триггер, — и ничего сверх этого.
#
# Поэтому же раннеру по-прежнему не даётся /var/run/docker.sock: правило
# CI-инфраструктуры мини-ПК (код из workflow не управляет демоном Docker
# хоста) осталось в силе, изменился только способ подать сигнал.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zavod2}"

case "${SSH_ORIGINAL_COMMAND:-}" in
    ping)
        # Проверка связи и ключа до того, как workflow потратит минуты на
        # тесты. Ничего не рассказывает о машине сверх того, что и так знает
        # тот, у кого есть этот ключ.
        echo "мини-ПК на связи · $(date -Is) · версия: $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
        ;;
    deploy | "deploy "*)
        # SSH_ORIGINAL_COMMAND уезжает дальше как есть: deploy.sh достаёт из
        # него sha и в конце проверяет, что задеплоен именно он.
        exec "$REPO_DIR/docker/deploy.sh"
        ;;
    *)
        echo "Этому ключу доступно только: ping | deploy [sha]" >&2
        echo "Запрошено: ${SSH_ORIGINAL_COMMAND:-<пусто>}" >&2
        exit 64
        ;;
esac

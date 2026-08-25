# Раннер GitHub Actions для Choclate-games/zavod2.
#
# Отличие от раннеров организации на этой же машине: регистрация на уровне
# репозитория. Org-раннер обслуживает все репозитории организации, то есть
# job из любого из них выполнялся бы здесь. Этому раннеру доступен ровно один
# репозиторий — тот, чей деплой он и обслуживает.
#
# Docker внутрь не пробрасывается. Job прогоняет тесты и просит хост
# развернуть новую версию по ssh — ключом, которому на той стороне разрешена
# ровно одна команда (docker/deploy-command.sh).

FROM ubuntu:24.04

ARG RUNNER_VERSION=2.336.0
ARG DEBIAN_FRONTEND=noninteractive

# uid/gid те же, что у фабрики (пользователь oem, uid 29999): раннер пишет в
# свой том _work, и разъехавшийся владелец ловится только после зелёных
# тестов — в виде «Access to the path ... is denied».
ARG APP_UID=29999
ARG APP_GID=29999

# libicu74 обязателен: раннер написан на .NET и без него не стартует.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl jq git unzip zip tar gzip \
      openssh-client \
      libicu74 liblttng-ust1 libkrb5-3 zlib1g libssl3 \
      python3 python3-venv python3-pip \
      tini \
 && rm -rf /var/lib/apt/lists/*

# Node LTS — фабрика зовёт npm для сгенерированных игр, и тесты это проверяют.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# actions/runner отказывается работать от root без RUNNER_ALLOW_RUNASROOT.
# Вместо флага-костыля заводим непривилегированного пользователя.
RUN groupadd -g ${APP_GID} runner \
 && useradd -u ${APP_UID} -g ${APP_GID} -m -s /bin/bash runner

WORKDIR /home/runner
USER runner

RUN curl -fsSL -o runner.tar.gz \
      "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
 && tar xzf runner.tar.gz \
 && rm runner.tar.gz

USER root
RUN /home/runner/bin/installdependencies.sh

# Каталоги обязаны существовать с правильным владельцем ДО монтирования тома:
# отсутствующий каталог Docker создаёт от root, и раннер падает с
# "Access to the path '/home/runner/_work/_tool' is denied".
RUN mkdir -p /home/runner/_work /home/runner/.npm /home/runner/.ssh \
 && chown -R runner:runner /home/runner \
 && chmod 700 /home/runner/.ssh

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# Файлы приезжают с Windows — CRLF сломал бы shebang.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh

USER runner

# tini как PID 1 — иначе SIGTERM не дойдёт до раннера и он не успеет сняться
# с регистрации при остановке контейнера.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]

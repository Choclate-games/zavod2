# AI Game Factory — образ для мини-ПК.
#
# Внутри должно оказаться четыре вещи:
#   1. Python + FastAPI — собственно веб-фабрика;
#   2. Node + npm — фабрика зовёт их для сгенерированных игр (app/acceptance.py,
#      app/pkgstore.py: npm install, npx, дымовой прогон через node);
#   3. git — без него отваливается откат запросов: app/snapshots.py держит по
#      теневому bare-репозиторию на каждый проект;
#   4. терминальные агенты — claude, codex, opencode, gemini, qwen, agy.
#
# Заодно это изоляция: фабрика выполняет код, который сама же и сгенерировала
# (app/sandbox.py). На хосте рядом крутятся раннеры организации, и пускать туда
# чужой код напрямую не хочется.

# ── Node ────────────────────────────────────────────────────────────────────
# Берём из официального образа, а не из nodesource: не нужен ни apt-репозиторий,
# ни ключи, а версия фиксируется тегом.
#
# Именно 22, а не 20. Фабрика ставит в общий стор `pnpm@latest`, а pnpm 10
# требует Node >= 22.13 и импортирует встроенный модуль `node:sqlite`,
# появившийся в 22.5. На Node 20 он падает с ERR_UNKNOWN_BUILTIN_MODULE, и
# вместе с ним падает любой `npm install` сгенерированной игры — фабрика
# заворачивает их в pnpm через shim. Раннер в docker/runner уже на Node 22,
# так что заодно версии в двух контейнерах сошлись.
FROM node:22-bookworm-slim AS node

# ── Основной образ ──────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm

# Версии агентов пиньтся здесь. Обновление агента — правка одной строки и
# пересборка, а не «что там сегодня в latest».
ARG CLAUDE_VERSION=2.1.197
ARG CODEX_VERSION=0.149.1
ARG OPENCODE_VERSION=1.18.22
ARG GEMINI_VERSION=0.56.0
ARG QWEN_VERSION=0.15.10

# Версия Playwright, под которую ставятся системные библиотеки Chromium.
# Обязана совпадать с той, что стоит у тестера площадки (его package.json,
# репозиторий AI_Tester): набор зависимостей у браузера свой в каждой версии,
# а ставит их сюда именно playwright.
ARG PLAYWRIGHT_VERSION=1.62.1

# uid/gid пользователя в контейнере. По умолчанию — как у `oem` на мини-ПК:
# workspace/ приезжает bind-монтом из склонированного репозитория, и писать
# туда контейнер сможет только совпав с владельцем каталога.
ARG APP_UID=29999
ARG APP_GID=29999

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# tini — чтобы дочерние процессы агентов и dev-серверов не оставались зомби:
# фабрика поднимает vite/npm пачками, а PID 1 из питона их не пожинает.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates curl tini procps \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version && npm --version

# ── Терминальные агенты ─────────────────────────────────────────────────────
RUN npm install -g --no-audit --no-fund \
        @anthropic-ai/claude-code@${CLAUDE_VERSION} \
        @openai/codex@${CODEX_VERSION} \
        opencode-ai@${OPENCODE_VERSION} \
        @google/gemini-cli@${GEMINI_VERSION} \
        @qwen-code/qwen-code@${QWEN_VERSION} \
    && npm cache clean --force

# Antigravity CLI ставится не из npm. Повторяем ровно то, что делает
# официальный установщик (antigravity.google/cli/install.sh): манифест на
# платформу -> tar.gz -> обязательная сверка SHA-512. Без совпадения хеша
# сборка падает, а не «ну ладно».
RUN set -eux; \
    manifest="$(curl -fsSL https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/linux_amd64.json)"; \
    url="$(printf '%s' "$manifest" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"; \
    sha="$(printf '%s' "$manifest" | sed -n 's/.*"sha512"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"; \
    test -n "$url" && test -n "$sha"; \
    curl -fsSL -o /tmp/agy.tar.gz "$url"; \
    echo "$sha  /tmp/agy.tar.gz" | sha512sum -c -; \
    tar -xzf /tmp/agy.tar.gz -C /tmp antigravity; \
    install -m 0755 /tmp/antigravity /usr/local/bin/agy; \
    rm -f /tmp/agy.tar.gz /tmp/antigravity; \
    agy --version

# ── Системные библиотеки Chromium ───────────────────────────────────────────
# Прогон игры на площадке ведёт тестер (app/gametest.py) через Playwright. Сам
# браузер он скачивает себе сам, в ~/.cache/ms-playwright — это том
# factory-home, поэтому качается он один раз и переживает деплои.
#
# А вот системные библиотеки браузер за собой не тянет: их ставят пакетным
# менеджером и только от root. Образ здесь — python:3.12-slim, в нём нет ни
# glib, ни nss, ни шрифтов, а фабрика работает от пользователя factory. То
# есть поставить их в работающем контейнере нельзя в принципе — ни фабрике, ни
# человеку по ssh: контейнер пересоздаётся каждым деплоем, и правка исчезнет.
#
# Отсюда единственное правильное место — здесь, на сборке, пока мы root.
# Без этого слоя Chromium стартует ровно один раз и умирает с кодом 127:
#   error while loading shared libraries: libglib-2.0.so.0
# а фабрика показывает «Вход не состоялся» — про окно, которого не было.
#
# Список зависимостей знает сам playwright и он же его ставит: перечислять
# пакеты руками значит отставать от них при каждом обновлении браузера.
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm

# ── Пользователь ────────────────────────────────────────────────────────────
RUN groupadd -g ${APP_GID} factory \
    && useradd -u ${APP_UID} -g ${APP_GID} -m -s /bin/bash factory

WORKDIR /app

# Зависимости отдельным слоем: правка кода не должна отправлять pip заново.
COPY requirements.txt ./
# pywebview выкидываем: это десктопная обёртка (app/webview_host.py), на
# сервере она бесполезна, а тянет за собой GTK/WebKit.
RUN grep -viE '^pywebview' requirements.txt > /tmp/req.txt \
    && pip install --no-cache-dir -r /tmp/req.txt \
    && rm -f /tmp/req.txt

COPY --chown=${APP_UID}:${APP_GID} . /app
COPY --chown=${APP_UID}:${APP_GID} docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# CRLF в скрипте — это «/bin/sh\r» в shebang и падение контейнера с
# «no such file or directory» при живом /bin/sh. В репозитории это уже
# закреплено через .gitattributes; здесь подстраховка на случай сборки из
# копии, скачанной мимо git.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

# Каталоги под bind-монты и состояние. Создаём заранее и с нужным владельцем:
# иначе docker создаст их от root и контейнер не сможет туда писать.
RUN mkdir -p /app/workspace /app/output /app/zip_projects /app/builds /app/.pkgstore /app/state \
    && chown -R ${APP_UID}:${APP_GID} /app/workspace /app/output /app/zip_projects /app/builds /app/.pkgstore /app/state \
    # Сам каталог /app создаётся директивой WORKDIR от root, и COPY --chown на
    # него не распространяется — он меняет владельца только у содержимого.
    # Без этого entrypoint не может создать в /app симлинки на файлы состояния
    # и контейнер уходит в цикл перезапусков с «ln: Permission denied».
    && chown ${APP_UID}:${APP_GID} /app

USER factory

# git внутри контейнера работает с чужими по владельцу каталогами (bind-монт),
# без этого он ругается «detected dubious ownership» и снимки не создаются.
RUN git config --global --add safe.directory '*' \
    && git config --global user.name 'AI Game Factory' \
    && git config --global user.email 'factory@local'

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:7860/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["uvicorn", "app.web.api:app", "--host", "0.0.0.0", "--port", "7860", \
     "--log-level", "warning", "--no-access-log"]

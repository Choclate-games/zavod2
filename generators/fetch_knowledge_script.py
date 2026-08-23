"""
Скрипт загрузки базы знаний, который едет вместе с игрой.

Пакет игры больше не носит в себе двести килобайт дословных копий. Вместо них
он носит манифест — список того, что этой игре нужно, — и этот скрипт, который
за один запуск кладёт всё в `docs/ref/`. Дальше прогон идёт офлайн: файлы уже
локальные.

Адресов два, и порядок между ними важнее, чем кажется.

Сначала пробуется `raw.githubusercontent.com`. Это CDN: он раздаёт файлы
публичного репозитория без счётчика запросов.

Contents API остаётся вторым заходом — для приватного репозитория, где raw
требует одноразовый `?token=`, протухающий за минуты, а у API приватный и
публичный отличаются одним заголовком Authorization.

Почему не наоборот, как было раньше: неавторизованный Contents API отдаёт
**шестьдесят запросов в час на IP**. В манифесте одной игры сорок с лишним
файлов, а пакет фабрики запускает до десяти прогонов разом — лимит выгорал на
первой же игре, и все остальные получали HTTP 403. В журналах это выглядело как
«База знаний недоступна (403 — токен не задан)», хотя репозиторий публичный и
никакой токен для него не нужен: игры просто собирались вслепую, без правил,
чек-листов и рецептов фабрики.
"""

FETCH_KNOWLEDGE_MJS = r'''#!/usr/bin/env node
/**
 * Загрузка базы знаний фабрики в docs/ref/.
 *
 *   node scripts/fetch-knowledge.mjs              — всё обязательное из манифеста
 *   node scripts/fetch-knowledge.mjs <путь> ...   — дозагрузить конкретный файл
 *
 * Токен нужен, только если репозиторий базы приватный. Берётся из окружения
 * (ZAVOD_KNOWLEDGE_TOKEN или GITHUB_TOKEN) и НИКОГДА не хранится в этой папке:
 * ключ в каталоге игры уезжает в git вместе с игрой.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT_DIR = join(ROOT, 'docs', 'ref')
const CONCURRENCY = 6

const TOKEN = process.env.ZAVOD_KNOWLEDGE_TOKEN || process.env.GITHUB_TOKEN || ''

function readManifest() {
    const candidates = [join(ROOT, 'knowledge.manifest.json'), join(HERE, 'knowledge.manifest.json')]
    return (async () => {
        for (const path of candidates) {
            try {
                return JSON.parse(await readFile(path, 'utf8'))
            } catch (err) {
                if (err.code !== 'ENOENT') throw err
            }
        }
        throw new Error('knowledge.manifest.json не найден рядом с проектом')
    })()
}

function rawUrl(repo, ref, path) {
    return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${encodeURI(path)}`
}

function contentsUrl(repo, ref, path) {
    return `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`
}

// Токен, который отклонили. Чужой GITHUB_TOKEN в окружении — обычное дело
// (его ставят CI и другие инструменты), и из-за него загрузка публичной базы
// падала бы с 401 на ровном месте. Один раз убеждаемся, что он не годится, и
// дальше все запросы идут без него.
let tokenRejected = false

async function requestRaw(repo, ref, path) {
    return fetch(rawUrl(repo, ref, path), {
        headers: { 'User-Agent': 'zavod-fetch-knowledge' },
    })
}

async function requestApi(repo, ref, path, useToken) {
    const headers = {
        Accept: 'application/vnd.github.raw',
        'User-Agent': 'zavod-fetch-knowledge',
    }
    if (useToken) headers.Authorization = `Bearer ${TOKEN}`
    return fetch(contentsUrl(repo, ref, path), { headers })
}

async function fetchOne(repo, ref, entry) {
    // Сначала CDN: у него нет часового лимита на запросы, и для публичной базы
    // этого хватает всегда. К Contents API идём, только если raw отказал —
    // то есть репозиторий приватный.
    let res = await requestRaw(repo, ref, entry.path)
    if (!res.ok && (res.status === 401 || res.status === 403 || res.status === 404)) {
        const useToken = TOKEN && !tokenRejected
        res = await requestApi(repo, ref, entry.path, useToken)
        if (useToken && (res.status === 401 || res.status === 403)) {
            tokenRejected = true
            console.log('Токен отклонён — пробую без него (годится, если репозиторий публичный).')
            res = await requestApi(repo, ref, entry.path, false)
        }
    }
    if (!res.ok) {
        let hint = ''
        if (res.status === 404 && !TOKEN) {
            hint = ' — нет такого пути, либо репозиторий приватный: задайте ZAVOD_KNOWLEDGE_TOKEN'
        } else if (res.status === 404) {
            hint = ' — нет такого пути в репозитории базы'
        } else if (res.status === 401 || res.status === 403) {
            hint = ' — токен не подходит или исчерпан часовой лимит Contents API'
        }
        throw new Error(`HTTP ${res.status}${hint}`)
    }
    const body = await res.text()
    const target = join(OUT_DIR, entry.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, body, 'utf8')
    // Именно байты, а не body.length: кириллица занимает два байта на символ,
    // и по длине строки отчёт занижал объём почти на четверть.
    return Buffer.byteLength(body, 'utf8')
}

async function main() {
    const manifest = await readManifest()
    const extra = process.argv.slice(2).filter((a) => !a.startsWith('-'))
    // Путь аргументом — это дозагрузка по требованию. Каталог готового кода
    // лежит в мастер-промпте целиком, и когда механика уже придумана, агент
    // тянет под неё файл одной командой, не редактируя манифест:
    //   node scripts/fetch-knowledge.mjs workspace/knowledge-showcase/src/game/stealthSensing.ts
    const files = extra.length
        ? extra.map((path) => ({ path, required: true }))
        : (Array.isArray(manifest.files) ? manifest.files : [])
    if (!files.length) {
        console.log('Манифест пуст — загружать нечего.')
        return
    }
    console.log(`Загружаю ${files.length} файл(ов) из ${manifest.repo}@${manifest.ref} в docs/ref/`)
    console.log(TOKEN ? 'Токен: задан.' : 'Токен: не задан (годится только для публичного репозитория).')

    const queue = [...files]
    const failed = []
    let bytes = 0
    let done = 0

    async function worker() {
        while (queue.length) {
            const entry = queue.shift()
            try {
                // Именно так, а не `bytes += await ...`: составное присваивание
                // читает счётчик ДО ожидания, и параллельные загрузки затирают
                // результат друг друга.
                const size = await fetchOne(manifest.repo, manifest.ref, entry)
                bytes += size
                done += 1
            } catch (err) {
                failed.push({ path: entry.path, required: !!entry.required, reason: err.message })
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))

    console.log(`Готово: ${done}/${files.length}, ${Math.round(bytes / 1024)} КБ в docs/ref/`)
    if (failed.length) {
        console.log('\nНе загрузилось:')
        for (const f of failed) console.log(`  ${f.required ? '[обязательный] ' : ''}${f.path}: ${f.reason}`)
    }
    const missingRequired = failed.filter((f) => f.required)
    if (missingRequired.length) {
        console.error(`\nОбязательных файлов не хватает: ${missingRequired.length}. Без них не начинайте кодить.`)
        process.exit(1)
    }
}

main().catch((err) => {
    console.error(`Загрузка не удалась: ${err.message}`)
    process.exit(1)
})
'''

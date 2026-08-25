/**
 * Эталонная обёртка над @playgama/bridge v2.
 *
 * Копируется в `src/platform/BridgeService.ts` игры и адаптируется только в
 * части формы сохранения (`TSave`) и списка плейсментов. Всё остальное —
 * порядок загрузки, разбор состояний рекламы, подписки — менять не нужно:
 * каждая строчка здесь стоит одной сломанной интеграции.
 *
 * Экспортируется ГОТОВЫЙ синглтон. Второй экземпляр — это второй флаг
 * `readySent`, второй дебаунсер сохранения и дублирующийся `game_ready`.
 */
import bridge, {
    EVENT_NAME,
    PLATFORM_MESSAGE,
    REWARDED_STATE,
    INTERSTITIAL_STATE,
    BANNER_POSITION,
    PLATFORM_ID,
    type RewardedState,
    type InterstitialState,
} from '@playgama/bridge'

/** Форма сохранения игры. Заменяется на реальный тип при копировании. */
export type SaveShape = Record<string, unknown>

export interface BridgeCapabilities {
    rewarded: boolean
    interstitial: boolean
    banner: boolean
    authorization: boolean
    payments: boolean
    leaderboards: boolean
    /** Тип лидербордов площадки: определяет, какую ветку UI рисовать. */
    leaderboardType: string
}

export interface PlayerInfo {
    isGuest: boolean
    isAuthorized: boolean
    id: string | null
    name: string | null
    photo: string | null
}

type DiagEntry = { t: number; kind: string; data?: unknown }

/** Инициализация не должна вешать игру, если sdk.js заблокирован. */
const INIT_TIMEOUT_MS = 10_000
/**
 * Пауза между прогрессом 100 и game_ready. Оверлей моста снимается по
 * расписанию 400/900/1400 мс после сотни; без паузы сплэш площадки уходит
 * поверх непогасшего оверлея.
 */
const SPLASH_SETTLE_MS = 700
/** Скорость доводки прогресса, % в секунду. Метка процентов не анимируется сама. */
const PROGRESS_SPEED = 45
/** Локальный минимум между межстраничными; площадка может требовать больше. */
const INTERSTITIAL_MIN_GAP_MS = 90_000
/** Ждать состояния рекламы вечно нельзя: площадка может не ответить. */
const AD_TIMEOUT_MS = 60_000

const SAVE_DEBOUNCE_MS = 1500

/** Языки, которые Яндекс подставляет в `lang`, но игра их не поддерживает. */
const LANGUAGE_FALLBACK: Record<string, string> = {
    be: 'ru', kk: 'ru', uk: 'ru', uz: 'ru', ky: 'ru', hy: 'ru', az: 'ru', tt: 'ru',
}

export class BridgeService<TSave extends SaveShape = SaveShape> {
    private initialized = false
    private readySent = false
    private readyResolve: (() => void) | null = null
    private readonly readyPromise: Promise<void>

    private progressCurrent = 0
    private progressTarget = 0
    private progressPushed = -1
    private progressRaf = 0
    private progressLastTs = 0

    private lastInterstitialAt = 0
    private saveTimer = 0
    private pendingSave: TSave | null = null
    private saveKey = 'save'
    private normalize: (raw: unknown) => TSave = (raw) => (raw ?? {}) as TSave

    private readonly diag: DiagEntry[] = []

    constructor() {
        this.readyPromise = new Promise<void>((resolve) => { this.readyResolve = resolve })
        // Единственная точка наблюдения для внешних проверок. Ничего не стоит
        // в проде и делает интеграцию доказуемой.
        ;(window as unknown as Record<string, unknown>).__playgamaBridgeService = this
        window.addEventListener('pagehide', this.flushSave)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.flushSave()
        })
    }

    // ───────────────────────────────────────────────── диагностика

    private log(kind: string, data?: unknown): void {
        this.diag.push({ t: Math.round(performance.now()), kind, data })
        if (this.diag.length > 400) this.diag.shift()
    }

    /** Полный журнал вызовов моста. Читается проверкой `verify-playgama.mjs`. */
    getDiagnostics(): DiagEntry[] { return this.diag.slice() }

    // ───────────────────────────────────────────────── инициализация

    /**
     * Стартует мост. Не отправляет game_ready — он уходит из `signalReady()`
     * после того, как меню отрисовано.
     */
    async initialize(options?: { saveKey?: string; normalize?: (raw: unknown) => TSave }): Promise<void> {
        if (options?.saveKey) this.saveKey = options.saveKey
        if (options?.normalize) this.normalize = options.normalize

        this.setProgressTarget(10)
        this.log('initialize:start')

        let timedOut = false
        await Promise.race([
            bridge.initialize().catch((error: unknown) => { this.log('initialize:error', String(error)) }),
            new Promise<void>((resolve) => window.setTimeout(() => { timedOut = true; resolve() }, INIT_TIMEOUT_MS)),
        ])

        this.initialized = bridge.isInitialized === true
        this.log('initialize:done', { initialized: this.initialized, timedOut, platform: this.platformId })

        // Отдельным сообщением, только после инициализации: на CrazyGames второй
        // `in_game_loading_started` считается новой загрузкой и портит метрику.
        this.send(PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED)
        this.setProgressTarget(35)
    }

    get isInitialized(): boolean { return this.initialized }

    get platformId(): string {
        try { return String(bridge.platform.id) } catch { return PLATFORM_ID.MOCK }
    }

    get capabilities(): BridgeCapabilities {
        const ad = this.safe(() => bridge.advertisement)
        const leaderboardType = this.safe(() => String(bridge.leaderboards.type)) ?? 'not_available'
        return {
            rewarded: this.safe(() => ad?.isRewardedSupported) === true,
            interstitial: this.safe(() => ad?.isInterstitialSupported) === true,
            banner: this.safe(() => ad?.isBannerSupported) === true,
            authorization: this.safe(() => bridge.player.isAuthorizationSupported) === true,
            payments: this.safe(() => bridge.payments.isSupported) === true,
            leaderboards: leaderboardType !== 'not_available',
            leaderboardType,
        }
    }

    // ───────────────────────────────────────────────── язык

    /**
     * Язык интерфейса. Вызывается ДО того, как игра стала интерактивной:
     * требование Яндекса 2.14 проверяет именно порядок.
     */
    resolveLanguage(supported: readonly string[], fallback = 'en'): string {
        // У CrazyGames в этом поле лежит код страны, а не языка.
        const fromPlatform = this.platformId === PLATFORM_ID.CRAZY_GAMES
            ? null
            : this.safe(() => bridge.platform.language)
        const raw = String(fromPlatform || navigator.language || fallback).slice(0, 2).toLowerCase()
        const mapped = LANGUAGE_FALLBACK[raw] ?? raw
        const result = supported.includes(mapped) ? mapped : fallback
        this.log('language', { raw, mapped, result })
        return result
    }

    // ───────────────────────────────────────────────── прогресс и готовность

    /**
     * Двигает цель прогресса. Значение только растёт: прыжок назад читается
     * игроком как зависшая загрузка.
     */
    setProgressTarget(percent: number): void {
        this.progressTarget = Math.max(this.progressTarget, Math.min(100, Math.max(0, percent)))
        if (!this.progressRaf) this.progressRaf = requestAnimationFrame(this.progressTick)
    }

    private readonly progressTick = (ts: number): void => {
        if (!this.progressLastTs) this.progressLastTs = ts
        const dt = Math.min(0.1, (ts - this.progressLastTs) / 1000)
        this.progressLastTs = ts

        if (this.progressCurrent < this.progressTarget) {
            this.progressCurrent = Math.min(this.progressTarget, this.progressCurrent + PROGRESS_SPEED * dt)
            const value = Math.round(this.progressCurrent)
            if (value !== this.progressPushed) {
                this.progressPushed = value
                this.safe(() => bridge.setGameLoadingProgress(value))
                this.log('progress', value)
            }
        }

        if (this.progressCurrent < 100) {
            this.progressRaf = requestAnimationFrame(this.progressTick)
        } else {
            this.progressRaf = 0
            this.progressLastTs = 0
        }
    }

    private async awaitProgress(value: number): Promise<void> {
        const deadline = performance.now() + 5000
        while (Math.round(this.progressCurrent) < value && performance.now() < deadline) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
    }

    /**
     * Отправляет game_ready. Ровно один раз за сессию — флаг живёт в
     * синглтоне, поэтому сторожевой таймер не может отправить второй.
     *
     * Вызывать только когда меню отрисовано и по нему можно кликать.
     */
    async signalReady(): Promise<void> {
        if (this.readySent) return
        this.readySent = true

        this.setProgressTarget(100)
        // Шрифты и два кадра: сотня не должна встать раньше первого настоящего кадра меню.
        try { await (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready } catch { /* нет Font Loading API */ }
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        await this.awaitProgress(100)
        await new Promise<void>((resolve) => window.setTimeout(resolve, SPLASH_SETTLE_MS))

        this.send(PLATFORM_MESSAGE.GAME_READY)
        this.send(PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED)
        this.log('ready')
        this.readyResolve?.()
        this.readyResolve = null
    }

    get isReady(): boolean { return this.readySent }
    /** Резолвится, когда game_ready отправлен. UI открывает ввод по этому промису. */
    whenReady(): Promise<void> { return this.readyPromise }

    // ───────────────────────────────────────────────── жизненный цикл

    /**
     * Пауза и звук берутся из событий площадки: `visibilitychange` не знает
     * про открывшийся межстраничный ролик.
     *
     * Колбэки вызываются один раз текущим значением сразу при подписке —
     * игра могла стартовать в скрытой вкладке.
     */
    bindLifecycle(onPause: (paused: boolean) => void, onAudio: (enabled: boolean) => void): void {
        const platform = this.safe(() => bridge.platform)
        if (!platform) return
        // Константа, не строка: значения событий — lower_snake, имена членов — UPPER_SNAKE.
        this.safe(() => platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) => {
            this.log('pause', paused); onPause(paused === true)
        }))
        this.safe(() => platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) => {
            this.log('audio', enabled); onAudio(enabled !== false)
        }))
        onPause(this.safe(() => platform.isPaused) === true)
        onAudio(this.safe(() => platform.isAudioEnabled) !== false)
        this.log('lifecycle:bound')
    }

    /** Управление передано игроку. На Яндексе разворачивается в GameplayAPI.start(). */
    gameplayStarted(): void { this.send(PLATFORM_MESSAGE.GAMEPLAY_STARTED) }
    /** Управление забрано: пауза, конец забега, меню, показ рекламы. */
    gameplayStopped(): void { this.send(PLATFORM_MESSAGE.GAMEPLAY_STOPPED) }

    private send(message: string): void {
        this.log('message', message)
        this.safe(() => { void bridge.platform.sendMessage(message) })
    }

    // ───────────────────────────────────────────────── реклама

    /**
     * Показывает rewarded и резолвится `true` ТОЛЬКО если площадка сообщила
     * состояние `rewarded`. Промис `showRewarded()` не существует: метод
     * возвращает void, и `await` на нём выдал бы награду мгновенно.
     */
    showRewarded(placement: string): Promise<boolean> {
        const ad = this.safe(() => bridge.advertisement)
        if (!ad || ad.isRewardedSupported !== true) {
            this.log('rewarded:unsupported', placement)
            return Promise.resolve(false)
        }

        return new Promise<boolean>((resolve) => {
            let granted = false
            let settled = false
            const finish = (value: boolean): void => {
                if (settled) return
                settled = true
                window.clearTimeout(timer)
                this.safe(() => ad.off(EVENT_NAME.REWARDED_STATE_CHANGED, onState))
                this.log('rewarded:done', { placement, value })
                resolve(value)
            }
            const onState = (state: RewardedState): void => {
                this.log('rewarded:state', { placement, state })
                if (state === REWARDED_STATE.REWARDED) granted = true
                // Награда приходит до закрытия; закрытие завершает ожидание.
                if (state === REWARDED_STATE.CLOSED) finish(granted)
                if (state === REWARDED_STATE.FAILED) finish(false)
            }
            const timer = window.setTimeout(() => finish(granted), AD_TIMEOUT_MS)

            this.safe(() => ad.on(EVENT_NAME.REWARDED_STATE_CHANGED, onState))
            this.gameplayStopped()
            this.log('rewarded:show', placement)
            this.safe(() => ad.showRewarded(placement))
        })
    }

    /**
     * Межстраничная. Резолвится, когда ролик закрыт или не показан.
     * Никогда не вызывается во время активного геймплея.
     */
    showInterstitial(placement?: string): Promise<boolean> {
        const ad = this.safe(() => bridge.advertisement)
        if (!ad || ad.isInterstitialSupported !== true) return Promise.resolve(false)

        const gap = Math.max(INTERSTITIAL_MIN_GAP_MS, (this.safe(() => ad.minimumDelayBetweenInterstitial) ?? 0) * 1000)
        if (this.lastInterstitialAt && performance.now() - this.lastInterstitialAt < gap) {
            this.log('interstitial:skipped', 'too soon')
            return Promise.resolve(false)
        }

        return new Promise<boolean>((resolve) => {
            let shown = false
            let settled = false
            const finish = (value: boolean): void => {
                if (settled) return
                settled = true
                window.clearTimeout(timer)
                this.safe(() => ad.off(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState))
                this.log('interstitial:done', value)
                resolve(value)
            }
            const onState = (state: InterstitialState): void => {
                this.log('interstitial:state', state)
                if (state === INTERSTITIAL_STATE.OPENED) { shown = true; this.lastInterstitialAt = performance.now() }
                if (state === INTERSTITIAL_STATE.CLOSED) finish(shown)
                if (state === INTERSTITIAL_STATE.FAILED) finish(false)
            }
            const timer = window.setTimeout(() => finish(shown), AD_TIMEOUT_MS)

            this.safe(() => ad.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState))
            this.gameplayStopped()
            this.log('interstitial:show', placement ?? null)
            this.safe(() => ad.showInterstitial(placement ?? null))
        })
    }

    /** Баннер — только вне игрового поля (требование Яндекса 4.4). */
    showBanner(position: typeof BANNER_POSITION[keyof typeof BANNER_POSITION] = BANNER_POSITION.BOTTOM): void {
        const ad = this.safe(() => bridge.advertisement)
        if (!ad || ad.isBannerSupported !== true) return
        this.log('banner:show', position)
        this.safe(() => ad.showBanner(position))
    }

    hideBanner(): void {
        const ad = this.safe(() => bridge.advertisement)
        if (!ad || ad.isBannerSupported !== true) return
        this.log('banner:hide')
        this.safe(() => ad.hideBanner())
    }

    // ───────────────────────────────────────────────── сохранение

    /** Читает облачное сохранение, падая на локальное зеркало. */
    async loadSave(): Promise<TSave> {
        const local = this.readMirror()
        try {
            const remote = await bridge.storage.get(this.saveKey)
            if (remote && typeof remote === 'object') {
                this.log('save:loaded', 'cloud')
                return this.normalize(remote)
            }
            if (typeof remote === 'string') {
                this.log('save:loaded', 'cloud-string')
                return this.normalize(JSON.parse(remote) as unknown)
            }
        } catch (error) {
            this.log('save:load-error', String(error))
        }
        this.log('save:loaded', 'local')
        return local
    }

    /** Ставит сохранение в очередь. Частые вызовы схлопываются дебаунсом. */
    save(data: TSave): void {
        this.pendingSave = data
        window.clearTimeout(this.saveTimer)
        this.saveTimer = window.setTimeout(this.flushSave, SAVE_DEBOUNCE_MS)
    }

    /** Немедленная запись. Вызывается на `pagehide` и на важных вехах. */
    readonly flushSave = (): void => {
        const data = this.pendingSave
        if (!data) return
        this.pendingSave = null
        window.clearTimeout(this.saveTimer)
        this.writeMirror(data)
        this.log('save:flush')
        this.safe(() => { void bridge.storage.set(this.saveKey, data) })
    }

    private readMirror(): TSave {
        try {
            const raw = window.localStorage.getItem(this.saveKey)
            return this.normalize(raw ? (JSON.parse(raw) as unknown) : null)
        } catch {
            return this.normalize(null)
        }
    }

    private writeMirror(data: TSave): void {
        try { window.localStorage.setItem(this.saveKey, JSON.stringify(data)) } catch {
            // Внутри iframe площадки локальное хранилище может быть запрещено.
        }
    }

    // ───────────────────────────────────────────────── игрок и лидерборды

    get player(): PlayerInfo {
        return {
            // Единственная надёжная проверка: id и name заполнены и у гостей.
            isGuest: this.safe(() => bridge.player.isGuest) !== false,
            isAuthorized: this.safe(() => bridge.player.isAuthorized) === true,
            id: this.safe(() => bridge.player.id) ?? null,
            name: this.safe(() => bridge.player.name) ?? null,
            photo: this.safe(() => bridge.player.photos?.[0]) ?? null,
        }
    }

    /** Только по действию игрока: диалог авторизации в бутстрапе вешает игру для гостей. */
    async authorize(): Promise<boolean> {
        if (this.safe(() => bridge.player.isAuthorizationSupported) !== true) return false
        try {
            await bridge.player.authorize()
            return this.safe(() => bridge.player.isAuthorized) === true
        } catch {
            return false
        }
    }

    async submitScore(leaderboardId: string, score: number): Promise<void> {
        if (!this.capabilities.leaderboards) return
        try { await bridge.leaderboards.setScore(leaderboardId, Math.round(score)) } catch (error) {
            this.log('leaderboard:error', String(error))
        }
    }

    private safe<T>(fn: () => T): T | undefined {
        try { return fn() } catch { return undefined }
    }
}

/** Единственный экземпляр на всю игру. Импортируется везде, не создаётся заново. */
export const bridgeService = new BridgeService()

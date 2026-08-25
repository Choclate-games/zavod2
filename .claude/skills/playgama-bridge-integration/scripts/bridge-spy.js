/**
 * Наблюдатель за мостом. Инжектится в страницу ДО игровых скриптов
 * (`page.addInitScript`) и не требует от игры ничего, кроме использования
 * @playgama/bridge.
 *
 * Как это работает: ESM-бандл моста в момент вычисления модуля выполняет
 * `window.bridge = <экземпляр>`. Мы заранее ставим на это свойство сеттер и
 * перехватываем экземпляр до того, как игра вызовет хоть один метод.
 *
 * Перехват идёт на уровне ГЕТТЕРОВ модулей (`bridge.platform`,
 * `bridge.advertisement`, …), а не их методов. Причина: мост отдаёт не сам
 * модуль, а Proxy-логгер, который на первом обращении к свойству кэширует
 * найденную функцию в замыкании. Патч метода, поставленный после этого,
 * молча не сработает — вызов уйдёт мимо. Подменённый геттер отдаёт свой
 * Proxy поверх чужого, и мимо него не проходит ничего.
 *
 * Ничего не мокается: настоящие методы вызываются как есть. Дополнительно
 * поднимаются флаги поддержки рекламы (на mock-площадке их нет, и UI рекламы
 * иначе недостижим) и появляется возможность проиграть подписчикам игры
 * сценарий состояний ролика.
 */
(() => {
    const t0 = performance.now()
    const now = () => Math.round(performance.now() - t0)

    const V = {
        version: 2,
        progress: [],        // { t, value }
        messages: [],        // { t, message }
        subscriptions: [],   // { t, target, event, suspicious }
        storage: [],         // { t, op, key }
        adCalls: [],         // { t, method, placement }
        languageReads: [],   // { t }
        wrapped: false,
        wrapErrors: [],
        capabilityOverrides: [],
        /** Вызовы показа, не ушедшие на площадку: флаг поддержки был поднят нами. */
        suppressedCalls: [],
        handlers: { rewarded: [], interstitial: [], banner: [] },
    }
    window.__pgv = V

    /** Имя события написано как имя константы, а не как её значение. */
    const isSuspiciousEvent = (name) => typeof name === 'string' && /^[A-Z][A-Z0-9_]*$/.test(name)

    const record = (list, entry) => { list.push({ t: now(), ...entry }); return entry }

    /** Флаги, которые поднимаем, чтобы рекламный UI игры был достижим на mock-площадке. */
    const FORCED_CAPABILITIES = new Set(['isRewardedSupported', 'isInterstitialSupported', 'isBannerSupported'])

    const AD_METHODS = new Set(['showRewarded', 'showInterstitial', 'showBanner', 'hideBanner',
        'showAdvancedBanners', 'hideAdvancedBanners', 'preloadRewarded', 'preloadInterstitial'])

    /** Какой флаг поддержки отвечает за метод показа. */
    const METHOD_CAPABILITY = {
        showRewarded: 'isRewardedSupported',
        preloadRewarded: 'isRewardedSupported',
        showInterstitial: 'isInterstitialSupported',
        preloadInterstitial: 'isInterstitialSupported',
        showBanner: 'isBannerSupported',
        hideBanner: 'isBannerSupported',
    }

    const HANDLER_BUCKET = {
        rewarded_state_changed: 'rewarded',
        interstitial_state_changed: 'interstitial',
        banner_state_changed: 'banner',
    }

    /** Что записать про вызов метода модуля. Возвращает `false`, если писать нечего. */
    function noteCall(moduleName, method, args) {
        if (method === 'sendMessage') { record(V.messages, { message: String(args[0]) }); return true }
        if (method === 'on' || method === 'once') {
            const event = String(args[0])
            record(V.subscriptions, { target: moduleName, event, suspicious: isSuspiciousEvent(event) })
            const bucket = HANDLER_BUCKET[event]
            if (bucket) V.handlers[bucket].push(args[1])
            return true
        }
        if (method === 'off') {
            const bucket = HANDLER_BUCKET[String(args[0])]
            if (bucket) {
                const index = V.handlers[bucket].indexOf(args[1])
                if (index !== -1) V.handlers[bucket].splice(index, 1)
            }
            return true
        }
        if (moduleName === 'storage' && (method === 'get' || method === 'set' || method === 'delete')) {
            record(V.storage, { op: method, key: String(args[0]) }); return true
        }
        if (AD_METHODS.has(method)) { record(V.adCalls, { method, placement: args[0] ?? null }); return true }
        return false
    }

    /** Proxy поверх модуля: пишет вызовы и поднимает флаги поддержки. */
    function observeModule(moduleName, real) {
        const wrappers = new Map()
        return new Proxy(real, {
            get(target, prop) {
                const value = Reflect.get(target, prop)

                if (typeof value !== 'function') {
                    if (moduleName === 'platform' && prop === 'language') record(V.languageReads, {})
                    if (FORCED_CAPABILITIES.has(prop) && value !== true) {
                        if (!V.capabilityOverrides.includes(prop)) V.capabilityOverrides.push(prop)
                        return true
                    }
                    return value
                }

                let wrapper = wrappers.get(prop)
                if (!wrapper) {
                    const method = String(prop)
                    wrapper = (...args) => {
                        noteCall(moduleName, method, args)
                        // Если флаг поддержки поднят нами, площадка показать ролик
                        // не может и мгновенно ответит `failed` — реальный вызов
                        // только сорвал бы сценарий, который проигрывает проверка.
                        // Там, где площадка поддерживает рекламу по-настоящему
                        // (черновик Яндекса), вызов уходит как есть.
                        const capability = METHOD_CAPABILITY[method]
                        if (capability && V.capabilityOverrides.includes(capability)) {
                            V.suppressedCalls.push({ t: now(), method })
                            return undefined
                        }
                        try {
                            return value.apply(target, args)
                        } catch (error) {
                            V.wrapErrors.push(`${moduleName}.${method}: ${String(error)}`)
                            return undefined
                        }
                    }
                    wrappers.set(prop, wrapper)
                }
                return wrapper
            },
        })
    }

    /**
     * Подменяет геттер модуля на экземпляре моста. Геттер объявлен на прототипе,
     * поэтому собственное свойство экземпляра его перекрывает, а игра всё равно
     * ходит через `bridge.<module>`.
     */
    function wrapModuleGetter(instance, name) {
        const proto = Object.getPrototypeOf(instance)
        const descriptor = Object.getOwnPropertyDescriptor(proto, name)
        if (!descriptor?.get) return false

        let lastReal = null
        let lastObserved = null
        Object.defineProperty(instance, name, {
            configurable: true,
            get() {
                // До инициализации мост бросает — пусть бросает, как и обычно.
                const real = descriptor.get.call(this)
                if (real !== lastReal) { lastReal = real; lastObserved = observeModule(name, real) }
                return lastObserved
            },
        })
        return true
    }

    function tryWrap(instance) {
        if (!instance || V.wrapped) return V.wrapped
        try {
            const original = instance.setGameLoadingProgress
            if (typeof original === 'function') {
                Object.defineProperty(instance, 'setGameLoadingProgress', {
                    configurable: true,
                    writable: true,
                    value(percent) { record(V.progress, { value: Number(percent) }); return original.call(this, percent) },
                })
            }
            let wrappedAll = true
            for (const name of ['platform', 'advertisement', 'storage', 'player', 'payments', 'leaderboards']) {
                if (!wrapModuleGetter(instance, name)) wrappedAll = false
            }
            V.wrapped = wrappedAll
        } catch (error) {
            V.wrapErrors.push(String(error))
        }
        return V.wrapped
    }

    let held
    Object.defineProperty(window, 'bridge', {
        configurable: true,
        get: () => held,
        set: (value) => {
            held = value
            if (!tryWrap(value)) {
                const timer = setInterval(() => { if (tryWrap(value)) clearInterval(timer) }, 20)
                setTimeout(() => clearInterval(timer), 20_000)
            }
        },
    })

    /** Проигрывает сценарий состояний ролика в подписчиков игры. */
    window.__pgvEmit = (kind, states, stepMs = 30) => new Promise((resolve) => {
        const handlers = V.handlers[kind].slice()
        if (handlers.length === 0) { resolve(false); return }
        let index = 0
        const step = () => {
            if (index >= states.length) { resolve(true); return }
            const state = states[index++]
            for (const handler of handlers) {
                try { handler(state) } catch (error) { V.wrapErrors.push(`emit ${state}: ${String(error)}`) }
            }
            setTimeout(step, stepMs)
        }
        step()
    })

    window.addEventListener('error', (event) => { V.wrapErrors.push(`page error: ${event.message}`) })
})()

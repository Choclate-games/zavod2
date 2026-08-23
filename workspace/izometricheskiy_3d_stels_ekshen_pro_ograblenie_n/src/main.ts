import './ui/theme.css'
import * as THREE from 'three'
import { bus } from './core/events.js'
import { GameLoop } from './core/loop.js'
import { BAL, TRACK_TIME_LIMIT } from './config/balance.js'
import { pg } from './platform/playgama.js'
import { bindFlushOnHide, save } from './platform/save.js'
import { audio, bindAudioToBus } from './audio/audio.js'
import { Renderer3D } from './render/renderer.js'
import { HeistSession } from './game/heist.js'
import { DesktopInput } from './input/inputManager.js'
import { TouchControls } from './input/touchControls.js'
import { ScreenRouter, type ScreenName } from './ui/ui.js'
import { MainMenuScreen } from './ui/screens/MainMenuScreen.js'
import { HudScreen } from './ui/screens/HudScreen.js'
import { ResultScreen } from './ui/screens/ResultScreen.js'
import { WorkshopScreen } from './ui/screens/WorkshopScreen.js'
import { t } from './ui/lang.js'

/**
 * Точка сборки: площадка → сохранение → рендер и сессия → интерфейс → ввод →
 * цикл с фиксированным шагом. Заставка идёт по реальным вехам и доходит до 100%.
 */

const app = document.getElementById('app') as HTMLElement
const splashHint = document.getElementById('splash-hint') as HTMLElement
const splash = document.getElementById('splash') as HTMLElement

function setProgress(percent: number): void {
  document.documentElement.style.setProperty('--load-progress', `${Math.min(100, Math.max(0, percent))}%`)
}

function applyUiScale(): void {
  const scale = window.innerWidth < 480 ? 0.92 : window.innerWidth > 1600 ? 1.1 : 1
  document.documentElement.style.setProperty('--ui-scale', String(scale))
}
applyUiScale()
window.addEventListener('resize', applyUiScale)

async function bootstrap(): Promise<void> {
  // ── Площадка и сохранение ──────────────────────────────────────────
  await pg.init((value, label) => {
    setProgress(value)
    splashHint.textContent =
      label === 'bridge' ? t('loading.bridge')
        : label === 'save' ? t('loading.world')
          : label === 'platform' ? t('loading.bridge') : t('loading.menu')
  })
  await save.load()

  // ── Рендер и симуляция ─────────────────────────────────────────────
  const renderer = new Renderer3D(app, pg.deviceType === 'desktop' ? 'desktop' : 'mobile')
  const session = new HeistSession(renderer.scene, { ...save.snapshot.upgrades })
  session.enterIdle()

  bindAudioToBus()
  bindFlushOnHide()
  const unlockAudio = (): void => {
    audio.unlock()
    window.removeEventListener('pointerdown', unlockAudio)
    window.removeEventListener('keydown', unlockAudio)
  }
  window.addEventListener('pointerdown', unlockAudio)
  window.addEventListener('keydown', unlockAudio)

  // ── Интерфейс ──────────────────────────────────────────────────────
  const router = new ScreenRouter(document.body)

  let paused = false
  let runActive = false

  const hud = new HudScreen(() => togglePause())
  const menu = new MainMenuScreen({
    onStart: () => beginRun(),
    onWorkshop: () => {
      workshop.refresh()
      router.show('workshop')
    },
    onToggleSound: () => {
      const next = !save.snapshot.soundOn
      save.update((data) => {
        data.soundOn = next
      })
      audio.setMuted(!next)
      menu.setSound(next)
    },
  })
  const workshop = new WorkshopScreen(() => {
    menu.refresh()
    router.show('menu')
  })
  const secondChanceSupported = (): boolean => !pg.bridgeConfigured || pg.caps.rewarded
  const result = new ResultScreen({
    onRetry: () => beginRun(),
    onMenu: () => backToMenu(),
    onSecondChance: () => {
      if (!secondChanceSupported()) return
      pg.showRewarded(
        'thief_second_chance',
        () => {
          if (session.useSecondChance()) {
            runActive = true
            paused = false
            router.show('hud')
          }
        },
        () => undefined,
      )
    },
    secondChanceSupported,
  })

  router.register('menu', menu.root)
  router.register('hud', hud.root)
  router.register('result', result.root)
  router.register('workshop', workshop.root)
  showScreen('menu')
  menu.refresh()
  menu.setSound(save.snapshot.soundOn)
  audio.setMuted(!save.snapshot.soundOn)

  function beginRun(): void {
    session.upgradesRefresh({ ...save.snapshot.upgrades })
    session.startRun()
    runActive = true
    paused = false
    hud.update(hudFrameFromSession())
    hud.setScheme(activeScheme)
    syncTouchVisibility()
    showScreen('hud')
  }

  function backToMenu(): void {
    runActive = false
    paused = false
    hud.setPausedOverlay(false)
    session.enterIdle()
    menu.refresh()
    showScreen('menu')
    syncTouchVisibility()
    // Интерстишл между забегами: не на старте сессии и не чаще интервала.
    pg.maybeShowInterstitial(90000, 60000)
  }

  function togglePause(): void {
    if (!runActive || session.phase !== 'playing') return
    paused = !paused
    hud.setPausedOverlay(paused)
    syncTouchVisibility()
    if (!paused) loop.resetAccumulator()
  }

  /** Управление видно только в активном забеге активной схемы. */
  function syncTouchVisibility(): void {
    touch.setVisible(activeScheme === 'touch' && runActive && !paused)
  }

  bus.on('game:over', (payload) => {
    runActive = false
    save.update((data) => {
      data.gold += payload.gold
      data.runs += 1
      if (payload.won) {
        data.wins += 1
        const timeMs = Math.round(payload.time * 1000)
        if (data.bestTimeMs <= 0 || timeMs < data.bestTimeMs) data.bestTimeMs = timeMs
      }
    })
    result.show(payload, !payload.won && payload.reason !== 'time' && secondChanceSupported())
    showScreen('result')
  })

  bus.on('save:changed', () => {
    menu.refresh()
  })

  // Пауза площадки останавливает цикл; на возврате накопитель времени сброшен.
  bus.on('platform:pause', (isPaused) => {
    if (isPaused && runActive) {
      paused = true
      hud.setPausedOverlay(true)
    } else if (!isPaused && paused) {
      paused = false
      hud.setPausedOverlay(false)
      loop.resetAccumulator()
    }
    syncTouchVisibility()
  })

  function showScreen(name: ScreenName): void {
    router.show(name)
  }

  // ── Ввод ───────────────────────────────────────────────────────────
  const threatDir = new THREE.Vector3()
  const moveAxisTmp = { x: 0, z: 0 }

  function requestLungeWorld(x: number, z: number): void {
    const dx = x - session.playerPos.x
    const dz = z - session.playerPos.z
    if (Math.hypot(dx, dz) < 0.2) {
      lungeAtNearestOrFacing()
    } else {
      session.tryLunge(dx, dz)
    }
  }

  function lungeAtNearestOrFacing(): void {
    if (session.nearestThreatDirection(threatDir)) {
      session.tryLunge(threatDir.x, threatDir.z)
    } else {
      session.tryLunge(Math.sin(session.facingNow()), Math.cos(session.facingNow()))
    }
  }

  const desktop = new DesktopInput(app, renderer.camera, {
    onLungeWorld: (x, z) => requestLungeWorld(x, z),
    onParry: () => session.tryParry(),
    onKickOrBlendPress: () => session.tryKick(),
    onDash: () => session.tryDash(),
    onConfettiAimed: (x, z) => session.throwConfetti(x, z),
    onConfettiSelf: () => session.throwConfetti(null, null),
    onPauseToggle: () => togglePause(),
  })

  const touch = new TouchControls({
    onParry: () => session.tryParry(),
    onKick: () => session.tryKick(),
    onDash: () => session.tryDash(),
    onConfetti: () => session.throwConfetti(null, null),
  })
  bus.on('ui:lungeRequested', ({ x, z }) => {
    if (x !== null && z !== null) {
      requestLungeWorld(x, z)
    } else {
      lungeAtNearestOrFacing()
    }
  })

  // Схема стартует от типа устройства площадки; ?input= и ?touch=1 принудительно меняют.
  let activeScheme: 'desktop' | 'touch' = pg.deviceType === 'desktop' ? 'desktop' : 'touch'
  const urlParams = new URLSearchParams(window.location.search)
  const urlOverride = urlParams.get('input')
  if (urlOverride === 'touch' || urlParams.get('touch') === '1') activeScheme = 'touch'
  if (urlOverride === 'desktop') activeScheme = 'desktop'

  function applyScheme(scheme: 'desktop' | 'touch'): void {
    activeScheme = scheme
    if (scheme === 'touch') {
      desktop.setActive(false)
      touch.mount(router.layerHost())
    } else {
      touch.unmount()
      desktop.setActive(true)
    }
    syncTouchVisibility()
    hud.setScheme(scheme)
    menu.setHints(scheme)
  }

  bus.on('scheme:changed', (scheme) => {
    if (scheme !== activeScheme) applyScheme(scheme)
  })
  applyScheme(activeScheme)

  // Первый палец возвращает тач-схему; клавиатура уводит в десктопную —
  // планшет с клавиатурой и мышь с тач-экраном работают в обе стороны.
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'touch' && activeScheme !== 'touch') {
        bus.emit('scheme:changed', 'touch')
      }
    },
    true,
  )

  // ── Цикл ───────────────────────────────────────────────────────────
  const camTarget = new THREE.Vector3()
  const camPos = new THREE.Vector3()
  const isoOffset = new THREE.Vector3(1, 1.25, 1).normalize().multiplyScalar(80)
  const idleCenter = new THREE.Vector3(0, 0, -20)
  let idleAngle = 0

  function beatPulse(): number {
    const phase = audio.beatPhase()
    if (phase < 0) return 0
    return Math.max(0, 1 - phase * 4)
  }

  function hudFrameFromSession(): HudFrameData {
    return {
      alarm: session.alarm,
      timeLeft: session.timeLeft,
      hits: session.playerHitsTaken(),
      confetti: session.confettiCharges,
      disguised: session.disguiseActive,
      totemCarried: session.totemCarried,
      paused,
      beatScale: beatPulse(),
    }
  }

  interface HudFrameData {
    alarm: number
    timeLeft: number
    hits: number
    confetti: number
    disguised: boolean
    totemCarried: boolean
    paused: boolean
    beatScale: number
  }

  const hudFrame: HudFrameData = {
    alarm: 0,
    timeLeft: TRACK_TIME_LIMIT,
    hits: 0,
    confetti: BAL.confettiCharges,
    disguised: false,
    totemCarried: false,
    paused: false,
    beatScale: 1,
  }
  camTarget.copy(idleCenter)

  const loop = new GameLoop(
    (dt) => {
      if (runActive && session.phase === 'playing') {
        desktop.moveAxis(moveAxisTmp)
        const blend = desktop.blending || touch.blending
        session.submitMove(moveAxisTmp.x + touch.moveX, moveAxisTmp.z + touch.moveZ, blend)
        session.fixedUpdate(dt)
        if (session.phase !== 'playing') {
          bus.emit('game:over', {
            won: session.phase === 'won',
            reason: session.loseReason,
            gold: session.goldEarned,
            time: session.elapsed,
          })
        }
      } else {
        session.fixedUpdate(dt)
      }
    },
    (_alpha, frameDt) => {
      renderer.sampleFrame(frameDt)
      // Камера: изометрия следует за вором, в меню медленно облетает эшелоны.
      if (runActive) {
        camTarget.lerpVectors(camTarget, session.playerPos, 0.08)
        camPos.copy(camTarget).add(isoOffset)
      } else {
        idleAngle += frameDt * 0.06
        camTarget.lerpVectors(camTarget, idleCenter, 0.04)
        camPos.set(
          camTarget.x + Math.cos(idleAngle) * 46 + isoOffset.x * 0.35,
          camTarget.y + isoOffset.y,
          camTarget.z + Math.sin(idleAngle) * 46 + isoOffset.z * 0.35,
        )
      }
      renderer.camera.position.copy(camPos)
      renderer.camera.lookAt(camTarget)
      renderer.render()

      if (runActive && router.isScreenVisible('hud')) {
        const snap = hudFrameFromSession()
        hudFrame.alarm = snap.alarm
        hudFrame.timeLeft = snap.timeLeft
        hudFrame.hits = snap.hits
        hudFrame.confetti = snap.confetti
        hudFrame.disguised = snap.disguised
        hudFrame.totemCarried = snap.totemCarried
        hudFrame.paused = paused
        hudFrame.beatScale = snap.beatScale
        hud.update(hudFrame)
      }
    },
    () => paused,
  )

  // ── Заставка до 100%, затем единственный сигнал готовности ─────────
  pg.finishProgress()
  setProgress(100)
  splash.classList.add('is-hidden')
  window.setTimeout(() => splash.remove(), 500)
  pg.signalReady()

  loop.start()
}

void bootstrap().catch((error) => {
  splashHint.textContent = `Ошибка запуска: ${error instanceof Error ? error.message : String(error)}`
  throw error
})

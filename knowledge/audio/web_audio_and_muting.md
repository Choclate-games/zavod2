# Game Audio: Web Audio, Autoplay and Muting

Audio is where two platform requirements and one browser policy meet. Getting it
wrong is a moderation rejection, not a polish issue.

## Web Audio API only — never `<audio>` / HTML5 Audio

An `<audio>` or `<video>` element registers a **media session** with the browser.
The consequences are both explicit rejection reasons on Yandex Games:

- **1.6.1.6** — the game's player shows up in the phone's notification panel;
- **1.6.2.5** — a system media player is visible on desktop.

So: decode into `AudioBuffer`s and play through `AudioBufferSourceNode`. If you
use a library, force it off the HTML5 path:

```javascript
// Howler defaults to Web Audio but silently falls back to HTML5 Audio for
// large files and when `html5: true` is passed. Both trip the requirements.
new Howl({ src: ['music.webm', 'music.mp3'], html5: false });
```

A useful side effect: Web Audio gives sample-accurate scheduling and a single
master `GainNode`, which is what the mute and platform-pause logic below need.

## One bus, one master gain

Every sound goes through a master `GainNode` — that is the only thing mute,
ducking and the platform's audio flag ever touch. Never mute by pausing
individual sources; you will miss one.

```javascript
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const master = ctx.createGain();
const musicBus = ctx.createGain();
const sfxBus = ctx.createGain();
musicBus.connect(master); sfxBus.connect(master); master.connect(ctx.destination);
```

Ramp gain rather than assigning it — an instant change on an audible signal
clicks:

```javascript
master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.015);
```

## Autoplay policy: the context starts suspended

Browsers create the `AudioContext` in a `suspended` state until the page receives
a real user gesture. A game that "has no sound on some machines" is almost always
this. Resume from the first gesture, and keep the handler until it succeeds:

```javascript
const unlock = () => {
    ctx.resume().then(() => {
        if (ctx.state === 'running') {
            ['pointerdown', 'keydown', 'touchstart'].forEach((e) =>
                document.removeEventListener(e, unlock));
        }
    });
};
['pointerdown', 'keydown', 'touchstart'].forEach((e) =>
    document.addEventListener(e, unlock));
```

Never block boot on audio unlock, and never wait for it before `game_ready` — the
menu must be interactive with the sound still suspended.

Recording or capturing the game (trailers, screenshots) needs one real click on
the canvas first for the same reason.

## The platform owns pause and mute

Two independent signals, both from the bridge — see
`../playgama/lifecycle_and_orientation.md`:

```javascript
bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled) => audio.setMuted(!enabled));
bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused) => audio.setPaused(paused));
```

`isAudioEnabled` being `undefined` means the platform does not manage it — treat
that as enabled. The pause flag covers hidden tabs *and* interstitials, so this
one subscription also silences the game under an ad. Do **not** additionally
mute around your own `showRewarded()` call: that double-pauses and leaves the game
silent when the ad fails to open.

Keep the platform mute and the player's own mute as **separate** inputs to the
master gain. Otherwise returning from an ad un-mutes a player who had muted the
game deliberately.

```javascript
const applyGain = () => master.gain.setTargetAtTime(
    (userMuted || platformMuted || paused) ? 0 : masterVolume, ctx.currentTime, 0.015);
```

## Mute state belongs in the save

A shipped game kept `muted` only in the audio engine's constructor, so the button
reset on every reload. Store it in the save object, not `localStorage` — inside
the platform iframe that is partitioned third-party storage. Initialize the
button's icon from the loaded value, not from a default. See
`../playgama/storage_and_cloud.md`.

## Asset and performance notes

- Ship `.webm` (Opus) with an `.mp3` fallback; Opus is dramatically smaller at
  equal quality and counts against the platform's initial-load budget.
- Decode once at load into a buffer cache; `decodeAudioData` per playback is a
  frame-time spike.
- Pool and cap concurrent SFX voices (e.g. 16). A wave-survival game firing one
  source per hit will otherwise stack hundreds of nodes and audibly clip.
- Long music tracks stream badly through Web Audio — keep loops short and
  seamless rather than shipping a five-minute track.
- Suspend the context (`ctx.suspend()`) when the platform pauses for a long
  while: it releases the audio hardware and stops the battery drain.

# Android Build (Capacitor) for an HTML5 Game

The same web build, wrapped in a native shell so it can ship to Google Play. The
game code does not fork — `bridge.platform.id === 'android'` is the only branch.

## Decide before you start

Two things are expensive to change later, so settle them first:

- **Package name** (`appId` / `applicationId`) — e.g. `com.playgama.mygame`,
  letters and digits only, no hyphens. **Immutable once published to the store**,
  and it is baked into the Java source path.
- **Icon** — a square PNG, ideally 1024×1024. Regenerating touches ~50 resource
  files.
- **Orientation** — `sensorLandscape` / `sensorPortrait`. Games almost always
  want it pinned.

## First setup

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android
npx cap sync
```

```json
// capacitor.config.json
{ "appId": "com.example.gamename", "appName": "Game Name", "webDir": "dist" }
```

`webDir` must match the bundler's output (`dist` for Vite). **Commit the
`android/` folder** — a remote CI build cannot regenerate it. Only build
artifacts stay ignored.

Subsequent builds are just `npm run build && npx cap sync`.

Prefer building on CI (GitHub Actions) over a local toolchain: no Android SDK or
JDK to keep in sync on the dev machine.

## Renaming the package later

It appears in five places, and missing one produces a build that installs but
crashes on launch:

- `capacitor.config.json` → `appId`
- `android/app/build.gradle` → `namespace` **and** `applicationId`
- `android/app/src/main/java/<path>/MainActivity.java` → the `package` statement
- the directory path itself (`git mv android/app/src/main/java/com/old com/new`)

Verify with `grep -rn "com.old" android/ | grep -v "/build/"`.

## Icons

Generate rather than hand-place — the tool expects the source at exactly
`assets/icon.png`:

```bash
mkdir -p assets && cp <source.png> assets/icon.png
npx --yes @capacitor/assets generate --android
```

## What changes for the game code

**Banners are native views drawn over the WebView.** The ads plugin resizes the
WebView to keep it out from under the banner, and the page reflows on its own when
that resize lands. So the game's own layout reserve must stay out of the way, or
the strip is given up twice and goes black. Measure whether the viewport actually
shrank instead of assuming — see `../playgama/banners_and_layout.md`.

The native resize and the "banner shown" callback are **not ordered**: the plugin
only learns the ad's real height a frame or two after reporting it. Re-evaluate
the reserve after the layout settles (~300 ms and ~1200 ms), never on the event
alone, or the whole UI visibly jumps.

Other differences:

- The safe area still applies — Android phones have notches and gesture bars.
- There is no platform splash to hand over to, but `game_ready` still gates the
  in-game loader; keep the same boot order.
- Back-button handling is the shell's job: intercept it, or Android closes the
  app mid-run.
- `localStorage` is *not* partitioned here (no third-party iframe), but keep the
  same single-key save through the bridge so one save format serves all targets.

## Release checklist

- `npm run build` **before** every `cap sync` — the shell packages `webDir` as it
  finds it, and a stale `dist/` ships silently.
- Signing keystore stored outside the repo; the same key forever, or the store
  refuses the update.
- Test on a real device: WebGL performance and the banner reserve both behave
  differently from desktop Chrome.
- Version code must increase on every upload.

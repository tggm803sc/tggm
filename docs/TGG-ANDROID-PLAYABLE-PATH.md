# TGG World — Android Playability Path

**Status:** Plan only. Nothing in this repository is packaged for Android, installed on a device, or playable today.
**Companions:** [Design Bible](TGG-WORLD-DESIGN-BIBLE.md), [Campaign Script](TGG-WORLD-SCRIPT-ACTS-I-III.md), [12-Screen UI Handoff](TGG-WORLD-12-SCREEN-UI-HANDOFF.md), [Save Policy](TGG-SAVE-POLICY.md).

This document answers one question: *what has to happen, in what order, before TGG World runs on a phone you can hold.*

---

## 1. Reality check — what exists right now

| Thing an Android build needs | Present in this repo? |
|---|---|
| Unreal project file (`.uproject`) | **No** |
| Content assets (maps, meshes, materials, `.uasset` widgets) | **No** — `game/unreal/UI/WBP_HUD.layout.json` is a layout spec, not an asset |
| C++ gameplay modules | **Partial** — `game/unreal/Source/MultiplayerFramework` (character, vehicle-adjacent, save, combat, ELO, audio) |
| `Config/DefaultEngine.ini` with `[Android]` settings | **No** — `game/unreal/Config` does not exist |
| Cooked/packaged build for any platform | **No** |
| Android SDK / NDK / JDK / Unreal Engine in this workspace | **No** |
| Playable web slice of the 12 screens | **Partial** — `/play` in `tgg-app` implements the 12 screens and the Act I loop; not yet walked on a physical phone |
| Approved economy + save schema | **No** — `od-economy`, `od-save-schema-v2` and `od-mission-stage-type` are open |

`TGG-PROJECT.json` already states the same thing: `unreal_compile_status: NOT_RUN_NO_UNREAL_BUILD_RUNNER`.

So there is no shortcut where this repo produces an APK tomorrow. There are two legitimate tracks, and they should run in parallel because they de-risk different things.

---

## 2. Two definitions of "playable", pick deliberately

- **Tier 1 — playable loop, no 3D.** The 12 screens as a touch web app: title → HUD shell → phone → mission center → garage → Studio 808 sequencer → Vault. Real interaction, real audio, `DEMO` data. Runs in Chrome on Android in seconds. *This is achievable first and is genuinely a game loop, minus the city.*
- **Tier 2 — playable world.** Unreal build with the coupe, Harbor Row → 808 Avenue, and Act I stages `hq` → `drive-to-studio` → `produce-master` → `deliver-to-vault` → `complete`. This is the real target and needs engine content that does not exist yet.
- **Tier 3 — shippable.** Signed AAB, device matrix, save durability, approved economy, store metadata. Not in scope of this document.

Recommendation: ship Tier 1 first (weeks, not quarters), and use it to pressure-test the UI contract, the sequencer and the delivery state machine while Tier 2 content is built.

---

## 3. Track A — Tier 1 touch web slice (start here)

Stack that already exists: Next.js 15 + React 19 in `tgg-app/`.

### A1. Get it running

```bash
npm --prefix tgg-app install        # no lockfile is committed; this creates one
npm --prefix tgg-app run dev -- -H 0.0.0.0 -p 3000
```

`-H 0.0.0.0` matters: `next dev` binds loopback by default, and `localhost` on the phone means the phone.

### A2. Add a `/play` route

- One shared typed state object per the handoff: `screenId`, `missionStage`, `releaseState`, `dataMode`, `isPaused`, `phoneOpen`.
- Screens 01, 03, 04, 06, 07 first — they carry the loop. Screen 06 is the only one with real timing logic (16 steps × 5 tracks on the Web Audio clock; never drive audio from the visual playhead).
- Touch rules from the handoff §4 are mandatory: 44 px minimum hit areas, safe-area insets (`env(safe-area-inset-*)`), `touch-action: none` on the controls layer, no accidental page scroll while driving, `dvh` units instead of `100vh` for the Android URL bar.
- Every value that is not server-confirmed shows `DEMO`. No button may award CR, REP, XP or royalty — `missionStage` may advance, balances may not.

### A3. Two ways to open it on the phone

- **Same Wi-Fi (fastest):** find the dev machine's LAN IP (`ipconfig` / `ip addr`), open `http://<ip>:3000/play` on the phone. Nothing is exposed to the internet.
- **Remote (works anywhere, needs hosting):** deploy the app to a hosted environment over HTTPS, then add-to-home-screen as a PWA (`manifest.webmanifest`, `display: standalone`, theme `#0C0E11`). HTTPS is also required for service worker and for reliable audio unlock.

iOS Safari ignores `touch-action: none` on some elements; Android Chrome is the reference target.

### A4. Done when

- Cold open on the phone reaches the title screen in under 3 s on a mid-range device.
- The full `hq → complete` stage chain can be walked with thumbs only.
- Sequencer audio and visuals stay in sync for 2 minutes.
- Wrapping the app, rotating, and backgrounding mid-mission never loses `missionStage`.
- No balance changes without an API call.

Estimated effort: **estimates, not measurements** — 3–6 focused days for a solo builder already fluent in the stack.

---

## 4. Track B — Tier 2 Unreal Android build

### B1. Toolchain (on a build machine, not in this workspace)

| Component | Version to pin |
|---|---|
| Unreal Engine | 5.4.x (5.3 also fine; do not mix source and launcher builds) |
| Android Studio | current, with SDK Platform 34 and Build-Tools 34.0.0 |
| NDK | `25.1.7740956` (the version UE 5.3/5.4 expects — a mismatched NDK is the single most common packaging failure) |
| JDK | 17 |
| Device | Android 10+ (API 29+), 4 GB RAM minimum, Vulkan-capable GPU |

Run `Engine/Extras/Android/SetupAndroid.bat` (Windows) or `SetupAndroid.sh` (Linux/macOS) and let it install/accept licences before the first package. Budget ~100 GB disk for engine + derived data cache.

### B2. Project scaffolding that has to be authored

1. `TggWorld.uproject` referencing `MultiplayerFramework` plus a new `TggWorld` game module.
2. `Config/DefaultEngine.ini` → `[/Script/AndroidRuntimeSettings.AndroidRuntimeSettings]`:
   - `PackageName=tgg.world` (no placeholders — Play rejects `com.YourCompany.*`)
   - `MinSDKVersion=29`, `TargetSDKVersion=34`
   - `bBuildForES31=True`, `bSupportsVulkan=True` (Vulkan first, ES3.1 fallback)
   - `bPackageDataInsideApk=True` for test builds only; ship with AAB + `bUseExternalFilesDir` off
   - `Orientation=Landscape`
3. `Config/DefaultGame.ini` → texture LOD groups and a mobile texture streaming pool.
4. Content: one blockout map (Harbor Row → 808 Avenue), the coupe as a Chaos Vehicle, screen 12 as a UMG mobile HUD, and the five district acoustic zones as audio volumes.
5. Cooking: ASTC (`-cookflavor=ASTC`), no virtual textures, no Nanite on mobile, no Lumen — use a baked/stationary lighting path or a cheap dynamic setup.

### B3. Package it

```bash
"$UE/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun \
  -project="$PWD/TggWorld.uproject" -noP4 -platform=Android \
  -clientconfig=Development -cook -allmaps -build -stage -package -pak \
  -archive -archivedirectory="$PWD/Build/Android"
```

Then:

```bash
adb devices
adb install -r Build/Android/Android_Development/TggWorld-Android-Shipping.apk   # or the Development APK
adb logcat -s UE
```

For iteration, `adb logcat -s UE` plus `-clientconfig=Development` is the loop; a Shipping build is only for perf numbers.

### B4. Performance budget (targets, not measurements)

| Budget | Target |
|---|---|
| Frame rate | 60 fps on Snapdragon 8 Gen 1+, 30 fps floor on Adreno 610-class |
| Render resolution | 1080p max, dynamic resolution 60–100% |
| Draw calls | < 800 visible |
| Triangles | < 1.5 M visible |
| Texture memory | < 700 MB streamed |
| APK/AAB size | < 2 GB download; ASTC 6×6 for most textures, 4×4 only for hero assets |
| Thermal | 20 min session without throttling below the frame-rate floor |
| Battery | < 12%/hour at 30 fps |

Anything measured gets recorded with device model, GPU, Android version and build config. Until then these numbers are design targets and must be labelled as such anywhere they are shown.

### B5. Done when

- Fresh install on a clean device launches to the title screen without a Vulkan/ES fallback crash.
- The coupe can be driven from TGG HQ to Studio 808 with touch controls (screen 12), and the stage chain advances only on the real delivery event.
- Force-kill mid-mission, relaunch, `missionStage` and `releaseState` are intact (requires `od-save-schema-v2`).
- 20-minute session holds the frame-rate floor on the lowest supported device.

---

## 5. Milestones, in order

| # | Milestone | Deliverable | Gate to pass |
|---|---|---|---|
| M0 | Touch harness | `/play` web slice, screens 01–12, Act I loop — **built, not device-tested** | Walked on a real Android phone, no balance changes |
| M1 | APK that boots | Blank Android map + screen 12 HUD | Installs via `adb`, 10 min without crash |
| M2 | Driving slice | Harbor Row → 808 Avenue blockout, coupe | Drive completed with thumbs only |
| M3 | Act I loop | `i-01` → `i-05` incl. sequencer + Vault delivery | Kill/relaunch preserves state |
| M4 | Device matrix | 3 devices: low / mid / flagship | Perf budgets met or budget revised with data |
| M5 | Closed test | Signed AAB to internal track | 10 outside testers, crash-free session rate tracked |

M0 does not depend on M1–M5 and should not wait for them.

---

## 6. What blocks a real build

| Blocker | Owner decision | Why it stops a build |
|---|---|---|
| `od-save-schema-v2` | Approve REP/releases/vehicle persistence | M3 cannot pass kill/relaunch without it |
| `od-economy` | One economy config | A packaged client must not guess at rewards |
| `od-mission-stage-type` | Extend/replace the 5-value union | Acts II–III UI state has no valid type |
| Content production | Approve Higgsfield → Projects pipeline output | There are no maps, meshes or character assets yet |
| Engine/toolchain host | A build machine with UE + Android SDK | Not available in this workspace |

Honest note on this workspace: Unreal Engine and the Android SDK are not installed and cannot be installed usefully here (no GPU display, ~100 GB of engine + DDC, no device attached). Track A can be built and verified here; Track B packaging has to run on your machine or CI runner.

---

## 7. Recommended next three actions

1. Build the `/play` touch slice (Track A) and open it on the phone this week — this is the only path to something in your hand without new content.
2. On your machine, install UE 5.4 + `SetupAndroid` and package a blank map to an APK — this proves the toolchain before any content exists (M1).
3. In parallel, blockout Harbor Row → 808 Avenue and author the coupe; that is the first content that makes Track B feel like TGG World rather than a tech demo.

Until step 1 or 2 lands, the correct description of TGG World on Android is: **designed, scripted and data-validated — not yet playable.**

# TGG World — Android smoke checklist

Run this on a real Android phone, in Chrome, against the deployed preview:
`https://site-3fafc7d6c378497f910b8708af22753c.freebuff.page`

Record the build id, device and Android version with every run. Nothing in this
file has been marked passed from a desktop browser — the desktop checks live in
`BUILD_STATUS.md`, and this sheet is for hardware only.

## 0. Run header

| Field | Value |
| --- | --- |
| Date | |
| Device / model | |
| Android version | |
| Chrome version | |
| Build (bundle bytes or commit) | |
| Tester | |

## 1. Install and first load

- [ ] Page loads in portrait without pinch-zooming to read anything.
- [ ] "Add to Home screen" appears; the installed icon is the lime TGG mark.
- [ ] Launching from the home screen opens full-screen-ish (no browser chrome gap above the HUD).
- [ ] No layout overflow: nothing scrolls sideways on the page itself.
- [ ] Diagnostics opens from the `i` chip and shows fps, draw calls, pixel ratio.

## 2. Menu and save

- [ ] New game → alias accepted → career list scrolls and selects.
- [ ] Continue appears after a save exists, with alias, career and release state.
- [ ] Export writes a JSON file the phone can open or share.
- [ ] Import of that same file restores the run.
- [ ] Quality LOW / BALANCED / HIGH all render without a black frame.

## 3. Phone, map, pause, missions

- [ ] Phone opens, tabs are reachable with a thumb, `×` closes it.
- [ ] Map draws the grid, player arrow, Studio 808, The Vault, TGG HQ and Salt Flats.
- [ ] Tapping a location shows its description and distance.
- [ ] Pause freezes the world (speed and distance stop changing) and Resume restores it.
- [ ] Mission center shows stage N of 3, the cargo line at stage 3, and the Maya entry.

## 4. Studio 808

- [ ] Walk to the mic indoors; prompt reads `E · open the beat desk`.
- [ ] 16 pads per track are tappable in portrait (two rows of eight) without mis-taps.
- [ ] Play starts a loop you can hear; Stop silences it.
- [ ] BPM −/+ changes speed audibly; loop toggle takes effect.
- [ ] Clear needs two taps and keeps tempo and mix.
- [ ] Mute and volume sliders change the mix live.
- [ ] Capture: eight taps in time are accepted; a burst of taps is refused.
- [ ] Closing the panel and opening pause silences playback.
- [ ] Lock the phone and return: audio does not keep playing.

## 5. Mastering and release

- [ ] A rejected take keeps the beat and the review after a reload.
- [ ] Accept & master only enables when every gate is green.
- [ ] Handover at The Vault shows pending, then confirmed, then released.
- [ ] No cash, XP or reputation appears anywhere.

## 6. Salt Flats cargo

- [ ] Drive east to Salt Flats; the apron is drivable and the hangar is solid.
- [ ] Van loads three crates with three presses, then the 90 s clock starts.
- [ ] Hitting a wall hard adds a dent; three dents fail the run and the van returns to the bay.
- [ ] Letting the clock run out fails the run the same way.
- [ ] Reload at the bay and deliver to the Vault dock: terminal completes Act I and the mission center shows Maya unlocked.

## 7. Offline

- [ ] Load once online, then enable airplane mode and relaunch: the shell boots.
- [ ] Offline chip appears; AI director says it needs a connection.
- [ ] Play, save, reload and Continue all work offline.
- [ ] Turning the network back on clears the offline chip.

## 8. Results

| Section | Pass | Fail | Notes |
| --- | --- | --- | --- |
| 1 Install | | | |
| 2 Menu / save | | | |
| 3 Screens | | | |
| 4 Studio | | | |
| 5 Release | | | |
| 6 Cargo | | | |
| 7 Offline | | | |

### Defects found

| # | Section | What happened | Severity |
| --- | --- | --- | --- |
| 1 | | | |

## Self-test (new)

The build now tests itself on the device. Tap the **✓** chip, press **K**, or open the page with `?selftest` at the end of the URL. Nine engine checks run on the phone: offline director, seeded determinism, cargo load/deliver/fail, the burst take gate, the mastering gate, save round-trip and the mix hash. The panel prints `PASS`/`FAIL` per check, and the last result is kept in `localStorage` under `tgg.selftest`.

Record it here: self-test ____/9 passed on ______________ (device, browser).

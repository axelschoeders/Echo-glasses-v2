# ECHO complete package

```
echo-web/        your ECHO webapp            (UNCHANGED)
echo-bridge/     your TV / PC bridge          (UNCHANGED)
ios-companion/   NEW: Swift/SwiftUI app for Ray-Ban Meta glasses
.github/         NEW: optional compile check on a GitHub macOS runner
```

Nothing in `echo-web` or `echo-bridge` was modified.

## How it fits together

```
Ray-Ban Meta ⇄ Meta AI app ⇄ ECHO Glasses (iPhone) ─┬─ HTTPS ─► same AI endpoint as the webapp
                                                    └─ HTTP (LAN) ─► echo-bridge on your PC (TV / PC control)
```

* **AI**: the webapp has no server; it calls an OpenAI-compatible endpoint with your own key.
  In the webapp tap **Koppel bril-app**, then in the companion app tap **Plak koppelcode**.
  The app reuses the same URL/model/key (key stored in the iOS Keychain). No second assistant.
* **Vision**: images go to the same endpoint. The model must accept images
  (e.g. Gemini Flash). Set a separate *Vision-model* in the app if your text model can't.
* **Bridge**: paste the bridge address (with `#t=...`). Voice/typed commands such as
  "zet de tv harder" or "vergrendel de pc" go to the bridge; the TV & PC button opens the
  bridge's own remote page. Shutdown/restart are intentionally not available by voice.
* **Glasses**: Meta Wearables Device Access Toolkit (registration, session, camera stream).
  The "KIJK" button sends the newest camera frame to the AI and speaks the answer.
* **Simulation**: three modes in Settings: *Simulatie* (bundled test image, no SDK),
  *Meta MockDeviceKit* (official simulator), *Echte bril*.

## Voice commands (Dutch)
"wat zie je" · "zet de tv harder/zachter/aan/uit" ("iets harder", "veel zachter", "3 keer harder", "zet de tv op volume 20") · "dempen" · "vergrendel de pc" ·
"pc slaapstand" · "pc pauze" · "open Netflix" / "open Disney plus" (op de tv) · "open <app uit config.json>" · "zoek … op", "wat is het weer in …", "nieuws" → internet (Gemini: Google Search; Groq: compound web search) · "maak een 3D model van een kasteel" → 3D viewer (shapes built by the AI, rotate by touch, export .usdz) · anything else → ECHO AI.

## Honest status
* The Swift code was **written without access to a Swift compiler or a Mac and has never been built
  or run.** Expect a few compile fixes. The included GitHub workflow builds it on a macOS runner so you
  can see errors from Windows (see `ios-companion/README-XCODE.md`).
* Meta's SDK is in developer preview and changes. Code follows Meta's docs as of Nov 2026
  (Wearables.configure, createSession, addCamera, StreamConfiguration, MockDeviceKit).
* The webapp can't call the bridge from an https page (mixed content); the native app can.

## Changes to echo-bridge (additive only)
`echo_bridge.py` and `remote.html` gained TV app launching (Netflix, Disney+): endpoint `/api/tv/app`,
`tvApps` in `/api/state`, and app buttons on the remote page. Existing endpoints are unchanged.
App IDs differ per TV model/region; override in `config.json`, e.g. `"tv_apps": {"Netflix": ["3201907018807"]}`.

---
## Upgrade 1 (additive, nothing removed)

**echo-web/echo-3d.js** (new, loaded by index.html, ~3 tiny hooks in `route()`)
- "maak een 3D model van …" builds a model through your existing AI endpoint, shows it in a full-screen viewer (works in Safari on iPhone and on PC).
- Touch: 1 finger rotate, 2 fingers zoom. **Gebaren** button: webcam hand tracking (MediaPipe): pinch = grab/rotate, two hands pinching = zoom, fist = explode.
- Computer-type models (PC, laptop, console…) get labelled internal parts; "uitklappen" / button = animated explosion view.
- Export: STL (3D printing, 1 unit = 100 mm), OBJ, GLB. Libraries load from jsDelivr (pinned versions), so you need internet.
- "stop alle processen" (typed or spoken in the webapp) stops speech, listening, 3D and camera.

**echo-bridge/echo_security.py** (new, wired into echo_bridge.py)
- Auto-blocks an IP after 5 wrong tokens in 5 min (15 min block). Watches for new listening ports and Defender/Firewall turned off. Log: `security.log`.
- **Panic**: red STOP button on the remote page, `/api/panic`, and the iOS voice command "stop alle processen". Stops everything ECHO started, cancels a pending shutdown, then refuses all commands until `/api/panic/resume`. It does NOT kill other Windows processes.
- **Spoken alerts (no third-party service)**: critical incidents are spoken out loud on the PC, and pushed to `/api/alerts`. The remote page (button *Beveiligingsalarm*) and the glasses app poll it every few seconds and speak it themselves (through the glasses when they are the audio output). Works on the same Wi-Fi only, with the page/app open. A real phone call needs a telecom service, so it is not included.
- iOS: added the "stop alle processen" intent to `CommandRouter.swift` (not compiled, like the rest of the Swift code).

Tested: Python syntax, panic/resume/halt, brute-force block. NOT tested: 3D viewer in a browser, hand tracking, Twilio, Windows monitors, Swift edit.

---
## Upgrade 3: new look
- **Main screen** (`echo-web/echo-hero.js`): a living particle humanoid with orange core, expanding rings, mountain-wave terrain and a status readout (STANDBY / LISTENING / THINKING / SPEAKING). Reacts to your finger. The old orb is replaced, but `#orb` is still the tap target so every voice/tap feature works as before.
- **Theme 2 "obsidian + amber"**: settings, lock screen, app viewer, 3D viewer and the bridge remote page.
- The previous design is kept as `echo-web/index-classic.html`.

---
## Upgrade 4: clap detection (`echo-web/echo-clap.js`)
- Button **Klap: aan/uit** next to "Hey Echo", sensitivity slider in Instellingen.
- 2 claps = start listening (same as tapping the figure). 3 claps = "stop alle processen" (local stop).
- Listens only while ECHO is idle and the page is visible (releases the mic when ECHO listens/speaks, and is not used together with "Hey Echo"). Audio is analysed on the device only.
- Tested with synthetic audio: double clap, triple clap, single clap ignored.

---
## Upgrade 5: klappen + Jarvis-stem overal
**Klapdetectie** (2 klappen = luisteren, 3 klappen = alles lokaal stoppen)
- `echo-web/index.html` en `index-classic.html`: knop *Klap: aan/uit* + gevoeligheid in Instellingen (classic kreeg er `ECHOSTATE` bij).
- `echo-bridge/remote.html`: eigen knop *Klap* rechtsboven (standaard uit). 2 klappen = tv dempen, 3 klappen = pc vergrendelen. De browser geeft alleen microfoontoegang via https of localhost; via `http://192.168.x.x` meldt de pagina dat. De bridge serveert `echo-clap.js` en `echo-jarvis.js` nu zelf (vaste lijst).
- iOS (`Voice/ClapDetector.swift`): Instellingen > *Stem en klappen*. Werkt met de iPhone-microfoon terwijl de app open is, of terwijl "Hey Echo" aan staat (zelfde microfoonstroom). Tijdens het praten van ECHO stopt een klap de spraak. 3 klappen stopt lokaal, de bridge-noodstop gaat niet automatisch af (zeg daarvoor "stop alle processen").
**Jarvis-stem** (`echo-web/echo-jarvis.js`, iOS `SpeechOutput.swift`)
- Diepste mannelijke stem die op het toestel staat (Nederlands), lagere toonhoogte, rustig tempo, zacht "online"-geluid voor de eerste zin. Werkt op elke pagina die deze scripts laadt, ook de alarmmeldingen.
- Een gekozen stem in Instellingen blijft winnen. Test-knop in Instellingen.
- Beperking: dit is geen kloon van de filmstem. Een browser/iPhone kan alleen een geïnstalleerde stem kiezen en bijstellen. Installeer een "Verbeterde" of "Premium" stem voor het beste resultaat.
**Getest:** JS-syntax van alle pagina's, Python-syntax van de bridge, stemkeuze met een nagebootste browser. **Niet getest:** klappen in een echte browser/iPhone (de detectie-instellingen zijn overgenomen uit upgrade 4), de Swift-code (nog nooit gecompileerd, zie hierboven).

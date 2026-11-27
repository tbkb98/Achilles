# Achilles

A training log for a Super Squats program, built as a Home Screen web app for iPhone. Plain HTML, CSS and JavaScript: no framework, no build step, no tracking, no network calls after the first load.

**Everything you log stays on your phone.** This repository holds only the app's code. It contains no personal data.

## Install on iPhone

1. Open the site address in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open **Achilles** from the new icon. From now on it works without a connection.
4. In **Settings → Import a setup or history file**, pick your `achilles-setup.json` (saved in the Files app). This brings in your latest loads.

Always open Achilles from the Home Screen icon. Safari and the Home Screen app keep separate storage.

## What it does (version 1.1)

**Training**
- Shows what is due today (Upper or Lower) with the target load for every lift, worked out from your last session.
- Logs a set in one tap. Steppers correct weight and reps without a keyboard; hold a stepper to repeat.
- Breathing Squat Mode: a display you read from under the bar, with time-based cues. You confirm the reps after racking.
- Leg-extension protocol runner with a 20-second hold timer and a stopwatch for the last hold.
- Rest and transition timers based on clock time, with a ring bell, a flash and a tick at ten seconds. The screen stays awake during a session.
- Undo, skip, do later, add an exercise, session note, end early. Restores the exact session after the app is closed or killed.
- History with editing: fix reps or loads after the fact, or delete a session.

**Eating**
- Your meal plan as slots, one tap each. Portions (½ to 2×), "something different today", skipped, extras, and a milk counter.
- Each meal can carry a protein value; totals count what has one.
- Changing a meal changes the plan from today on. Earlier days keep the target they were logged against.

**Body and recovery**
- Morning weigh-in, 7-day average, and change on the week before (needs four weigh-ins in a week).
- Sauna and hammam: log the minutes you actually did, change them later, or run a timer that keeps counting past the bell and logs the real time.
- Stretching check-offs and a reminder of your own rule if you log cold exposure within four hours of training.

**Data**
- Backup to a JSON file, restore from it, export sets as CSV, export in the wide sheet layout.

Not yet: hero stages, progress charts, goals, pillars library, template editor (milestone 3).

## Limits of a web app on iPhone

- The bell and flash only fire while Achilles is open on screen. A locked phone stays silent: iOS gives web apps no way to schedule a notification without a server.
- No Apple Health, no Lock Screen countdown.

## Back up

**Settings → Back up to a file** saves `achilles-backup-DATE.json` through the share sheet; choose **Save to Files**. Do this weekly. **Restore from a backup** replaces everything on the phone with the contents of that file.

Removing the Home Screen icon deletes the app's data. Back up first.

## Update

**Settings → Check for an update.** A new version installs only when you tap it, never during a session.

## Develop

```
python3 -m http.server 8000        # serve the folder, open http://localhost:8000
npm test                           # engine and session rules (Node 20+)
python3 tools/precache.py .        # refresh the offline file list in sw.js after adding files
python3 tools/sprites.py assets/sprites   # regenerate hero sprites (needs Pillow)
```

After changing any file, bump `VERSION` in `sw.js` (and `js/app.js`) so installed copies see the update. The site is served from the `gh-pages` branch: push `main` to both.

Layout: `js/engine/` holds the pure rules (progression, layoff, plates, schedule, session flow, eating totals and weight trend), `js/ui/` the screens, `js/state.js` and `js/store/db.js` the on-device storage, `seed/program.js` the exercise library and templates.

Fonts: Press Start 2P and Jersey 15, both under the SIL Open Font License (licences in `assets/fonts/`).

# English Next Level

English Next Level is a browser game for practicing English numbers, vocabulary, matching, and pronunciation.

## Stack

- Static HTML, CSS, and JavaScript; the site has no build step.
- Firebase Web SDK compat 13.0.0 for Authentication, Cloud Firestore, and callable Cloud Functions.
- GitHub Pages for static hosting.

## Run locally

Install the server-function dependencies once from the `functions` folder:

```powershell
Push-Location functions
npm ci
Pop-Location
```

Run the Firebase emulators in one PowerShell window. The `demo-` project ID is local-only and has no live Firebase resources:

```powershell
npm run firebase:emulators
```

In a second PowerShell window, serve the project files over HTTP:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Then open `http://localhost:8000/`. Only the published HTTPS address `https://wolfschiffer.github.io/EnglishNextLevel/` on the standard HTTPS port connects to production Firebase by default. Other paths or ports on that host, local files, `localhost`, LAN addresses, and other preview hosts use the local Auth, Firestore, and Functions emulators. Add `?enlFirebase=test` to the published URL to force emulator mode there too. Add `?enlFirebase=qa` to use the separate `englishnextlevel-qa` project for QA. If the emulators are stopped, Firebase requests fail locally and do not fall back to production. Opening the site on a phone through a LAN IP also fails closed; to use local emulators on the phone, their address needs a deliberate LAN setup.

The emulator suite requires Node.js 22, npm, and Java JDK 21. The first run downloads the pinned Firebase CLI and emulator binaries, so it needs internet access. Emulator data is temporary and resets when the process stops unless you explicitly export it.

If the Firebase SDK cannot load from its CDN, the page keeps the local guest option available and explains that account features are offline. Progress and scores then stay on the current device.

## Project layout

- `index.html`: application shell and script/style entry points.
- `css/`: shared layout, game modes, topic screens, progress, and mobile navigation styles.
- `js/game.js`: navigation and category screens.
- `js/numbers-data.js`: Number pools and number-word generation for the Numbers game.
- `js/numbers-run-session.js`: verified server-run questions and answer coordination for Numbers.
- `js/numbers-scoring.js`: pure round and final score calculations for the Numbers game.
- `js/numbers-high-score-storage.js`: local high-score loading and saving for the Numbers game.
- `js/numbers-high-score-profile.js`: selects and caches high scores by local, guest, or signed-in profile.
- `js/numbers-eagle.js`: canvas movement and animation for the Numbers game eagle.
- `js/numbers-image-loader.js`: loads the Numbers idle image and lazy-loads gameplay eagle sprites.
- `js/numbers-round-feedback.js`: short-lived correct and incorrect answer feedback for Numbers.
- `js/numbers-answer-options.js`: correct-answer position and distractor selection for Numbers.
- `js/numbers-fallback-questions.js`: fills verified-run fallback questions without repeating seen values.
- `js/numbers-game.js`: Numbers scoring and round flow.
- `js/progress-profile-data.js`: pure normalization and merging for saved progress.
- `js/progress-profile-summary.js`: pure formatting and completion summaries for the progress screen.
- `js/progress-profile-renderer.js`: profile identity, progress cards, and overall progress display.
- `js/words-speech.js`: Words pronunciation and speech synthesis.
- `js/vocabulary-game.js`: Words screen, timing, scoring, and menu coordination.
- `js/vocabulary-matching.js`: Words drag-and-drop, keyboard selection, pair validation, and completion.
- `js/vocabulary-scoring.js`: speed bonus points for Words matching.
- `js/vocabulary-result-dialog.js`: Words results display, delayed opening, and replay/back actions.
- `js/vocabulary-touch-input.js`: mobile touch drag-and-drop behavior for Words matching.
- `js/vocabulary-renderer.js`: builds the English and Portuguese word cards and connects their input and audio handlers.
- `js/words-data.js`: vocabulary sets used by the Words activities.
- `js/category-navigation.js`: category-card actions, keyboard activation, and category back buttons.
- `js/audio-engines.js`: shared speech and sound effect engines.
- `js/spaced-review.js`: FSRS-based review sessions for completed Words sets.
- `js/firebase-environment.js`: selects production, QA, or local emulator configuration from the site URL.
- `js/firebase-offline-fallback.js`: preserves guest play when the Firebase Auth or Firestore SDK cannot load.
- `js/password-reset.js`: password reset form, generic account-safe responses, and resend cooldown.
- `js/email-verification.js`: email-verification screen, resend flow, and verification cooldown.
- `js/auth-ui.js`: login, registration, guest entry, and sign-out interface handlers.
- `js/firebase-config.js`: Firebase initialization, sign-in, registration, and session state.
- `js/leaderboard-storage.js`: local leaderboard persistence and validation.
- `js/leaderboard-dialog.js`: Numbers leaderboard window and its tabs, loading, and fallback display.
- `js/numbers-leaderboard.js`: connects the Numbers game to leaderboard storage, cloud submission, and the leaderboard window.
- `js/numbers-result-dialog.js`: Numbers end-of-round results and score submission controls.
- `js/progress-profile.js`: local/cloud progress synchronization and profile render orchestration.
- `js/topics/data/`: one vocabulary file per topic, so a topic can be edited without navigating the full catalog.
- `js/topics/topics-data.js`: checks and assembles the topic files into the frozen catalog used by the game.
- `js/topics/`: topic matching, speech, menu, and statistics. `speech-answer.js` checks recognized answers; `speech-audio.js` handles speech synthesis; `speech-settings.js` owns Speak audio preferences and controls; `speech-recognition.js` owns browser microphone recognition and retry behavior; `speech-page-lifecycle.js` suspends and resumes microphone use as the page loses or regains focus.
- `images/`: assets served by the site.
- `tests/` and `scripts/`: automated checks.
- `Testing/`: local artwork sources and review exports; image and media files are excluded from Git.

JavaScript files are loaded as classic scripts from `index.html`, so script order is part of the application setup.

## Quality checks

Node.js is enough; the checks use built-in Node tools and do not need installed packages:

```powershell
node scripts/check-js.cjs
node --test "tests/*.test.cjs"
```

The same checks run automatically on pushes and pull requests through GitHub Actions. CI also starts the local Auth, Firestore, and Functions emulators and runs the Rules and score-submission integration checks against the `demo-` project.

These checks cover JavaScript syntax, local leaderboard storage, progress recovery, emulator routing, audio engine behavior, spaced review scheduling, Words and Topics data, keyboard matching, Firestore Rules, and the callable score function. They do not replace browser gameplay, audio, or responsive-layout testing.

With the emulators running, check the local Firestore Rules separately:

```powershell
npm run test:firestore-rules
```

The callable leaderboard function can also be checked against the local Auth, Firestore, and Functions emulators:

```powershell
npm run test:submit-score
```

This verifies the email-verification gate, score validation, best-score updates, and that the public leaderboard name comes from the saved account profile.

## Debug logging

Verbose diagnostic messages are off by default. Add `?debug=1` to the page URL to enable them in the browser console.

## Firebase security

`firestore.rules` is loaded by the local emulator. The emulator and Functions service bind to `127.0.0.1` and use the `demo-english-next-level` demo project, so local requests cannot fall through to a cloud database. The client cannot write leaderboard scores directly; callable functions validate submissions before writing them. A run start returns only its question count. The server returns one prompt and its answer choices when that question's timer starts, and keeps the answer value private. This reduces bulk extraction of a run, but cannot prove a person is playing by hand: a verified user can still automate the visible questions. Per-account run limits reduce the volume of automated attempts; they do not eliminate this fair-play risk.

The server starts each question timer before returning its prompt. Network and rendering delay can therefore make the global speed bonus lower than the in-game estimate.

Numbers run starts are limited to 10 per account in 10 minutes. Starting a question and submitting an answer are each limited to 60 validly shaped calls per account in any rolling 60-second period; finishing a run and submitting its score are each limited to 10 calls per account in any rolling 60-second period. These server-side limits use Firestore transactions, so concurrent requests for the same account share one counter. Each limited call also reads its recent request timestamps and writes them when accepted. The limits reduce repeated calls from verified accounts, but do not stop account farming or replace App Check. App Check still needs configuration and testing against the QA project before broad deployment.

Each callable function now has a maximum of 10 instances to limit automatic scaling during traffic spikes. This is a per-function capacity setting, not a per-account request limit or a hard spending cap. If a function reaches that ceiling and no instance becomes available within 30 seconds, new requests may be rejected with HTTP 429. Verify expected traffic in QA before deployment.

The published GitHub Pages URL still points to the existing production Firebase project. These local rules have not been deployed, and the production rules have not been inspected or changed. The `qa` alias and `?enlFirebase=qa` mode point to the separate `englishnextlevel-qa` project. Email/password sign-in is enabled there, but no QA users have been created. Cloud Firestore still needs initial setup and a permanent region choice; its rules and the callable Functions have not been deployed or validated there. The QA project remains on the Spark plan; deploying callable Functions would require enabling billing (Blaze), which has not been done. Local automated tests use only the `demo-` emulators.

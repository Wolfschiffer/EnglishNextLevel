# English Next Level

English Next Level is a browser game for practicing English numbers, vocabulary, matching, and pronunciation.

## Stack

- Static HTML, CSS, and JavaScript; the site has no build step.
- Firebase Web SDK compat 10.7 for Authentication and Cloud Firestore.
- GitHub Pages for static hosting.

## Run locally

Run a local HTTP server from the project root instead of opening `index.html` as a file:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000/`. If Firebase Authentication rejects the local sign-in, check whether `localhost` is listed under the project's authorized domains in Auth settings.

## Project layout

- `index.html`: application shell and script/style entry points.
- `css/`: shared layout, game modes, topic screens, progress, and mobile navigation styles.
- `js/game.js`: Numbers and Words game flows, navigation, and leaderboard UI.
- `js/firebase-config.js`: Firebase initialization and account flows.
- `js/leaderboard-storage.js`: local leaderboard persistence and validation.
- `js/progress-profile.js`: local/cloud progress synchronization and profile UI.
- `js/topics/`: topic data, matching, speech, menu, and statistics.
- `images/`: assets served by the site.
- `tests/` and `scripts/`: automated checks.
- `Testing/`: local artwork sources and review exports; image and media files are excluded from Git.

JavaScript files are loaded as classic scripts from `index.html`, so script order is part of the application setup.

## Quality checks

Node.js is enough; the checks use built-in Node tools and do not need installed packages:

```powershell
node scripts/check-js.cjs
node --test
```

The same checks run automatically on pushes and pull requests through GitHub Actions.

These checks cover JavaScript syntax and local leaderboard storage. They do not replace browser gameplay, audio, responsive-layout, or Firestore Rules testing.

## Debug logging

Verbose diagnostic messages are off by default. Add `?debug=1` to the page URL to enable them in the browser console.

## Firebase security

The repository does not contain a Firestore rules file. Review the deployed rules in the Firebase console before changing data access; the client code alone cannot establish that the database is protected.

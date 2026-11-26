# The Island Mystery — Firebase + GitHub Pages edition

A five-word **shared crossword** for the From This Island Marketing Management presentation. Every player sees the same grid; the **first correct submission** locks the word and immediately fills the presenter's projected grid and every participant's mobile screen.

## Files

| File | Purpose |
|---|---|
| `index.html` | Participants open this URL through the QR code |
| `leaderboard.html` | Presenter shares this page on the projector; includes game controls and live scores |
| `config.js` | Your Firebase web configuration, session ID, and presenter's anonymous UID |
| `firestore.rules` | Secure Firestore rules to paste and publish in Firebase Console |
| `app.js`, `style.css` | Shared gameplay logic and From This Island theme |
| `assets/` | Compressed botanical illustrations |

## 1. Firebase setup

1. Open https://console.firebase.google.com/ and create a Firebase project. Google Analytics is optional.
2. Under **Build → Authentication → Sign-in method**, enable **Anonymous** authentication.
3. Under **Build → Firestore Database**, create the database (e.g. Jakarta `asia-southeast2`) in **production mode**. Do NOT use permanent open/test-mode rules.
4. Under **Project settings → General → Your apps → Web**, register a web app. Copy its `firebaseConfig` values into `config.js` (`apiKey`, `authDomain`, `projectId`, `appId`). These are public web app identifiers, not private service-account credentials.
5. Publish the files on GitHub Pages as described in section 2. Open `leaderboard.html` **in the presenter's browser**, which will silently sign in anonymously and show the browser's Firebase UID in the **Firebase Presenter Setup** area. Copy that UID.
6. Paste **that exact UID** into the `PRESENTER_UID` value in `config.js` and the `isPresenter()` comparison in `firestore.rules`. Re-upload the changed `config.js`.
7. Open **Firestore Database → Rules**, paste the entire `firestore.rules`, and **Publish**. Then refresh the presenter page. Only that UID can initialize/start/end/reset and manually fill answers.

> If you erase browser site data, switch profiles, or use another laptop for the presenter, Firebase Anonymous Authentication may assign a NEW UID. Update the two UID references and publish the rules again. Do NOT sign in as the presenter on a public/shared browser.

## 2. Publish to GitHub Pages

1. Create a public repository, such as `FromThisIslandGame`, in GitHub.
2. Upload the contents of this folder to the repository **root**, keeping the filenames and the `assets` directory intact.
3. Under **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**, and **Save**.
4. Your URLs will look like:
   - **Player:** `https://YOUR_USERNAME.github.io/FromThisIslandGame/` (same as `/index.html`)
   - **Presenter:** `https://YOUR_USERNAME.github.io/FromThisIslandGame/leaderboard.html`
5. The presenter page automatically displays a QR code for the player URL when its QR library loads. The ordinary player link also appears below it, so you can make the QR in Canva if the QR script is blocked by campus Wi-Fi.
6. **Do not** place any Firebase Admin SDK keys or private service-account files in the public repository.

## 3. Rehearse and go live

1. Leave `SESSION_ID = 'rehearsal-1'` in `config.js` when testing, and use two **different devices or browser profiles** to represent two players.
2. Open `leaderboard.html` on the presenter laptop, press **Initialize session** (the first time only), then **Start round**.
3. Each participant opens `index.html`, enters a nickname, chooses a clue, and submits a **whole-word answer**. Correct words automatically show on all boards in green; the claim is locked.
4. Presenter can press **Fill** beside any unclaimed clue to reveal it without assigning a player point.
5. **New round** creates a new round ID and clears the on-screen grid and scores. Older claims stay in Firestore for the archive; they are not reused.
6. For the actual presentation, update `SESSION_ID = 'live'` in `config.js`, re-upload the file, and open the presenter page to initialize the new session. Do this **before** participants scan the QR code.

## 4. Scoring, timing, and fairness

- One correctly claimed word = **1 point**. Presenter-filled words give no points.
- Every claim uses a **Firestore transaction** and a document keyed by the word itself. Concurrent claims cannot both succeed.
- Claims and starts use `serverTimestamp()`; Firestore Security Rules enforce the **180-second deadline with server time**.
- Scores update live from Firestore snapshots. The leaderboard sorts by number of words claimed, then the earliest server claim timestamp as a tiebreaker.
- All participants are authenticated anonymously; Firestore rules deny updates/deletes of existing claims and restrict presenter operations to the specified UID.
- **Classroom-level limitation:** the answers are in the public JavaScript source (and Firestore rules). Someone using developer tools could inspect them. This is a casual icebreaker, not a high-stakes competition.
- **Connectivity limitation:** Firestore transactions require an active connection. If a device loses network access, it cannot claim a word until reconnected.
- **Clock display limitation:** phone timers are visual approximations; Firebase rules use server time to accept/reject submissions.

## 5. Design preview before Firebase

Leave `config.js` placeholders unchanged. This starts **LOCAL DEMO MODE** (no real cloud sync). Open the site through a local HTTP server:

```bash
cd FromThisIsland_Crossword_Firebase
python3 -m http.server 8000
```

Then visit `http://localhost:8000/leaderboard.html` and `http://localhost:8000/index.html` in two tabs of the **same browser**. They share demo state through `localStorage` events. **Demo mode does not synchronize different devices.** After entering Firebase credentials, demo mode is disabled automatically. If Firebase configuration is invalid, the app shows a connection error instead of silently pretending to be live.

Because JavaScript modules are used, double-clicking `index.html` from `file://` may fail due to browser security restrictions.

## 6. Firestore data model

```
sessions/{SESSION_ID}
  status: 'waiting' | 'live' | 'finished'
  roundId: 'round-...'
  startedAt: server timestamp or null
  durationSec: 180
  updatedAt: server timestamp

sessions/{SESSION_ID}/rounds/{roundId}/claims/{WORD_ID}
  answer: 'GUAVA'
  nickname: 'Sandra'
  uid: <Firebase anonymous UID>
  source: 'player' | 'presenter'
  claimedAt: Firebase server timestamp
```

This separation is important: the shared grid is **derived from immutable claims**, not overwritten wholesale by each player. That is what prevents two phones from claiming the same word at once.

## References

- Firebase anonymous authentication: https://firebase.google.com/docs/auth/web/anonymous-auth
- Firestore transactions: https://firebase.google.com/docs/firestore/manage-data/transactions
- Firestore realtime listeners: https://firebase.google.com/docs/firestore/query-data/listen
- Firestore rules: https://firebase.google.com/docs/firestore/security/rules-conditions
- GitHub Pages publishing: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

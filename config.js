/**
 * THE ISLAND MYSTERY — EDIT THIS FILE BEFORE PUBLISHING.
 * Firebase web app keys are normally public client configuration, NOT private service-account credentials.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCj2vtITWHf0eIppbXY0pIF4I7y0dSCfEU',
  authDomain: 'mmweek13.firebaseapp.com',
  projectId: 'mmweek13',
  storageBucket: 'mmweek13.firebasestorage.app',
  messagingSenderId: '736797158672',
  appId: '1:736797158672:web:e3c62cec2fdf69d46c4995'
};

// Change for each rehearsal, then use "live" for the presentation.
export const SESSION_ID = 'rehearsal-1';

// Get this from leaderboard.html after signing in anonymously on the PRESENTER browser.
// Paste the exact same UID in firestore.rules before using presenter controls.
export const PRESENTER_UID = 'PASTE_PRESENTER_ANONYMOUS_UID';

export const GAME_DURATION_SECONDS = 180;

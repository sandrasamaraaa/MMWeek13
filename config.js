/**
 * THE ISLAND MYSTERY — EDIT THIS FILE BEFORE PUBLISHING.
 * Firebase web app keys are normally public client configuration, NOT private service-account credentials.
 */
<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyCj2vtITWHf0eIppbXY0pIF4I7y0dSCfEU",
    authDomain: "mmweek13.firebaseapp.com",
    projectId: "mmweek13",
    storageBucket: "mmweek13.firebasestorage.app",
    messagingSenderId: "736797158672",
    appId: "1:736797158672:web:e3c62cec2fdf69d46c4995",
    measurementId: "G-CF6QKEP675"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>

// Change for each rehearsal, then use "live" for the presentation.
export const SESSION_ID = 'rehearsal-1';

// Get this from leaderboard.html after signing in anonymously on the PRESENTER browser.
// Paste the exact same UID in firestore.rules before using presenter controls.
export const PRESENTER_UID = 'PASTE_PRESENTER_ANONYMOUS_UID';

export const GAME_DURATION_SECONDS = 180;


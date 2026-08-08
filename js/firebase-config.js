// Dragunfly — Territory mode backend config.
// Paste your own free Firebase project's config below (see docs/territory-setup.md).
// A Firebase web API key is not a secret — it just identifies which project
// to talk to. Access control is enforced by Firestore security rules, not
// by hiding this value, so it's safe to commit and to ship in the browser.
window.FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
};

window.TERRITORY_ENABLED = window.FIREBASE_CONFIG.apiKey !== "PASTE_YOUR_API_KEY";

# Territory mode — one-time free setup

Territory mode needs a shared backend (so every pilot sees the same
claimed tiles), unlike the rest of Dragunfly which runs with zero server.
We use **Firebase** because the free tier ("Spark plan") needs no credit
card and is plenty for this. Takes about 5 minutes, one time only.

## 1. Create the Firebase project
1. Go to **https://console.firebase.google.com** and sign in with a Google account.
2. Click **Add project**.
3. Name it (e.g. `dragunfly`), click through the steps. You can turn off
   Google Analytics when asked — not needed here.

## 2. Register a web app
1. On the project's home page, click the **</>** (web) icon to add a web app.
2. Give it a nickname like "Dragunfly Web" and click **Register app**.
3. Firebase shows a `firebaseConfig` object with values like `apiKey`,
   `authDomain`, `projectId`, etc. Copy those.
4. Open `js/firebase-config.js` in this repo and paste each value in,
   replacing the `"PASTE_YOUR_..."` placeholders.

## 3. Turn on Firestore (the database)
1. In the left sidebar, go to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode**, pick any location, click **Enable**.
4. Click the **Rules** tab and replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /territories/{tileId} {
      allow read: if true;
      allow create: if request.auth != null
        && resource == null
        && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

5. Click **Publish**.

This is what makes tile-claiming safe without writing any server code:
a tile can only ever be created once (first pilot to fly there keeps it
forever) and only by the person who's actually claiming it.

## 4. Turn on anonymous sign-in
1. In the left sidebar, go to **Build → Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, click **Anonymous**, toggle it **Enable**, click **Save**.

This gives each pilot a private, unnamed ID behind the scenes — no
login screen, no email/password, no personal info collected.

## 5. Done
Once `js/firebase-config.js` has your real values, the **Territory** tab
in the app lights up automatically — no code changes needed.

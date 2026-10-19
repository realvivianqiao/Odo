# odo for iPhone

This folder is the iPhone app. The app itself is the same `index.html` at the root of this repo
(what Vercel deploys); `npm run build` copies it in and adds the native parts
(Apple speech recognition, haptics, the share sheet).


## Every time you change the app

```
cd ios
npm install          # first time only
npm run build        # copies the web app into the iPhone app
npm run open         # opens Xcode
```

## One-time setup, in order

### 1. Apple Developer Program ($99/yr)
developer.apple.com/programs → Enroll as an individual. Approval can take a day or two.

### 2. Create the app in App Store Connect
App Store Connect → Apps → + New App
- Platform iOS · Name `odo: Dream Journal` · Language English (U.S.)
- Bundle ID `app.odo.dreams` (if it's not in the list, let Xcode create it in step 3)
- SKU `odo-ios`

### 3. Build and run on your iPhone
```
npm install && npm run build && npm run open
```
In Xcode: click **App** (blue icon, left) → Signing & Capabilities → Team = you.
Plug in your iPhone, pick it at the top, press ▶.
First run: on the phone, Settings → General → VPN & Device Management → trust yourself.

### 4. Upload
Xcode → top bar device = "Any iOS Device (arm64)" → Product → Archive → Distribute App →
App Store Connect → Upload. It shows up in App Store Connect after ~15 minutes.

### 5. Fill in the listing and submit
Then Add for Review → Submit.

## What's in here
- `src/native.js` – the native bridge (speech, haptics, share)
- `build.mjs` – builds `www/` from the web app at the repo root
- `ios/` – the Xcode project (iPhone only, portrait, dark)

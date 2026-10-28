# Last Stand as an Android app

The game is packaged with [Capacitor](https://capacitorjs.com). The app is the same game as
`laststand.html` and the `laststand/` folder, copied in unchanged, so any change to the game shows up
in the app after a sync.

## Get the APK without installing anything

1. Open the **Actions** tab on GitHub and choose **Build Android APK**.
2. Click **Run workflow** (or push to the branch; it also runs by itself).
3. When the run finishes, download **last-stand-debug-apk** from its Artifacts section.
4. Copy `app-debug.apk` to the phone and open it. Allow "Install unknown apps" for your file manager when asked.

The debug build is for testing. A build for the Play Store needs a signing key, which is not set up yet.

## Build on your own computer

You need Node 22+, JDK 21 and Android Studio (for the Android SDK).

```bash
npm ci
npm run sync          # copies the game into www/ and then into the Android project
npm run open          # opens the project in Android Studio; press Run to install on a phone
```

To build the APK from the command line:

```bash
cd android
./gradlew assembleDebug
```

The APK is then at `android/app/build/outputs/apk/debug/app-debug.apk`.

Run `npm run sync` again after every change to the game.

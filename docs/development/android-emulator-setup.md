# Android Emulator Setup (Windows)

For running `mobile/` locally during development. One-time setup.

## 1. Install Android Studio

Download from https://developer.android.com/studio and run the installer. Accept the default "Standard" install type — it pulls in the Android SDK, platform tools, and emulator automatically.

## 2. Create a virtual device (AVD)

1. Open Android Studio → **More Actions** → **Virtual Device Manager** (or **Tools → Device Manager** if a project is already open).
2. Click **Create Device**.
3. Pick a phone profile — **Pixel 7** or similar is a safe default.
4. Pick a system image. Choose the latest with a **Play Store** icon (e.g. API 34/35, "UpsideDownCake"/"VanillaIceCream"). Click **Download** next to it if not already installed.
5. Finish the wizard, accepting defaults.
6. Press the ▶ play icon next to the new device in Device Manager to boot it once, confirming it starts correctly, then close it.

## 3. Set environment variables

Android Studio installs the SDK but your terminal needs to know where it is.

1. Find the SDK path: Android Studio → **Settings → Languages & Frameworks → Android SDK** → copy the "Android SDK Location" path (typically `C:\Users\<you>\AppData\Local\Android\Sdk`).
2. Open **Settings → System → About → Advanced system settings → Environment Variables**.
3. Add a new **User variable**:
   - Name: `ANDROID_HOME`
   - Value: the SDK path from step 1
4. Edit the `Path` user variable, add these two entries:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
5. Close and reopen any terminal for the change to take effect.

## 4. Verify

```
adb --version
emulator -list-avds
```

Both should return output, not "command not found."

## 5. Run the app

```
cd mobile
npm install
npm run android
```

This boots your AVD (if not already running) and installs/launches the app on it. First run is slow (native build); subsequent runs are fast.

## Troubleshooting

- **"adb: command not found"** — environment variables didn't take effect. Fully close and reopen your terminal (and VS Code, if using its integrated terminal).
- **Emulator boots but app install hangs** — check Windows Defender / antivirus isn't blocking the emulator's network loopback; this is a common false positive.
- **"HAXM" or virtualization errors** — enable virtualization in your BIOS, or enable Windows Hypervisor Platform in *Turn Windows features on or off*.
- **Metro bundler starts but app shows a red error screen** — usually a real code error, not a setup problem; read the stack trace.

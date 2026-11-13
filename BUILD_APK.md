# MeInspect — Android Build and Play Store Publishing Guide

## Current release

- Version name: **3.5**
- Version code: **10**
- Application ID: `com.meinspect.app`
- Target SDK: 36
- Minimum SDK: 24

The installed Play Store version does not change until a new signed release is uploaded and approved. Web publishing does not update the installed Android app.

## Prerequisites

- Android Studio and the JDK required by the project's Android Gradle plugin
- Android SDK with `ANDROID_HOME` configured
- Existing release signing files and access to Google Play Console

## Preserve the existing signing identity

Use the existing `keystore/release.jks` (PKCS12, alias `meinspect`). Do not regenerate, overwrite, or delete any keystore, certificate, or private-key file. Back them up securely; losing the signing identity can prevent future app updates.

Signing passwords have **no defaults**. Supply `KEYSTORE_PASSWORD` and `KEY_PASSWORD` through a secure environment or CI secret store. Never put their values in this guide, source files, shell history, or build logs. Optional `KEYSTORE_PATH` and `KEY_ALIAS` select a different existing signing file or alias; the normal defaults are the existing release file and `meinspect`.

Confirm the required environment values exist without displaying them:

```bash
: "${KEYSTORE_PASSWORD:?KEYSTORE_PASSWORD must be supplied securely}"
: "${KEY_PASSWORD:?KEY_PASSWORD must be supplied securely}"
```

## Refresh the Android web bundle

From the project root:

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm run build
pnpm exec cap sync android
```

Before releasing, inspect the copied JavaScript under `android/app/src/main/assets/public/assets/`: the production backend base address must occur once and `staging--` must occur zero times. Do not distribute a bundle pointing to a test environment.

## Build artifacts

Open the `android` directory in Android Studio and wait for Gradle sync, or use:

```bash
cd android
./gradlew assembleDebug
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

For a Play Store release with the secure signing environment already supplied:

```bash
cd android
./gradlew bundleRelease
```

Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`.

For a signed APK for device testing, use `./gradlew assembleRelease`; the artifact is `android/app/build/outputs/apk/release/app-release.apk`.

Never treat a web build or Capacitor sync as proof that an APK/AAB compiles, signs, installs, or passes Play Store review.

## Version management

The current settings in `android/app/build.gradle` are:

```groovy
defaultConfig {
    versionCode 10
    versionName "3.5"
}
```

Increase the integer version code for every subsequent Play Store upload.

## Permissions and backup checks

The manifest includes Internet, camera, fine/coarse location, network state, and legacy write-storage permission limited to Android 9 and below. Camera capture does not require photo-library read permission. `READ_MEDIA_IMAGES` and `POST_NOTIFICATIONS` are intentionally absent.

Neither `backup_rules.xml` nor `data_extraction_rules.xml` may contain `domain="cache"`. Keep the auth-preference and database exclusions in place.

## Play Store checklist

- Prepare 2–8 phone screenshots, a 1024 × 500 feature graphic, and a 512 × 512 app icon.
- Supply a publicly accessible privacy policy and accurate short/full app descriptions.
- Confirm the Business/Productivity category, contact email, and website.
- Complete content rating, data safety, target audience, and ads declarations.
- Test sign-in, camera capture, report access, payment return, offline recovery, and sharing on real Android devices.
- Upload the signed AAB to the appropriate testing track before production release.

## Project layout

- `android/app/src/main/assets/public/`: copied web bundle
- `android/app/src/main/java/`: Android application code
- `android/app/src/main/res/`: native resources and backup rules
- `android/app/build.gradle`: version and signing configuration
- `keystore/`: existing release signing material; preserve unchanged

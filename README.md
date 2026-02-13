# react-native-nitro-ota

**_Still in Alpha and will have issues_**

⚡️ **High-performance Over-The-Air (OTA) updates for React Native** - Powered by Nitro Modules

Download, unzip, and apply JavaScript bundle updates at runtime without going through the App Store or Play Store review process.

## ✨ Features

- 🚀 **Native Performance** - Built with Nitro Modules for maximum speed
- 🧵 **Off JS Thread** - All operations run on different threads, keeping your JS thread free
- 🌐 **Server Agnostic** - Works with any CDN, S3, GitHub Releases, or custom server
- 📦 **Automatic Bundle Management** - Handles download, extraction, and cleanup
- 🔒 **Version Control** - Built-in version checking and management
- 🛡️ **Crash Safety** - Auto-rollback if a new bundle crashes the app on first launch
- ↩️ **Rollback** - Manual rollback to the previous bundle with one call
- 🚫 **Blacklisting** - Bad versions are never re-downloaded
- 📊 **Download Progress** - Track download progress with a callback

## 📦 Installation

```sh
npm install react-native-nitro-ota react-native-nitro-modules
# or
yarn add react-native-nitro-ota react-native-nitro-modules
```

> **Note:** `react-native-nitro-modules` is required as this library relies on [Nitro Modules](https://nitro.margelo.com/).

## 📱 Platform-Specific Setup (Required!)

### Android: Native Bundle Loading

In your `MainApplication.kt`, add the bundle path loader:

```kotlin
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.margelo.nitro.nitroota.core.getStoredBundlePath

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {

        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        // 🔥 Load OTA bundle if available, otherwise use default
        override fun getJSBundleFile(): String? {
          return getStoredBundlePath(this@MainApplication)
        }
      }
}
```

**If using modern React host:**

```kotlin
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.margelo.nitro.nitroota.core.getStoredBundlePath

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages,
      jsBundleFilePath = getStoredBundlePath(applicationContext)
    )
  }
}
```

### iOS: NitroOtaBundleManager

Install pods:

```bash
cd ios && pod install
```

Update `AppDelegate.swift`:

```swift
import UIKit
import React
import NitroOtaBundleManager

class AppDelegate: UIResponder, UIApplicationDelegate {

    override func bundleURL() -> URL? {
        #if DEBUG
        return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        #else
        // Use OTA bundle if available, otherwise fall back to the bundled file
        return NitroOtaBundleManager.shared.getStoredBundleURL()
            ?? Bundle.main.url(forResource: "main", withExtension: "jsbundle")
        #endif
    }
}
```

## 🚀 Quick Start

### Option 1: GitHub OTA (Easiest! 🔥)

Use the `githubOTA` helper to point directly to a GitHub repository:

```typescript
import { githubOTA, OTAUpdateManager } from 'react-native-nitro-ota';

// Configure GitHub URLs
const { downloadUrl, versionUrl } = githubOTA({
  githubUrl: 'https://github.com/your-username/your-ota-repo',
  otaVersionPath: 'ota.version', // or 'ota.version.json' for advanced features
  ref: 'main', // optional, defaults to 'main'
});

// Create update manager
const otaManager = new OTAUpdateManager(downloadUrl, versionUrl);

// Check for updates
const hasUpdate = await otaManager.checkForUpdates();
if (hasUpdate) {
  await otaManager.downloadUpdate();
  otaManager.reloadApp();
}

// Or use advanced JS checking (supports JSON format)
const updateInfo = await otaManager.checkForUpdatesJS();
if (updateInfo?.hasUpdate && updateInfo.isCompatible) {
  console.log('Compatible update available:', updateInfo.remoteVersion);
  await otaManager.downloadUpdate();
  otaManager.reloadApp();
}
```

### Option 2: Custom Server/CDN

```typescript
import {
  checkForOTAUpdates,
  downloadZipFromUrl,
  reloadApp,
} from 'react-native-nitro-ota';

const hasUpdate = await checkForOTAUpdates('https://your-cdn.com/ota.version');

if (hasUpdate) {
  await downloadZipFromUrl('https://your-cdn.com/bundle.zip');
  reloadApp();
}
```

## 📊 Download Progress

Track download progress with an optional callback:

```typescript
import { downloadZipFromUrl } from 'react-native-nitro-ota';

await downloadZipFromUrl(
  'https://your-cdn.com/bundle.zip',
  (received, total) => {
    if (total > 0) {
      const percent = Math.round((received / total) * 100);
      console.log(`Downloading... ${percent}%`);
    }
  }
);
```

Via `OTAUpdateManager`:

```typescript
await otaManager.downloadUpdate((received, total) => {
  setProgress(total > 0 ? received / total : -1);
});
```

> **Note:** `total` is `-1` when the server does not send a `Content-Length` header.

## 🛡️ Crash Safety & Rollback

### How it works

The library uses a **"pending confirmation" pattern** to protect against bad bundles:

1. A new bundle is downloaded → `ota_pending_validation = true` is stored
2. On the next app launch, the crash handler activates **only** if `pending_validation == true`
3. You call `confirmBundle()` after verifying your app works → guard is disabled
4. If the app crashes while unconfirmed → the crash handler automatically rolls back to the previous bundle, blacklists the bad version, and the next launch uses the restored bundle

> **Important:** Crashes in confirmed bundles are **completely unaffected** — the crash handler passes through to your existing crash reporter (Crashlytics, Sentry, etc.).

### 1. Confirm a bundle after download

```typescript
import {
  downloadZipFromUrl,
  confirmBundle,
  reloadApp,
} from 'react-native-nitro-ota';

// After download, the bundle is "pending validation"
await downloadZipFromUrl(url);
reloadApp();

// On the new bundle: call confirmBundle() after verifying the app works
// (e.g. after a successful API call, a key screen loading, etc.)
confirmBundle();
```

### 2. Manual rollback

```typescript
import { rollbackToPreviousBundle, reloadApp } from 'react-native-nitro-ota';

const success = await rollbackToPreviousBundle();
if (success) {
  reloadApp(); // restarts on the previous (or original) bundle
}
```

### 3. Mark a bundle as bad manually

```typescript
import { markCurrentBundleAsBad, reloadApp } from 'react-native-nitro-ota';

// Blacklists the current version and rolls back
await markCurrentBundleAsBad('payment_screen_broken');
reloadApp();
```

### 4. Listen for rollback events

Subscribe to rollback events in your app root. The callback fires:
- **Immediately** if a crash rollback happened during the previous session (detected from persisted history)
- **In the current session** when `rollbackToPreviousBundle()` or `markCurrentBundleAsBad()` succeeds

```typescript
import { onRollback } from 'react-native-nitro-ota';

// Register early — e.g. at the top of your App component
const unsubscribe = onRollback((record) => {
  console.log('Rollback happened!');
  console.log('  From version:', record.fromVersion);
  console.log('  To version:  ', record.toVersion);
  console.log('  Reason:      ', record.reason);
  console.log('  Timestamp:   ', new Date(record.timestamp).toISOString());

  // Send to your analytics or show a user-facing notice
});

// Call unsubscribe() when the component unmounts
```

`reason` values:
| Value | Meaning |
|---|---|
| `"crash_detected"` | Crash handler auto-rolled back the bundle |
| `"manual"` | `rollbackToPreviousBundle()` was called |
| `"max_rollbacks_exceeded"` | Rollback counter > 3; reset to original bundle |
| custom string | Passed to `markCurrentBundleAsBad(reason)` |

### 5. Check rollback history

```typescript
import { getRollbackHistory } from 'react-native-nitro-ota';

const history = await getRollbackHistory();
// [
//   {
//     timestamp: 1712345678000,
//     fromVersion: "2",
//     toVersion: "1",
//     reason: "crash_detected"
//   },
//   ...
// ]
```

### 6. Check & clear the blacklist

```typescript
import { getBlacklistedVersions } from 'react-native-nitro-ota';

const blacklist = await getBlacklistedVersions();
console.log('Blacklisted versions:', blacklist); // ["2", "3"]
```

Blacklisted versions are automatically skipped by `checkForOTAUpdates()` — they will never be downloaded again.

### Rollback limits

| Consecutive rollbacks | Behaviour |
|---|---|
| 1–3 | Previous bundle is restored |
| > 3 | All OTA data cleared; app falls back to the original `.jsbundle` |

The counter resets to 0 whenever a new bundle is successfully downloaded.

### Using `OTAUpdateManager` (class API)

All rollback features are also available on the class:

```typescript
const otaManager = new OTAUpdateManager(downloadUrl, versionUrl);

// Listen for rollbacks
const unsub = otaManager.onRollback((record) => {
  console.log('Rollback:', record.reason);
});

// Confirm bundle is working
otaManager.confirm();

// Manual rollback
const ok = await otaManager.rollback();
if (ok) otaManager.reloadApp();

// Mark as bad with a custom reason
await otaManager.markAsBad('checkout_screen_crash');
otaManager.reloadApp();

// Inspect history and blacklist
const history = await otaManager.getHistory();
const blacklist = await otaManager.getBlacklist();
```

## 🔄 Background Updates (Experimental)

> ⚠️ **HIGHLY ALPHA FEATURE** - This feature is experimental and needs thorough testing. Use with caution in production.

Schedule automatic background checks for updates that run periodically:

```typescript
import { OTAUpdateManager } from 'react-native-nitro-ota';

const otaManager = new OTAUpdateManager(downloadUrl, versionCheckUrl);

// Schedule background check every hour (3600 seconds)
otaManager.scheduleBackgroundCheck(3600);
```

> **Note:** Android uses WorkManager (minimum 15-minute interval). iOS uses background tasks (behavior depends on iOS version and system conditions).

## 📝 Understanding Version Files

### Basic: `ota.version` (Simple Text)

The `ota.version` file is a simple text file that contains your current bundle version. **The version can be anything** - numbers, strings, or creative identifiers like "apple", "winter2024", "bugfix-v3".

```bash
echo "1.0.0" > ota.version
```

### Advanced: `ota.version.json` (With Metadata)

For more control, use the JSON format with semantic versioning and target app versions:

```json
{
  "version": "1.2.3",
  "isSemver": true,
  "targetVersions": {
    "android": ["2.30.1", "2.30.2"],
    "ios": ["2.30.1"]
  },
  "releaseNotes": "Bug fixes and improvements"
}
```

**JavaScript API for Advanced Checking:**

```typescript
import { checkForOTAUpdatesJS } from 'react-native-nitro-ota';

const result = await checkForOTAUpdatesJS('https://example.com/ota.version.json');
if (result?.hasUpdate && result.isCompatible) {
  console.log(`New version: ${result.remoteVersion}`);
  console.log(`Notes: ${result.metadata?.releaseNotes}`);
}
```

> **Note:** Both formats are supported. The library automatically detects which one you're using.

## 📦 Creating and Uploading Bundles

### 1. Generate the JavaScript Bundle

#### For Android

```bash
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/App-Bundles/index.android.bundle \
  --assets-dest android/App-Bundles
```

#### For iOS

```bash
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/App-Bundles/index.jsbundle \
  --assets-dest ios/App-Bundles
```

---

### 2. Package the Bundle

```bash
# For Android
cd android && zip -r App-Bundles.zip App-Bundles

# For iOS
cd ios && zip -r App-Bundles.zip App-Bundles
```

---

### 3. Distribute the Bundle

Upload the zipped bundle to your CDN, S3 bucket, GitHub Releases, or any file host.

---

### 🔑 Real-World Example

In the **Jellify App**:

- Bundles are uploaded to a dedicated Git branch named by version and platform (e.g., [`nitro_0.19.2_android`](https://github.com/Jellify-Music/App-Bundles/tree/nitro_0.19.2_android)).
- The upload and versioning are automated via [GitHub Actions workflow](https://github.com/Jellify-Music/App/blob/main/.github/workflows/publish-ota-update.yml).

## 📚 API Reference

### Functions

| Function | Description |
|---|---|
| `checkForOTAUpdates(url)` | Returns `true` if a new version is available |
| `downloadZipFromUrl(url, onProgress?)` | Downloads and unzips the bundle. Optional progress callback `(received, total) => void` |
| `getStoredOtaVersion()` | Returns the currently active OTA version string, or `null` |
| `getStoredUnzippedPath()` | Returns the path to the active bundle file, or `null` |
| `reloadApp()` | Restarts the app to apply a downloaded bundle |
| `confirmBundle()` | Marks the current bundle as verified — disables crash guard |
| `rollbackToPreviousBundle()` | Rolls back to previous bundle; returns `true` on success |
| `markCurrentBundleAsBad(reason)` | Blacklists current bundle and triggers rollback |
| `getBlacklistedVersions()` | Returns `string[]` of blacklisted OTA versions |
| `getRollbackHistory()` | Returns `RollbackHistoryRecord[]` |
| `onRollback(callback)` | Subscribes to rollback events; returns an unsubscribe function |
| `checkForOTAUpdatesJS(url?, appVersion?)` | JS-side version check with detailed result |
| `hasOTAUpdate(url?, appVersion?)` | Simplified compatible-update check |

### `OTAUpdateManager` class

| Method | Description |
|---|---|
| `checkForUpdates()` | Native version check |
| `checkForUpdatesJS(appVersion?)` | JS-side version check |
| `hasCompatibleUpdate(appVersion?)` | Simple compatible-update check |
| `downloadUpdate(onProgress?)` | Download with optional progress |
| `getVersion()` | Current OTA version |
| `getUnzippedPath()` | Path to active bundle |
| `reloadApp()` | Restart the app |
| `confirm()` | Confirm bundle is working |
| `rollback()` | Roll back to previous bundle |
| `markAsBad(reason?)` | Blacklist + rollback with custom reason |
| `getBlacklist()` | List of blacklisted versions |
| `getHistory()` | Full rollback history |
| `onRollback(callback)` | Subscribe to rollback events |
| `scheduleBackgroundCheck(interval)` | Schedule periodic native background check |

### `RollbackHistoryRecord`

```typescript
interface RollbackHistoryRecord {
  timestamp: number;       // Unix ms
  fromVersion: string;     // OTA version that was active
  toVersion: string;       // Version restored ("original" = no OTA)
  reason:
    | 'crash_detected'
    | 'manual'
    | 'max_rollbacks_exceeded'
    | string;              // custom reason from markCurrentBundleAsBad()
}
```

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and guidelines.

## 📄 License

MIT

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


2. Install pods:

```bash
cd ios && pod install
```

3. Update `AppDelegate.swift`:

```swift
import UIKit
import React
import NitroOtaBundleManager

class AppDelegate: UIResponder, UIApplicationDelegate {

    override func bundleURL() -> URL? {
        #if DEBUG
        return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        #else
        // Check for OTA bundle
        if let bundlePath = NitroOtaBundleManager.shared.getStoredBundlePath() {
            let bundleURL = URL(fileURLWithPath: bundlePath)

            return bundleURL
        }

        // Fallback to default bundle
        return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
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

// Get current version
const currentVersion = otaManager.getVersion();
console.log('Current OTA version:', currentVersion);
```

### Option 2: Custom Server/CDN

### 1. Download and Apply OTA Update

```typescript
import { NitroOta } from 'react-native-nitro-ota';

// Download and unzip bundle from any server
const updatePath = await NitroOta.downloadAndUnzipFromUrl(
  'https://your-cdn.com/bundles/latest.zip',
  'https://your-cdn.com/bundles/version.txt' // optional version file
);

console.log('Update downloaded to:', updatePath);

// Restart app to apply update
// Use your preferred restart method or RN's DevSettings
```

### 2. Check for Updates

```typescript
// Check if a new version is available
const hasUpdate = await NitroOta.checkForUpdates(
  'https://your-cdn.com/bundles/version.txt'
);

if (hasUpdate) {
  console.log('New version available!');
  // Download and apply update
}
```

### 3. Get Current Version

```typescript
const currentVersion = NitroOta.getStoredOtaVersion();
console.log('Current OTA version:', currentVersion);
```

### 3. Get Current Version

```typescript
NitroOta.reloadApp();
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

## 📝 Understanding Version Files

### Basic: `ota.version` (Simple Text)

The `ota.version` file is a simple text file that contains your current bundle version. **The version can be anything** - numbers, strings, or even creative identifiers like "apple", "orange", "winter2024", or "bugfix-v3".

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

// Get detailed update info
const result = await checkForOTAUpdatesJS(
  'https://example.com/ota.version.json'
);
if (result?.hasUpdate && result.isCompatible) {
  console.log(`New version: ${result.remoteVersion}`);
  console.log(`Notes: ${result.metadata?.releaseNotes}`);
}
```

> **Note:** Both formats are supported. The library automatically detects which one you're using.

## 📦 Creating and Uploading Bundles

Follow these steps to generate and distribute your OTA bundle:

### 1. Generate the JavaScript Bundle

Run the following commands to create a production-ready bundle and assets for your platform:

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

> **Result:**  
> Your bundles and assets will be generated in `android/App-Bundles/` or `ios/App-Bundles/` respectively.

---

### 2. Package the Bundle

After generating the bundle, compress the entire output folder (including the assets) into a single zip file:

```bash
# For Android
cd android && zip -r App-Bundles.zip App-Bundles

# For iOS
cd ios && zip -r App-Bundles.zip App-Bundles
```

---

### 3. Distribute the Bundle

Upload the zipped bundle file to your backend, CDN, or preferred file hosting service so that your app can download it for OTA updates.

---

### 🔑 Real-World Example

In the **Jellify App**:

- Bundles are uploaded to a dedicated Git branch named by version and platform (e.g., [`nitro_0.19.2_android`](https://github.com/Jellify-Music/App-Bundles/tree/nitro_0.19.2_android)).
- The upload and versioning are automated via [GitHub Actions workflow](https://github.com/Jellify-Music/App/blob/main/.github/workflows/publish-ota-update.yml).

This keeps OTA releases well organized and accessible for deployment.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and guidelines.

## 📄 License

MIT

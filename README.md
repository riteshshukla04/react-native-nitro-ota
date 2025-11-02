# react-native-nitro-ota


***Still in Alpha and will have issues***



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

** If using modern React host :**
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

1. Add to your `Podfile`:
```ruby
pod 'NitroOtaBundleManager', :path => '../node_modules/react-native-nitro-ota'
```

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
  otaVersionPath: 'ota.version',  // optional, defaults to 'ota.version'
  ref: 'main'  // optional, defaults to 'main'
});

// Create update manager
const otaManager = new OTAUpdateManager(downloadUrl, versionUrl);

// Check for updates
const hasUpdate = await otaManager.checkForUpdates();
if (hasUpdate) {
  // Download update
  await otaManager.downloadUpdate();
  otaManager.reloadApp()
  console.log('Update downloaded! Restart app to apply.');
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

## 📝 Understanding the `ota.version` File

The `ota.version` file is a simple text file that contains your current bundle version. **The version can be anything** - numbers, strings, or even creative identifiers like "apple", "orange", "winter2024", or "bugfix-v3".


**Important:** There's no "greater than" or "less than" logic. The library simply checks if `currentVersion !== newVersion`. This means you can use any naming scheme that makes sense for your workflow - just ensure each new update has a **different** version string than the previous one.

**Creating the version file:**
```bash
echo "1.0.0" > ota.version
# or
echo "apple" > ota.version
# or
echo "$(date +%Y%m%d)" > ota.version  # Use current date as version
```

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and guidelines.

## 📄 License

MIT

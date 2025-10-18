# NitroOtaBundleManager Usage Guide

A standalone bundle manager for React Native OTA updates without C++ interoperability requirements.

## Installation

Add to your `Podfile`:

```ruby
pod 'NitroOtaBundleManager', :path => '../node_modules/react-native-nitro-ota'
```

Then run:
```bash
cd ios && pod install
```

## Usage in AppDelegate.swift

```swift
import UIKit
import React
import NitroOtaBundleManager

class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    
    func application(_ application: UIApplication, 
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Get OTA bundle path using the singleton
        let bundleURL: URL
        if let otaBundlePath = NitroOtaBundleManager.shared.getStoredBundlePath() {
            bundleURL = URL(fileURLWithPath: otaBundlePath)
            print("Loading OTA bundle: \(otaBundlePath)")
            print("OTA Version: \(NitroOtaBundleManager.shared.getStoredOtaVersion() ?? "unknown")")
        } else {
            #if DEBUG
            bundleURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
            #else
            bundleURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle")!
            #endif
        }
        
        // Continue with your app initialization...
        return true
    }
}
```

## API Reference

**IMPORTANT:** Always use `NitroOtaBundleManager.shared` - do not try to instantiate the class directly.

### Available Methods

```swift
// Get the stored bundle path
NitroOtaBundleManager.shared.getStoredBundlePath() -> String?

// Get the stored OTA version
NitroOtaBundleManager.shared.getStoredOtaVersion() -> String?

// Get the stored bundle name
NitroOtaBundleManager.shared.getStoredBundleName() -> String?

// Check if OTA data exists
NitroOtaBundleManager.shared.hasOtaData() -> Bool

// Clear all stored OTA data
NitroOtaBundleManager.shared.clearStoredData()
```

## Common Error: Initializer is Private

❌ **Wrong:**
```swift
let manager = NitroOtaBundleManager()  // Error: initializer is private!
```

✅ **Correct:**
```swift
let path = NitroOtaBundleManager.shared.getStoredBundlePath()
```

The initializer is intentionally private to enforce the singleton pattern. Always use `.shared`.

## Objective-C Usage

```objc
#import <NitroOtaBundleManager/NitroOtaBundleManager-Swift.h>

// Get bundle path
NSString *bundlePath = [[NitroOtaBundleManager shared] getStoredBundlePath];
if (bundlePath) {
    NSURL *bundleURL = [NSURL fileURLWithPath:bundlePath];
    NSLog(@"OTA bundle: %@", bundleURL);
}

// Get OTA version
NSString *version = [[NitroOtaBundleManager shared] getStoredOtaVersion];
```

## Features

- ✅ **No C++ Interop**: Pure Swift/Objective-C, no C++ interoperability needed
- ✅ **Standalone**: No dependencies on NitroOta or NitroModules
- ✅ **Thread-Safe**: Singleton pattern ensures thread safety
- ✅ **Objective-C Compatible**: Can be used from both Swift and Objective-C
- ✅ **Lightweight**: Single file, ~130 lines of code

## Troubleshooting

### "Cannot find 'NitroOtaBundleManager' in scope"

Make sure you've:
1. Added the pod to your Podfile
2. Run `pod install`
3. Added `import NitroOtaBundleManager` at the top of your Swift file

### "Initializer is inaccessible due to 'private' protection level"

You're trying to instantiate the class directly. Use `NitroOtaBundleManager.shared` instead.

### Module not found after pod install

1. Clean build folder: Product → Clean Build Folder (Cmd+Shift+K)
2. Close Xcode
3. Run `pod install` again
4. Open the `.xcworkspace` file (not `.xcodeproj`)


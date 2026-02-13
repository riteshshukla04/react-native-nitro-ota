import Foundation

/**
 * NitroOtaBundleManager - A standalone bundle manager without C++ interop dependencies
 * This module can be imported and used independently without NitroModules
 *
 * Usage in AppDelegate:
 *   import NitroOtaBundleManager
 *
 *   override func bundleURL() -> URL? {
 *     #if DEBUG
 *       return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
 *     #else
 *       // Check for OTA bundle first
 *       if let bundleURL = NitroOtaBundleManager.shared.getStoredBundleURL() {
 *         return bundleURL
 *       }
 *       // Fallback to main bundle
 *       return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
 *     #endif
 *   }
 *
 * Note: Use the .shared singleton - do not instantiate directly
 */
public class NitroOtaBundleManager: NSObject {

    // MARK: - Singleton
    /// Shared singleton instance - use this to access all methods
    @objc public static let shared = NitroOtaBundleManager()

    /// Private initializer to enforce singleton pattern
    private override init() {
        super.init()
    }

    // MARK: - Public API

    /**
     * Returns the stored bundle URL from user defaults.
     * This is the recommended method for loading OTA bundles in your AppDelegate.
     * Simply return this in your bundleURL() method.
     *
     * Returns nil if no OTA bundle is stored OR if all rollbacks were exhausted
     * (which resets the stored path to empty string, falling back to original bundle).
     *
     * @return The bundle URL if available, nil otherwise
     */
    @objc public func getStoredBundleURL() -> URL? {
        guard let path = NitroOtaPreferences.shared.getOtaUnzippedPath(), !path.isEmpty else {
            return nil  // nil = use original .jsbundle (no OTA or reset after too many rollbacks)
        }
        return URL(fileURLWithPath: path)
    }

    /**
     * Returns the stored bundle path from user defaults.
     * This method retrieves the full path to the OTA bundle file directly from user defaults.
     *
     * @return The bundle path if available, nil otherwise
     */
    @objc public func getStoredBundlePath() -> String? {
        guard let path = NitroOtaPreferences.shared.getOtaUnzippedPath(), !path.isEmpty else {
            return nil
        }
        return path
    }

    /**
     * Returns the stored OTA version from user defaults.
     *
     * @return The OTA version if available, nil otherwise
     */
    @objc public func getStoredOtaVersion() -> String? {
        return NitroOtaPreferences.shared.getOtaVersion()
    }

    /**
     * Returns the stored bundle name from user defaults.
     *
     * @return The bundle name if available, nil otherwise
     */
    @objc public func getStoredBundleName() -> String? {
        return NitroOtaPreferences.shared.getOtaBundleName()
    }

    /**
     * Clears all stored OTA data from user defaults.
     */
    @objc public func clearStoredData() {
        NitroOtaPreferences.shared.clearOtaData()
    }

    /**
     * Checks if OTA data exists in user defaults.
     *
     * @return true if OTA data exists, false otherwise
     */
    @objc public func hasOtaData() -> Bool {
        return NitroOtaPreferences.shared.hasOtaData()
    }
}

// MARK: - Internal Preferences Manager

/**
 * Internal preferences utility for NitroOtaBundleManager
 * This is kept internal to avoid conflicts with the main PreferencesUtils
 */
@objc(NitroOtaPreferences)
internal class NitroOtaPreferences: NSObject {

    static let shared = NitroOtaPreferences()

    private let userDefaults: UserDefaults

    private let suiteName = "NitroOtaPrefs"

    private let appVersion: String = {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        return version.replacingOccurrences(of: ".", with: "_")
    }()

    // Define keys with version suffix
    private var otaUnzippedPathKey: String { "ota_unzipped_path_\(appVersion)" }
    private var otaVersionKey: String { "ota_version_\(appVersion)" }
    private var otaUpdateDownloadUrlKey: String { "ota_update_download_url_\(appVersion)" }
    private var otaUpdateVersionCheckUrlKey: String { "ota_update_version_check_url_\(appVersion)" }
    private var otaBundleNameKey: String { "ota_bundle_name_\(appVersion)" }

    private override init() {
        userDefaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
        super.init()
    }

    // MARK: - Getters

    func getOtaUnzippedPath() -> String? {
        return userDefaults.string(forKey: otaUnzippedPathKey)
    }

    func getOtaVersion() -> String? {
        return userDefaults.string(forKey: otaVersionKey)
    }

    func getUpdateDownloadUrl() -> String? {
        return userDefaults.string(forKey: otaUpdateDownloadUrlKey)
    }

    func getUpdateVersionCheckUrl() -> String? {
        return userDefaults.string(forKey: otaUpdateVersionCheckUrlKey)
    }

    func getOtaBundleName() -> String? {
        return userDefaults.string(forKey: otaBundleNameKey)
    }

    // MARK: - Bulk operations

    func clearOtaData() {
        userDefaults.removeObject(forKey: otaUnzippedPathKey)
        userDefaults.removeObject(forKey: otaVersionKey)
        userDefaults.removeObject(forKey: otaUpdateDownloadUrlKey)
        userDefaults.removeObject(forKey: otaUpdateVersionCheckUrlKey)
        userDefaults.removeObject(forKey: otaBundleNameKey)
        userDefaults.synchronize()
    }

    func hasOtaData() -> Bool {
        return getUpdateDownloadUrl() != nil
    }
}

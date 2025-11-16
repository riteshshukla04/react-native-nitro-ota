//
//  PreferenceUtils.swift
//  Pods
//
//  Created by Ritesh Shukla on 12/11/25.
//

class PreferencesUtils {
    private let userDefaults: UserDefaults


    private let appVersion: String = {
    let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    return version.replacingOccurrences(of: ".", with: "_")
    }()

    private let suiteName = "NitroOtaPrefs"

    // Define keys with version suffix
    private var otaUnzippedPathKey: String { "ota_unzipped_path_\(appVersion)" }
    private var otaVersionKey: String { "ota_version_\(appVersion)" }
    private var otaUpdateDownloadUrlKey: String { "ota_update_download_url_\(appVersion)" }
    private var otaUpdateVersionCheckUrlKey: String { "ota_update_version_check_url_\(appVersion)" }
    private var otaBundleNameKey: String { "ota_bundle_name_\(appVersion)" }

    init() {
        userDefaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
    }

    // MARK: - Setters
    func setOtaUnzippedPath(_ path: String) {
        userDefaults.set(path, forKey: otaUnzippedPathKey)
        userDefaults.synchronize()
    }

    func setOtaVersion(_ version: String) {
        userDefaults.set(version, forKey: otaVersionKey)
        userDefaults.synchronize()
    }

    func setUpdateDownloadUrl(_ url: String) {
        userDefaults.set(url, forKey: otaUpdateDownloadUrlKey)
        userDefaults.synchronize()
    }

    func setUpdateVersionCheckUrl(_ url: String) {
        userDefaults.set(url, forKey: otaUpdateVersionCheckUrlKey)
        userDefaults.synchronize()
    }

    func setOtaBundleName(_ bundleName: String) {
        userDefaults.set(bundleName, forKey: otaBundleNameKey)
        userDefaults.synchronize()
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
    func setOtaData(unzippedPath: String, version: String, downloadUrl: String, versionCheckUrl: String?, bundleName: String?) {
        let updates: [String: Any?] = [
            otaUnzippedPathKey: unzippedPath,
            otaVersionKey: version,
            otaUpdateDownloadUrlKey: downloadUrl,
            otaUpdateVersionCheckUrlKey: versionCheckUrl,
            otaBundleNameKey: bundleName
        ]

        for (key, value) in updates where value != nil {
            userDefaults.set(value, forKey: key)
        }
        userDefaults.synchronize()
    }

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

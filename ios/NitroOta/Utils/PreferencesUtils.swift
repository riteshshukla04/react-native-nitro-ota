import Foundation

class PreferencesUtils {
    private let userDefaults: UserDefaults
    private let suiteName = "NitroOtaPrefs"

    private let otaUnzippedPathKey = "ota_unzipped_path"
    private let otaVersionKey = "ota_version"
    private let otaUpdateDownloadUrlKey = "ota_update_download_url"
    private let otaUpdateVersionCheckUrlKey = "ota_update_version_check_url"
    private let otaBundleNameKey = "ota_bundle_name"

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

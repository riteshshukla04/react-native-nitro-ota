//
//  NitroOta.swift
//  NitroOta
//
//  Created by Ritesh Shukla on 19/10/25.
//

import Foundation
import NitroModules
import SSZipArchive


// MARK: - ZipUtils

class ZipUtils {
    static func unzip(zipFile: URL, to destination: URL) throws {
        let fileManager = FileManager.default
        
        // Ensure destination directory exists
        try fileManager.createDirectory(at: destination, withIntermediateDirectories: true, attributes: nil)
        
        // Use SSZipArchive to extract the zip file
        var error: NSError?
        let success = SSZipArchive.unzipFile(
            atPath: zipFile.path,
            toDestination: destination.path,
            preserveAttributes: true, overwrite: true,
            password: nil,
            error: &error,
            delegate: nil
        )
        
        if !success {
            if let error = error {
                throw error
            } else {
                throw NSError(
                    domain: "ZipUtils",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to unzip file at path: \(zipFile.path)"]
                )
            }
        }
        
        print("ZipUtils: Successfully unzipped file from \(zipFile.path) to \(destination.path)")
    }
}

// MARK: - UrlUtils

class UrlUtils {
    // GitHub-specific URL utilities (kept for backward compatibility)
    static func convertGitUrlToDownloadUrl(gitUrl: String, branch: String = "master") -> String {
        let cleanUrl = gitUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")).replacingOccurrences(of: ".git", with: "")
        let parts = cleanUrl.components(separatedBy: "/")

        guard parts.count >= 5, parts[2] == "github.com" else {
            fatalError("Invalid GitHub URL format. Expected: https://github.com/owner/repo")
        }

        let owner = parts[3]
        let repo = parts[4]

        return "https://github.com/\(owner)/\(repo)/archive/refs/heads/\(branch).zip"
    }

    static func convertGitUrlToRawContentUrl(gitUrl: String, branch: String = "master", filePath: String) -> String {
        let cleanUrl = gitUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")).replacingOccurrences(of: ".git", with: "")
        let parts = cleanUrl.components(separatedBy: "/")

        guard parts.count >= 5, parts[2] == "github.com" else {
            fatalError("Invalid GitHub URL format. Expected: https://github.com/owner/repo")
        }

        let owner = parts[3]
        let repo = parts[4]

        return "https://raw.githubusercontent.com/\(owner)/\(repo)/\(branch)/\(filePath)"
    }

    static func isGitHubUrl(_ url: String) -> Bool {
        let githubPattern = "^https://github\\.com/[^/]+/[^/]+(?:\\.git)?/?$"
        let regex = try? NSRegularExpression(pattern: githubPattern, options: [])
        let range = NSRange(location: 0, length: url.count)
        return regex?.firstMatch(in: url, options: [], range: range) != nil
    }
}

// MARK: - DownloadManager

class DownloadManager {
    func downloadFile(from url: URL, to destination: URL) throws {
        let data = try Data(contentsOf: url)
        try data.write(to: destination)
    }

    func downloadText(from url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        guard let text = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to decode text data"])
        }
        return text
    }

    func downloadText(from urlString: String) throws -> String {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        return try downloadText(from: url)
    }
}

// MARK: - PreferencesUtils

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

// MARK: - OtaManager

class OtaManager {
    private let downloadManager = DownloadManager()
    private let preferences = PreferencesUtils()
    private let androidBundleName = "main.jsbundle"

    // MARK: - Private helper methods

    private func cleanupOldOtaDirectories() {
        do {
            let filesDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let otaDirectories = try FileManager.default.contentsOfDirectory(at: filesDir, includingPropertiesForKeys: [.isDirectoryKey], options: [])

            let filteredDirs = otaDirectories.filter { url in
                do {
                    let resourceValues = try url.resourceValues(forKeys: [.isDirectoryKey])
                    return resourceValues.isDirectory ?? false && url.lastPathComponent.hasPrefix("ota_unzipped_")
                } catch {
                    return false
                }
            }

            if filteredDirs.count <= 2 {
                print("OtaManager: Found \(filteredDirs.count) OTA directories, no cleanup needed")
                return
            }

            // Sort by timestamp (newest first) - extract timestamp from folder name
            let sortedDirs = filteredDirs.sorted { (url1, url2) -> Bool in
                let timestampStr1 = url1.lastPathComponent.replacingOccurrences(of: "ota_unzipped_", with: "")
                let timestampStr2 = url2.lastPathComponent.replacingOccurrences(of: "ota_unzipped_", with: "")

                let timestamp1 = Int(timestampStr1) ?? 0
                let timestamp2 = Int(timestampStr2) ?? 0

                return timestamp1 > timestamp2
            }

            // Keep only the first 2 (most recent), delete the rest
            let dirsToDelete = Array(sortedDirs.dropFirst(2))
            print("OtaManager: Found \(filteredDirs.count) OTA directories, keeping 2 most recent, deleting \(dirsToDelete.count) old ones")

            for dir in dirsToDelete {
                do {
                    try FileManager.default.removeItem(at: dir)
                    print("OtaManager: Successfully deleted old OTA directory: \(dir.path)")
                } catch {
                    print("OtaManager: Error deleting old OTA directory \(dir.path): \(error.localizedDescription)")
                }
            }
        } catch {
            print("OtaManager: Error during OTA directory cleanup: \(error.localizedDescription)")
        }
    }

    private func findAndRenameContentFolder(unzipDir: URL) -> URL? {
        do {
            // First, check if bundle file exists directly in unzipDir
            let bundleFile = unzipDir.appendingPathComponent(androidBundleName)
            if FileManager.default.fileExists(atPath: bundleFile.path) {
                print("OtaManager: Found \(androidBundleName) directly in unzip directory, no renaming needed")
                return unzipDir
            }

            let contents = try FileManager.default.contentsOfDirectory(at: unzipDir, includingPropertiesForKeys: [.isDirectoryKey], options: [])

            for item in contents {
                do {
                    let resourceValues = try item.resourceValues(forKeys: [.isDirectoryKey])
                    if resourceValues.isDirectory ?? false {
                        // Check if bundle file exists in this directory
                        let bundleFileInDir = item.appendingPathComponent(androidBundleName)
                        if FileManager.default.fileExists(atPath: bundleFileInDir.path) {
                            print("OtaManager: Found \(androidBundleName) in directory '\(item.lastPathComponent)', no renaming needed")
                            return item
                        }

                        // Found a directory, rename it to "bundles"
                        let bundlesDir = unzipDir.appendingPathComponent("bundles")
                        try FileManager.default.moveItem(at: item, to: bundlesDir)
                        print("OtaManager: Renamed content folder from '\(item.lastPathComponent)' to 'bundles'")
                        return bundlesDir
                    }
                } catch {
                    print("OtaManager: Error checking item \(item.path): \(error.localizedDescription)")
                }
            }
        } catch {
            print("OtaManager: Error reading unzip directory contents: \(error.localizedDescription)")
        }

        return nil
    }

    private func readVersionFromLocalFile(_ contentFolder: URL) {
        let otaVersionFile = contentFolder.appendingPathComponent("ota.version")
        do {
            let otaVersion = try String(contentsOf: otaVersionFile, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
            print("OtaManager: Found ota.version file with content: \(otaVersion)")
            preferences.setOtaVersion(otaVersion)
            print("OtaManager: Stored OTA version in UserDefaults: \(otaVersion)")
        } catch {
            print("OtaManager: ota.version file not found in content folder: \(contentFolder.path)")
        }
    }

    private func downloadVersionFromUrl(_ versionUrl: String) throws -> String {
        print("OtaManager: Downloading version from URL: \(versionUrl)")
        let versionContent = try downloadManager.downloadText(from: versionUrl).trimmingCharacters(in: .whitespacesAndNewlines)
        print("OtaManager: Downloaded version: \(versionContent)")
        return versionContent
    }

    // MARK: - Public methods

    func downloadAndUnzipFromUrl(_ downloadUrl: String, versionCheckUrl: String?) throws -> String {
        // Store the URLs for future update checks
        preferences.setUpdateDownloadUrl(downloadUrl)
        if let versionCheckUrl = versionCheckUrl {
            preferences.setUpdateVersionCheckUrl(versionCheckUrl)
        }
        print("OtaManager: Stored download URL: \(downloadUrl) and version check URL: \(versionCheckUrl ?? "nil")")

        // Create a temporary file for the zip
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let zipFile = documentsDir.appendingPathComponent("ota_update_\(UUID().uuidString).zip")
        print("OtaManager: Created temp zip file: \(zipFile.path)")

        do {
            // Download the zip file
            guard let downloadURL = URL(string: downloadUrl) else {
                throw NSError(domain: "OtaManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid download URL"])
            }
            print("OtaManager: Downloading zip file...")
            try downloadManager.downloadFile(from: downloadURL, to: zipFile)
            print("OtaManager: Download completed, zip file size: \(try? FileManager.default.attributesOfItem(atPath: zipFile.path)[.size] as? NSNumber ?? 0) bytes")

            // Create directory for unzipped files
            let unzipDir = documentsDir.appendingPathComponent("ota_unzipped_\(Int(Date().timeIntervalSince1970 * 1000))")
            try FileManager.default.createDirectory(at: unzipDir, withIntermediateDirectories: true, attributes: nil)
            print("OtaManager: Created unzip directory: \(unzipDir.path)")

            // Unzip the file
            print("OtaManager: Starting unzip process...")
            try ZipUtils.unzip(zipFile: zipFile, to: unzipDir)
            let contents = try? FileManager.default.contentsOfDirectory(atPath: unzipDir.path)
            print("OtaManager: Unzip completed, directory contents: \(contents?.joined(separator: ", ") ?? "No items")")

            // Find the actual content folder and rename it to "bundles"
            let contentFolder = findAndRenameContentFolder(unzipDir: unzipDir)
            if let contentFolder = contentFolder {
                print("OtaManager: Using content folder: \(contentFolder.path)")

                // Read version from provided URL or fallback to ota.version file
                if let versionCheckUrl = versionCheckUrl {
                    do {
                        let otaVersion = try downloadVersionFromUrl(versionCheckUrl)
                        print("OtaManager: Downloaded version from URL: \(otaVersion)")
                        preferences.setOtaVersion(otaVersion)
                        print("OtaManager: Stored OTA version in UserDefaults: \(otaVersion)")
                    } catch {
                        print("OtaManager: Failed to download version from URL: \(versionCheckUrl), error: \(error.localizedDescription)")
                        // Fallback to local file
                        readVersionFromLocalFile(contentFolder)
                    }
                } else {
                    // No version check URL provided, try to read from local file
                    readVersionFromLocalFile(contentFolder)
                }

                // Store the content folder path in user defaults
                preferences.setOtaUnzippedPath(contentFolder.appendingPathComponent(androidBundleName).path)
                print("OtaManager: Stored content folder path in UserDefaults: \(contentFolder.path)")

                // Store the Android bundle name in user defaults
                preferences.setOtaBundleName(androidBundleName)
                print("OtaManager: Stored Android bundle name in UserDefaults: \(androidBundleName)")

                // Clean up old OTA directories, keeping only the 2 most recent
                cleanupOldOtaDirectories()

                return contentFolder.path
            } else {
                print("OtaManager: No content folder found in unzip directory")
                // Fallback to unzip directory
                preferences.setOtaUnzippedPath(unzipDir.path)
                print("OtaManager: Stored fallback unzip path in UserDefaults: \(unzipDir.path)")

                // Try to read version from fallback directory if versionCheckUrl provided
                if let versionCheckUrl = versionCheckUrl {
                    do {
                        let otaVersion = try downloadVersionFromUrl(versionCheckUrl)
                        preferences.setOtaVersion(otaVersion)
                        print("OtaManager: Stored OTA version from URL in UserDefaults: \(otaVersion)")
                    } catch {
                        print("OtaManager: Failed to download version from URL for fallback: \(versionCheckUrl), error: \(error.localizedDescription)")
                    }
                }

                // Store the Android bundle name in user defaults
                preferences.setOtaBundleName(androidBundleName)
                print("OtaManager: Stored Android bundle name in UserDefaults: \(androidBundleName)")

                // Clean up old OTA directories, keeping only the 2 most recent
                cleanupOldOtaDirectories()

                return unzipDir.path
            }
        } catch {
            print("OtaManager: Error in downloadAndUnzipFromUrl for URL: \(downloadUrl), error: \(error.localizedDescription)")
            throw error
        }

        // Always delete the zip file
        do {
            try FileManager.default.removeItem(at: zipFile)
            print("OtaManager: Cleaned up temp zip file: \(zipFile.path)")
        } catch {
            print("OtaManager: Failed to clean up temp zip file: \(zipFile.path), error: \(error.localizedDescription)")
        }
    }

    func getStoredUnzippedPath() -> String? {
        return preferences.getOtaUnzippedPath()
    }

    func getStoredBundleName() -> String? {
        return preferences.getOtaBundleName()
    }

    func getStoredOtaVersion() -> String? {
        return preferences.getOtaVersion()
    }

    func checkForUpdates(_ versionCheckUrl: String? = nil) throws -> Bool {
        let checkUrl = try versionCheckUrl ?? preferences.getUpdateVersionCheckUrl() ?? {
            throw NSError(domain: "OtaManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "No version check URL provided and none stored. Call downloadAndUnzipFromUrl with versionCheckUrl first or provide URL."])
        }()

        let storedVersion = preferences.getOtaVersion()

        print("OtaManager: Checking for updates using version check URL: \(checkUrl)")
        print("OtaManager: Current stored version: \(storedVersion ?? "nil")")

        // Download current version from the URL
        let currentVersion = try downloadVersionFromUrl(checkUrl)
        print("OtaManager: Latest version from URL: \(currentVersion)")

        // Compare versions
        let hasUpdate = storedVersion != currentVersion

        print("OtaManager: Update available: \(hasUpdate)")

        return hasUpdate
    }

    func clearStoredData() {
        preferences.clearOtaData()
        print("OtaManager: Cleared stored OTA data from UserDefaults")
    }
}

// MARK: - NitroOta

class NitroOta: HybridNitroOtaSpec {
    private lazy var otaManager = OtaManager()

    func checkForUpdates(versionCheckUrl: String) throws -> Promise<Bool> {
        return Promise.async {
            do {
                print("NitroOta: Checking for updates using version check URL: \(versionCheckUrl)")
                let hasUpdate = try self.otaManager.checkForUpdates(versionCheckUrl)
                print("NitroOta: Update check result: \(hasUpdate)")
                return hasUpdate
            } catch {
                print("NitroOta: Failed to check for updates: \(error.localizedDescription)")
                throw error
            }
        }
    }

    func downloadZipFromUrl(downloadUrl: String) throws -> Promise<String> {
        return Promise.async {
            do {
                print("NitroOta: Starting download from URL: \(downloadUrl)")
                let unzippedPath = try self.otaManager.downloadAndUnzipFromUrl(downloadUrl, versionCheckUrl: nil)
                print("NitroOta: Unzipped path: \(unzippedPath)")
                return unzippedPath
            } catch {
                print("NitroOta: Failed to download and unzip: \(error.localizedDescription)")
                throw error
            }
        }
    }

    func getStoredOtaVersion() throws -> String? {
        return otaManager.getStoredOtaVersion()
    }

    func getStoredUnzippedPath() throws -> String? {
        return otaManager.getStoredUnzippedPath()
    }

    func getStoredBundlePath() -> String? {
        return otaManager.getStoredUnzippedPath()
    }
    
  func reloadApp() throws {
    let reload = {
      NitroOtaBridge.triggerReload(withReason: "NITRO OTA UPDATE")
    }
    if Thread.isMainThread {
      reload()
    } else {
      DispatchQueue.main.sync {
        reload()
      }
    }
  }
}

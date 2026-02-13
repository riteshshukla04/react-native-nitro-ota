//
//  NitroOta.swift
//  NitroOta
//
//  Created by Ritesh Shukla on 19/10/25.
//

import Foundation
import NitroModules
import SSZipArchive
import UIKit
import BackgroundTasks



// MARK: - BackgroundOTAScheduler

class BackgroundOTAScheduler {
    static let shared = BackgroundOTAScheduler()
    
    private var timer: Timer?
    private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid
    
    private init() {}
    
    func scheduleCheck(interval: TimeInterval, versionCheckUrl: String, downloadUrl: String?, otaManager: OtaManager) {
        // Cancel any existing timer
        cancelScheduledCheck()
        
        print("BackgroundOTAScheduler: Scheduling check in \(interval) seconds")
        
        // Schedule on main thread since Timer needs a run loop
        DispatchQueue.main.async { [weak self] in
            self?.timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
                self?.performOTACheck(versionCheckUrl: versionCheckUrl, downloadUrl: downloadUrl, otaManager: otaManager)
            }
        }
    }
    
    func cancelScheduledCheck() {
        timer?.invalidate()
        timer = nil
        
        // End any background task
        if backgroundTaskID != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTaskID)
            backgroundTaskID = .invalid
        }
        
        print("BackgroundOTAScheduler: Cancelled scheduled check")
    }
    
    private func performOTACheck(versionCheckUrl: String, downloadUrl: String?, otaManager: OtaManager) {
        print("BackgroundOTAScheduler: Starting OTA check...")
        
        // Begin background task to extend execution time
        backgroundTaskID = UIApplication.shared.beginBackgroundTask(withName: "com.pikachu.NitroOta.backgroundOTA") { [weak self] in
            print("BackgroundOTAScheduler: Background task expiring, cleaning up...")
            if let taskID = self?.backgroundTaskID, taskID != .invalid {
                UIApplication.shared.endBackgroundTask(taskID)
                self?.backgroundTaskID = .invalid
            }
        }
        
        guard backgroundTaskID != .invalid else {
            print("BackgroundOTAScheduler: Failed to start background task")
            return
        }
        
        print("BackgroundOTAScheduler: Background task started with ID: \(backgroundTaskID)")
        
        // Perform the check on a background queue
        DispatchQueue.global(qos: .background).async { [weak self] in
            do {
                // Check for updates using native code
                print("BackgroundOTAScheduler: Checking for updates...")
                let hasUpdate = try otaManager.checkForUpdates(versionCheckUrl)
                
                if hasUpdate {
                    print("BackgroundOTAScheduler: Update available! Starting download...")
                    
                    // Use provided download URL or fall back to version check URL
                    let urlToDownload = downloadUrl ?? versionCheckUrl
                    
                    do {
                        let unzippedPath = try otaManager.downloadAndUnzipFromUrl(urlToDownload, versionCheckUrl: nil)
                        print("BackgroundOTAScheduler: Update downloaded and extracted successfully to: \(unzippedPath)")
                        print("BackgroundOTAScheduler: App will use the new bundle on next restart")
                    } catch {
                        print("BackgroundOTAScheduler: Failed to download update: \(error.localizedDescription)")
                    }
                } else {
                    print("BackgroundOTAScheduler: No update available, app is up to date")
                }
            } catch {
                print("BackgroundOTAScheduler: Error during OTA check: \(error.localizedDescription)")
            }
            
            // End the background task
            print("BackgroundOTAScheduler: Ending background task")
            if let taskID = self?.backgroundTaskID, taskID != .invalid {
                UIApplication.shared.endBackgroundTask(taskID)
                self?.backgroundTaskID = .invalid
            }
        }
    }
}


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
    func downloadFile(from url: URL, to destination: URL, onProgress: ((Int64, Int64) -> Void)? = nil) throws {
        var resultError: Error?
        let semaphore = DispatchSemaphore(value: 0)
        var progressObservation: NSKeyValueObservation?

        let task = URLSession.shared.downloadTask(with: url) { tempURL, _, error in
            progressObservation?.invalidate()
            progressObservation = nil
            defer { semaphore.signal() }
            if let error = error {
                resultError = error
                return
            }
            guard let tempURL = tempURL else {
                resultError = NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "No file downloaded"])
                return
            }
            do {
                if FileManager.default.fileExists(atPath: destination.path) {
                    try FileManager.default.removeItem(at: destination)
                }
                try FileManager.default.moveItem(at: tempURL, to: destination)
                // Final call: received == total signals download complete.
                if let cb = onProgress,
                   let attrs = try? FileManager.default.attributesOfItem(atPath: destination.path),
                   let size = attrs[.size] as? Int64 {
                    cb(size, size)
                }
            } catch {
                resultError = error
            }
        }

        if let onProgress = onProgress {
            progressObservation = task.observe(\.countOfBytesReceived, options: [.new]) { t, _ in
                onProgress(t.countOfBytesReceived, t.countOfBytesExpectedToReceive)
            }
        }

        task.resume()
        semaphore.wait()

        if let error = resultError {
            throw error
        }
    }

    func downloadText(from url: URL) throws -> String {
        var resultData: Data?
        var resultError: Error?
        
        let semaphore = DispatchSemaphore(value: 0)
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("text/plain, */*", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                resultError = error
            } else if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                    resultData = data
                } else {
                    resultError = NSError(
                        domain: "DownloadManager",
                        code: httpResponse.statusCode,
                        userInfo: [NSLocalizedDescriptionKey: "HTTP error: \(httpResponse.statusCode)"]
                    )
                }
            } else {
                resultData = data
            }
            semaphore.signal()
        }
        task.resume()
        semaphore.wait()
        
        if let error = resultError {
            throw error
        }
        
        guard let data = resultData else {
            throw NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "No data received"])
        }
        
        guard let text = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to decode text data as UTF-8"])
        }
        return text
    }

    func downloadText(from urlString: String) throws -> String {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL: \(urlString)"])
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
    // Rollback keys (shared with NitroOtaPreferences in NitroIsolatedBundle - same suite, same keys)
    private var otaPreviousUnzippedPathKey: String { "ota_previous_unzipped_path_\(appVersion)" }
    private var otaPreviousVersionKey: String { "ota_previous_version_\(appVersion)" }
    private var otaRollbackCountKey: String { "ota_rollback_count_\(appVersion)" }
    private var otaBlacklistedVersionsKey: String { "ota_blacklisted_versions_\(appVersion)" }
    private var otaRollbackHistoryKey: String { "ota_rollback_history_\(appVersion)" }
    private var otaPendingValidationKey: String { "ota_pending_validation_\(appVersion)" }
    private var otaNotifiedRollbackCountKey: String { "ota_notified_rollback_count_\(appVersion)" }

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

    // MARK: - Rollback getters/setters

    func getPreviousUnzippedPath() -> String? {
        return userDefaults.string(forKey: otaPreviousUnzippedPathKey)
    }

    func setPreviousUnzippedPath(_ path: String) {
        userDefaults.set(path, forKey: otaPreviousUnzippedPathKey)
        userDefaults.synchronize()
    }

    func getPreviousVersion() -> String? {
        return userDefaults.string(forKey: otaPreviousVersionKey)
    }

    func setPreviousVersion(_ version: String) {
        userDefaults.set(version, forKey: otaPreviousVersionKey)
        userDefaults.synchronize()
    }

    func getRollbackCount() -> Int {
        return userDefaults.integer(forKey: otaRollbackCountKey)
    }

    func setRollbackCount(_ count: Int) {
        userDefaults.set(count, forKey: otaRollbackCountKey)
        userDefaults.synchronize()
    }

    func getBlacklistedVersions() -> [String] {
        guard let json = userDefaults.string(forKey: otaBlacklistedVersionsKey),
              let data = json.data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [String] else {
            return []
        }
        return arr
    }

    func setBlacklistedVersions(_ versions: [String]) {
        if let data = try? JSONSerialization.data(withJSONObject: versions),
           let json = String(data: data, encoding: .utf8) {
            userDefaults.set(json, forKey: otaBlacklistedVersionsKey)
            userDefaults.synchronize()
        }
    }

    func getBlacklistedVersionsJson() -> String {
        guard let json = userDefaults.string(forKey: otaBlacklistedVersionsKey) else {
            return "[]"
        }
        return json
    }

    func getRollbackHistory() -> [[String: Any]] {
        guard let json = userDefaults.string(forKey: otaRollbackHistoryKey),
              let data = json.data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        return arr
    }

    func getRollbackHistoryJson() -> String {
        return userDefaults.string(forKey: otaRollbackHistoryKey) ?? "[]"
    }

    func appendRollbackHistory(_ record: [String: Any]) {
        var history = getRollbackHistory()
        history.append(record)
        if let data = try? JSONSerialization.data(withJSONObject: history),
           let json = String(data: data, encoding: .utf8) {
            userDefaults.set(json, forKey: otaRollbackHistoryKey)
            userDefaults.synchronize()
        }
    }

    func setRollbackHistory(_ history: [[String: Any]]) {
        if let data = try? JSONSerialization.data(withJSONObject: history),
           let json = String(data: data, encoding: .utf8) {
            userDefaults.set(json, forKey: otaRollbackHistoryKey)
            userDefaults.synchronize()
        }
    }

    func isPendingValidation() -> Bool {
        return userDefaults.bool(forKey: otaPendingValidationKey)
    }

    func setPendingValidation(_ pending: Bool) {
        userDefaults.set(pending, forKey: otaPendingValidationKey)
        userDefaults.synchronize()
    }

    func getNotifiedRollbackCount() -> Int {
        return userDefaults.integer(forKey: otaNotifiedRollbackCountKey)
    }

    func setNotifiedRollbackCount(_ count: Int) {
        userDefaults.set(count, forKey: otaNotifiedRollbackCountKey)
        userDefaults.synchronize()
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
        userDefaults.removeObject(forKey: otaPreviousUnzippedPathKey)
        userDefaults.removeObject(forKey: otaPreviousVersionKey)
        userDefaults.removeObject(forKey: otaRollbackCountKey)
        userDefaults.removeObject(forKey: otaBlacklistedVersionsKey)
        userDefaults.removeObject(forKey: otaRollbackHistoryKey)
        userDefaults.removeObject(forKey: otaPendingValidationKey)
        userDefaults.removeObject(forKey: otaNotifiedRollbackCountKey)
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
    private let bundleExtension = ".jsbundle"

    // MARK: - Private helper methods
    
    private func findBundleFile(in directory: URL) -> String? {
        do {
            let contents = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil, options: [])
            for item in contents {
                if item.pathExtension == "jsbundle" {
                    return item.lastPathComponent
                }
            }
        } catch {
            print("OtaManager: Error searching for bundle file: \(error.localizedDescription)")
        }
        return nil
    }

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
            // But never delete a directory that is currently referenced (current or previous bundle)
            let currentPath = preferences.getOtaUnzippedPath() ?? ""
            let previousPath = preferences.getPreviousUnzippedPath() ?? ""
            let dirsToDelete = Array(sortedDirs.dropFirst(2)).filter { dir in
                !currentPath.hasPrefix(dir.path) && !previousPath.hasPrefix(dir.path)
            }
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

    private func findContentFolder(unzipDir: URL) -> (folder: URL, bundleName: String)? {
        do {
            // First, check if any .jsbundle file exists directly in unzipDir
            if let bundleName = findBundleFile(in: unzipDir) {
                print("OtaManager: Found \(bundleName) directly in unzip directory, no renaming needed")
                return (unzipDir, bundleName)
            }

            let contents = try FileManager.default.contentsOfDirectory(at: unzipDir, includingPropertiesForKeys: [.isDirectoryKey], options: [])

            for item in contents {
                do {
                    let resourceValues = try item.resourceValues(forKeys: [.isDirectoryKey])
                    if resourceValues.isDirectory ?? false {
                        // Check if any .jsbundle file exists in this directory
                        if let bundleNameInDir = findBundleFile(in: item) {
                            print("OtaManager: Found \(bundleNameInDir) in directory '\(item.lastPathComponent)'")
                            return (item, bundleNameInDir)
                        }

                        // Found a directory, keep the original folder name to preserve Metro's asset paths
                        print("OtaManager: Using content folder with original name: '\(item.lastPathComponent)'")
                        
                        // Try to find bundle in the directory
                        if let bundleInResultDir = findBundleFile(in: item) {
                            print("OtaManager: Found bundle \(bundleInResultDir) in directory '\(item.lastPathComponent)'")
                            return (item, bundleInResultDir)
                        }
                        
                        // No bundle found, return with a default name
                        print("OtaManager: No \(bundleExtension) file found in directory '\(item.lastPathComponent)', using default name")
                        return (item, "main.jsbundle")
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
        // First, try to read ota.version.json
        let otaVersionJsonFile = contentFolder.appendingPathComponent("ota.version.json")
        if FileManager.default.fileExists(atPath: otaVersionJsonFile.path) {
            do {
                let jsonData = try Data(contentsOf: otaVersionJsonFile)
                let jsonContent = try String(data: jsonData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                print("OtaManager: Found ota.version.json file with content: \(jsonContent)")
                
                if let jsonObject = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any],
                   let version = jsonObject["version"] as? String {
                    print("OtaManager: Parsed version from JSON: \(version)")
                    preferences.setOtaVersion(version)
                    print("OtaManager: Stored OTA version in UserDefaults: \(version)")
                    
                    // Log additional metadata if present
                    if let isSemver = jsonObject["isSemver"] as? Bool {
                        print("OtaManager: isSemver: \(isSemver)")
                    }
                    if let releaseNotes = jsonObject["releaseNotes"] as? String {
                        print("OtaManager: Release notes: \(releaseNotes)")
                    }
                    if let targetVersions = jsonObject["targetVersions"] {
                        print("OtaManager: Target versions: \(targetVersions)")
                    }
                    
                    return
                }
            } catch {
                print("OtaManager: Error parsing ota.version.json file: \(error.localizedDescription)")
                // Fall through to try ota.version file
            }
        }
        
        // Fallback to reading ota.version file
        let otaVersionFile = contentFolder.appendingPathComponent("ota.version")
        do {
            let otaVersion = try String(contentsOf: otaVersionFile, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
            print("OtaManager: Found ota.version file with content: \(otaVersion)")
            preferences.setOtaVersion(otaVersion)
            print("OtaManager: Stored OTA version in UserDefaults: \(otaVersion)")
        } catch {
            print("OtaManager: Neither ota.version.json nor ota.version file found in content folder: \(contentFolder.path)")
        }
    }

    private func downloadVersionFromUrl(_ versionUrl: String) throws -> String {
        print("OtaManager: Downloading version from URL: \(versionUrl)")
        let versionContent = try downloadManager.downloadText(from: versionUrl).trimmingCharacters(in: .whitespacesAndNewlines)
        print("OtaManager: Downloaded version: \(versionContent)")
        return versionContent
    }

    // MARK: - Public methods

    func downloadAndUnzipFromUrl(_ downloadUrl: String, versionCheckUrl: String?, onProgress: ((Int64, Int64) -> Void)? = nil) throws -> String {
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

        // Ensure zip file is always cleaned up
        defer {
            do {
                try FileManager.default.removeItem(at: zipFile)
                print("OtaManager: Cleaned up temp zip file: \(zipFile.path)")
            } catch {
                print("OtaManager: Failed to clean up temp zip file: \(zipFile.path), error: \(error.localizedDescription)")
            }
        }

        // Rotate current bundle to previous slot before downloading new one
        if let existingPath = preferences.getOtaUnzippedPath(), !existingPath.isEmpty {
            preferences.setPreviousUnzippedPath(existingPath)
            print("OtaManager: Rotated current path to previous: \(existingPath)")
        }
        if let existingVersion = preferences.getOtaVersion(), !existingVersion.isEmpty {
            preferences.setPreviousVersion(existingVersion)
        }
        // Reset rollback counter on new successful download; mark as pending validation
        preferences.setRollbackCount(0)
        preferences.setPendingValidation(true)

        do {
            // Download the zip file
            guard let downloadURL = URL(string: downloadUrl) else {
                throw NSError(domain: "OtaManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid download URL"])
            }
            print("OtaManager: Downloading zip file...")
            try downloadManager.downloadFile(from: downloadURL, to: zipFile, onProgress: onProgress)
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

            // Find the actual content folder and detect bundle name
            let result = findContentFolder(unzipDir: unzipDir)
            if let (contentFolder, bundleName) = result {
                print("OtaManager: Using content folder: \(contentFolder.path), bundle: \(bundleName)")

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
                preferences.setOtaUnzippedPath(contentFolder.appendingPathComponent(bundleName).path)
                print("OtaManager: Stored content folder path in UserDefaults: \(contentFolder.path)")

                // Store the detected bundle name in user defaults
                preferences.setOtaBundleName(bundleName)
                print("OtaManager: Stored bundle name in UserDefaults: \(bundleName)")

                // Clean up old OTA directories, keeping only the 2 most recent
                cleanupOldOtaDirectories()

                return contentFolder.path
            } else {
                print("OtaManager: No content folder found in unzip directory")
                
                // Try to find bundle directly in unzip directory as fallback
                let fallbackBundleName = findBundleFile(in: unzipDir) ?? "main.jsbundle"
                
                // Fallback to unzip directory
                preferences.setOtaUnzippedPath(unzipDir.appendingPathComponent(fallbackBundleName).path)
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

                // Store the detected bundle name in user defaults
                preferences.setOtaBundleName(fallbackBundleName)
                print("OtaManager: Stored bundle name in UserDefaults: \(fallbackBundleName)")

                // Clean up old OTA directories, keeping only the 2 most recent
                cleanupOldOtaDirectories()

                return unzipDir.path
            }
        } catch {
            print("OtaManager: Error in downloadAndUnzipFromUrl for URL: \(downloadUrl), error: \(error.localizedDescription)")
            throw error
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
    
    func getStoredVersionCheckUrl() -> String? {
        return preferences.getUpdateVersionCheckUrl()
    }
    
    func getStoredDownloadUrl() -> String? {
        return preferences.getUpdateDownloadUrl()
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

        // Blacklist check: if this version was previously rolled back, skip it
        let blacklisted = preferences.getBlacklistedVersions()
        if blacklisted.contains(currentVersion) {
            print("OtaManager: Remote version '\(currentVersion)' is blacklisted (was previously rolled back), skipping update")
            return false
        }

        // Compare versions
        let hasUpdate = storedVersion != currentVersion

        print("OtaManager: Update available: \(hasUpdate)")

        return hasUpdate
    }

    func clearStoredData() {
        preferences.clearOtaData()
        print("OtaManager: Cleared stored OTA data from UserDefaults")
    }

    // MARK: - Rollback API

    /// Rolls back to the previous OTA bundle (or resets to original if count > 3 or no previous exists).
    /// Blacklists the current version and logs rollback history.
    /// Call reloadApp() after this to apply the change.
    func rollbackToPreviousBundle() -> Bool {
        let previousPath = preferences.getPreviousUnzippedPath()
        let previousVersion = preferences.getPreviousVersion()
        let currentVersion = preferences.getOtaVersion()

        // Blacklist the current (bad) version
        if let badVersion = currentVersion, !badVersion.isEmpty {
            var blacklist = preferences.getBlacklistedVersions()
            if !blacklist.contains(badVersion) {
                blacklist.append(badVersion)
                preferences.setBlacklistedVersions(blacklist)
            }
        }

        // Increment rollback counter
        let count = preferences.getRollbackCount() + 1
        preferences.setRollbackCount(count)

        let effectiveReason: String = count > 3 ? "max_rollbacks_exceeded" : "manual"
        let hasPrevious = previousPath != nil && !previousPath!.isEmpty
        let toVersion = (count > 3 || !hasPrevious) ? "original" : (previousVersion ?? "unknown")

        // Append to rollback history
        preferences.appendRollbackHistory([
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "fromVersion": currentVersion ?? "unknown",
            "toVersion": toVersion,
            "reason": effectiveReason
        ])

        // Also ask the native crash handler to update its state
        // (clear pending_validation since we are manually rolling back)
        preferences.setPendingValidation(false)

        if count > 3 || !hasPrevious {
            // Reset to original app bundle
            preferences.setOtaUnzippedPath("")
            preferences.setOtaVersion("")
            preferences.setRollbackCount(0)
            print("OtaManager: Rollback limit exceeded or no previous bundle — reset to original")
        } else {
            // Promote previous bundle to current
            preferences.setOtaUnzippedPath(previousPath!)
            preferences.setOtaVersion(previousVersion ?? "")
            preferences.setPreviousUnzippedPath("")
            preferences.setPreviousVersion("")
            print("OtaManager: Rolled back from \(currentVersion ?? "unknown") to \(previousVersion ?? "unknown")")
        }

        return true
    }

    /// Confirms the current bundle is working correctly.
    /// Disables the crash-rollback guard for this bundle.
    func confirmBundle() {
        preferences.setPendingValidation(false)
        print("OtaManager: Bundle confirmed — crash guard disabled for this bundle")
    }

    /// Returns a JSON-encoded array of blacklisted OTA version strings.
    func getBlacklistedVersions() -> String {
        return preferences.getBlacklistedVersionsJson()
    }

    /// Returns a JSON-encoded array of rollback history records.
    func getRollbackHistory() -> String {
        return preferences.getRollbackHistoryJson()
    }

    /// Returns the number of rollback history entries already acknowledged.
    func getNotifiedRollbackCount() -> Int {
        return preferences.getNotifiedRollbackCount()
    }

    /// Stores the current rollback history length as "seen".
    /// Call this after notifying the user of any crash rollbacks so the same
    /// entries are not reported again on the next app launch.
    func acknowledgeRollbackHistory() {
        let count = getRollbackHistory().count
        preferences.setNotifiedRollbackCount(count)
        print("OtaManager: Acknowledged \(count) rollback history entries")
    }

    /// Blacklists the current bundle and triggers a rollback with a custom reason.
    /// Call reloadApp() after this to apply.
    func markCurrentBundleAsBad(reason: String) {
        _ = rollbackToPreviousBundle()
        // Update the reason in the last history entry to reflect the user-provided reason
        var history = preferences.getRollbackHistory()
        if !history.isEmpty {
            history[history.count - 1]["reason"] = reason
            preferences.setRollbackHistory(history)
        }
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

    func downloadZipFromUrl(downloadUrl: String, onProgress: Variant_NullType____received__Double____total__Double_____Void?) throws -> Promise<String> {
        return Promise.async {
            do {
                print("NitroOta: Starting download from URL: \(downloadUrl)")
                let progressCallback: ((Int64, Int64) -> Void)?
                if case .second(let cb) = onProgress {
                    progressCallback = { received, total in cb(Double(received), Double(total)) }
                } else {
                    progressCallback = nil
                }
                let unzippedPath = try self.otaManager.downloadAndUnzipFromUrl(downloadUrl, versionCheckUrl: nil, onProgress: progressCallback)
                print("NitroOta: Unzipped path: \(unzippedPath)")
                return unzippedPath
            } catch {
                print("NitroOta: Failed to download and unzip: \(error.localizedDescription)")
                throw error
            }
        }
    }

    func getStoredOtaVersion() throws -> Variant_NullType_String {
        if let version = otaManager.getStoredOtaVersion() {
            return .second(version)
        } else {
            return .first(NullType.null)
        }
    }

    func getStoredUnzippedPath() throws -> Variant_NullType_String {
        if let path = otaManager.getStoredUnzippedPath() {
            return .second(path)
        } else {
            return .first(NullType.null)
        }
    }

    func getStoredBundlePath() -> String? {
        return otaManager.getStoredUnzippedPath()
    }
    func scheduleBackgroundOTACheck(versionCheckUrl: String, downloadUrl: Variant_NullType_String?, interval: Double) throws -> Void {
        // Extract the actual download URL string from the Variant (null | string)
        let downloadUrlString: String?
        if let variant = downloadUrl {
            switch variant {
            case .first:
                downloadUrlString = nil
            case .second(let str):
                downloadUrlString = str
            }
        } else {
            downloadUrlString = nil
        }
        
        print("NitroOta: Scheduling background OTA check")
        print("NitroOta:   - Version check URL: \(versionCheckUrl)")
        print("NitroOta:   - Download URL: \(downloadUrlString ?? "nil (will use version check URL)")")
        print("NitroOta:   - Interval: \(interval) seconds")
        
        if versionCheckUrl.isEmpty {
            print("NitroOta: ERROR - Version check URL is empty")
            throw NSError(
                domain: "com.pikachu.NitroOta",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Version check URL cannot be empty"]
            )
        }
        
        // Cancel any existing timer to prevent multiple schedules
        BackgroundOTAScheduler.shared.cancelScheduledCheck()
        
        // Schedule the background OTA check using native code with URLs from JavaScript
        BackgroundOTAScheduler.shared.scheduleCheck(
            interval: interval,
            versionCheckUrl: versionCheckUrl,
            downloadUrl: downloadUrlString,
            otaManager: otaManager
        )
        
        print("NitroOta: Background OTA check scheduled successfully")
        print("NitroOta:   - Safe to call multiple times (replaces existing schedule)")
        print("NitroOta:   - Will check for updates and download automatically using native code")
        print("NitroOta:   - Using URLs provided from JavaScript (not stored preferences)")
        print("NitroOta:   - Note: iOS background execution is limited by system")
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

    func rollbackToPreviousBundle() throws -> Promise<Bool> {
        return Promise.async {
            print("NitroOta: Rolling back to previous bundle")
            let success = self.otaManager.rollbackToPreviousBundle()
            print("NitroOta: Rollback result: \(success)")
            return success
        }
    }

    func confirmBundle() throws {
        otaManager.confirmBundle()
    }

    func getBlacklistedVersions() throws -> Promise<String> {
        return Promise.async {
            return self.otaManager.getBlacklistedVersions()
        }
    }

    func getRollbackHistory() throws -> Promise<String> {
        return Promise.async {
            return self.otaManager.getRollbackHistory()
        }
    }

    func getNotifiedRollbackCount() throws -> Double {
        return Double(otaManager.getNotifiedRollbackCount())
    }

    func acknowledgeRollbackHistory() throws -> Void {
        otaManager.acknowledgeRollbackHistory()
    }

    func markCurrentBundleAsBad(reason: String) throws -> Promise<Void> {
        return Promise.async {
            print("NitroOta: Marking current bundle as bad, reason: \(reason)")
            self.otaManager.markCurrentBundleAsBad(reason: reason)
        }
    }
}


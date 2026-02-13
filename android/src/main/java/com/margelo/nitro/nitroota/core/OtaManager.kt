package com.margelo.nitro.nitroota.core

import android.content.Context
import com.margelo.nitro.nitroota.network.DownloadManager
import com.margelo.nitro.nitroota.utils.PreferencesUtils
import com.margelo.nitro.nitroota.utils.UrlUtils
import com.margelo.nitro.nitroota.utils.ZipUtils
import java.io.File
import android.util.Log
import org.json.JSONObject

private const val BUNDLE_EXTENSION = ".bundle"


class OtaManager(
    private val context: Context,
    private val downloadManager: DownloadManager = DownloadManager(),
    private val preferences: PreferencesUtils = PreferencesUtils.create(context)
) {

    /**
     * Cleans up old OTA unzip directories, keeping only the 2 most recent ones.
     * This ensures we don't accumulate too many old update folders.
     */
    private fun cleanupOldOtaDirectories() {
        try {
            val filesDir = context.filesDir
            val otaDirectories = filesDir.listFiles { file ->
                file.isDirectory && file.name.startsWith("ota_unzipped_")
            }?.toList() ?: emptyList()

            if (otaDirectories.size <= 2) {
                Log.d("OtaManager", "Found ${otaDirectories.size} OTA directories, no cleanup needed")
                return
            }

            // Sort by timestamp (newest first) - extract timestamp from folder name
            val sortedDirs = otaDirectories.sortedByDescending { dir ->
                try {
                    // Extract timestamp from "ota_unzipped_<timestamp>" format
                    val timestampStr = dir.name.substringAfter("ota_unzipped_")
                    timestampStr.toLong()
                } catch (e: Exception) {
                    // If parsing fails, treat as very old (timestamp 0)
                    Log.w("OtaManager", "Failed to parse timestamp from directory name: ${dir.name}", e)
                    0L
                }
            }

            // Keep only the first 2 (most recent), delete the rest.
            // Never delete a directory that is currently referenced (current or previous bundle).
            val currentPath = preferences.getOtaUnzippedPath() ?: ""
            val previousPath = preferences.getPreviousUnzippedPath() ?: ""
            val dirsToDelete = sortedDirs.drop(2).filter { dir ->
                !currentPath.startsWith(dir.absolutePath) && !previousPath.startsWith(dir.absolutePath)
            }
            Log.d("OtaManager", "Found ${otaDirectories.size} OTA directories, keeping 2 most recent, deleting ${dirsToDelete.size} old ones")

            dirsToDelete.forEach { dir ->
                try {
                    val deleted = dir.deleteRecursively()
                    if (deleted) {
                        Log.d("OtaManager", "Successfully deleted old OTA directory: ${dir.absolutePath}")
                    } else {
                        Log.w("OtaManager", "Failed to delete old OTA directory: ${dir.absolutePath}")
                    }
                } catch (e: Exception) {
                    Log.e("OtaManager", "Error deleting old OTA directory: ${dir.absolutePath}", e)
                }
            }
        } catch (e: Exception) {
            Log.e("OtaManager", "Error during OTA directory cleanup", e)
        }
    }

    /**
     * Finds any .bundle file in a directory.
     *
     * @param directory The directory to search in
     * @return The name of the bundle file if found, or null
     */
    private fun findBundleFile(directory: File): String? {
        val files = directory.listFiles() ?: return null
        for (file in files) {
            if (file.isFile && file.name.endsWith(BUNDLE_EXTENSION)) {
                return file.name
            }
        }
        return null
    }

    /**
     * Finds the content folder inside the unzip directory, preserving the original folder name.
     * GitHub zips typically create a folder with the format "repo-name-branch".
     * Also detects the bundle file name automatically.
     *
     * @param unzipDir The directory where files were unzipped
     * @return A Pair of (content folder, bundle name) or null if not found
     */
    private fun findContentFolder(unzipDir: File): Pair<File, String>? {
        val files = unzipDir.listFiles()
        if (files != null) {
            // First, check if any .bundle file exists directly in unzipDir
            val bundleName = findBundleFile(unzipDir)
            if (bundleName != null) {
                Log.d("OtaManager", "Found $bundleName directly in unzip directory, no renaming needed")
                return Pair(unzipDir, bundleName)
            }

            for (file in files) {
                if (file.isDirectory) {
                    // Check if any .bundle file exists in this directory
                    val bundleNameInDir = findBundleFile(file)
                    if (bundleNameInDir != null) {
                        Log.d("OtaManager", "Found $bundleNameInDir in directory '${file.name}'")
                        return Pair(file, bundleNameInDir)
                    }

                    // Found a directory, keep the original folder name to preserve Metro's asset paths
                    Log.d("OtaManager", "Using content folder with original name: '${file.name}'")
                    
                    // Try to find bundle in the directory
                    val bundleInResultDir = findBundleFile(file)
                    if (bundleInResultDir != null) {
                        Log.d("OtaManager", "Found bundle ${bundleInResultDir} in directory '${file.name}'")
                        return Pair(file, bundleInResultDir)
                    }
                    
                    // No bundle found, return with a default name
                    Log.w("OtaManager", "No $BUNDLE_EXTENSION file found in directory '${file.name}', using default name")
                    return Pair(file, "index.android.bundle")
                }
            }
        }
        return null
    }

    /**
     * Downloads a zip file from any URL, unzips it, and stores the path.
     *
     * @param downloadUrl The direct URL to download the zip file from
     * @param versionCheckUrl The URL to check for version information (optional)
     * @return The absolute path to the unzipped directory
     * @throws Exception If download or unzip fails
     */
    fun downloadAndUnzipFromUrl(downloadUrl: String, versionCheckUrl: String? = null): String {
        // Rotate current bundle to previous slot before downloading a new one
        val existingPath = preferences.getOtaUnzippedPath()
        val existingVersion = preferences.getOtaVersion()
        if (!existingPath.isNullOrEmpty()) {
            preferences.setPreviousUnzippedPath(existingPath)
            Log.d("OtaManager", "Rotated current path to previous: $existingPath")
        }
        if (!existingVersion.isNullOrEmpty()) {
            preferences.setPreviousVersion(existingVersion)
        }
        // Reset rollback counter on new download; mark as pending validation
        preferences.setRollbackCount(0)
        preferences.setPendingValidation(true)

        // Store the URLs for future update checks
        preferences.setUpdateDownloadUrl(downloadUrl)
        if (versionCheckUrl != null) {
            preferences.setUpdateVersionCheckUrl(versionCheckUrl)
        }
        Log.d("OtaManager", "Stored download URL: $downloadUrl and version check URL: $versionCheckUrl")

        // Create a temporary file for the zip
        val zipFile = File.createTempFile("ota_update", ".zip", context.filesDir)
        Log.d("OtaManager", "Created temp zip file: ${zipFile.absolutePath}")

        try {
            // Download the zip file
            Log.d("OtaManager", "Downloading zip file...")
            downloadManager.downloadFile(downloadUrl, zipFile)
            Log.d("OtaManager", "Download completed, zip file size: ${zipFile.length()} bytes")

            // Create directory for unzipped files
            val unzipDir = File(context.filesDir, "ota_unzipped_${System.currentTimeMillis()}")
            unzipDir.mkdirs()
            Log.d("OtaManager", "Created unzip directory: ${unzipDir.absolutePath}")

            // Unzip the file
            Log.d("OtaManager", "Starting unzip process...")
            ZipUtils.unzip(zipFile, unzipDir)
            Log.d("OtaManager", "Unzip completed, directory contents: ${unzipDir.list()?.joinToString(", ") ?: "No items"}")

            // Find the actual content folder and detect bundle name
            val result = findContentFolder(unzipDir)
            if (result != null) {
                val (contentFolder, bundleName) = result
                Log.d("OtaManager", "Using content folder: ${contentFolder.absolutePath}, bundle: $bundleName")

               
                    
                readVersionFromLocalFile(contentFolder)
             
                // Store the content folder path in shared preferences
                preferences.setOtaUnzippedPath(contentFolder.absolutePath + "/" + bundleName)
                Log.d("OtaManager", "Stored content folder path in SharedPreferences: ${contentFolder.absolutePath}")

                // Store the detected bundle name in shared preferences
                preferences.setOtaBundleName(bundleName)
                Log.d("OtaManager", "Stored bundle name in SharedPreferences: $bundleName")

                // Clean up old OTA directories, keeping only the 2 most recent
                cleanupOldOtaDirectories()

                return contentFolder.absolutePath
            } else {
                Log.w("OtaManager", "No content folder found in unzip directory")
                
                // Try to find bundle directly in unzip directory as fallback
                val fallbackBundleName = findBundleFile(unzipDir) ?: "index.android.bundle"
                
                // Fallback to unzip directory
                preferences.setOtaUnzippedPath(unzipDir.absolutePath + "/" + fallbackBundleName)
                Log.d("OtaManager", "Stored fallback unzip path in SharedPreferences: ${unzipDir.absolutePath}")

                // Try to read version from fallback directory if versionCheckUrl provided
                if (versionCheckUrl != null) {
                    try {
                        val otaVersion = downloadVersionFromUrl(versionCheckUrl)
                        preferences.setOtaVersion(otaVersion)
                        Log.d("OtaManager", "Stored OTA version from URL in SharedPreferences: $otaVersion")
                    } catch (e: Exception) {
                        Log.w("OtaManager", "Failed to download version from URL for fallback: $versionCheckUrl", e)
                    }
                }

                // Store the detected bundle name in shared preferences
                preferences.setOtaBundleName(fallbackBundleName)
                Log.d("OtaManager", "Stored bundle name in SharedPreferences: $fallbackBundleName")

                // Clean up old OTA directories, keeping only the 2 most recent
                cleanupOldOtaDirectories()

                return unzipDir.absolutePath
            }
        } catch (e: Exception) {
            Log.e("OtaManager", "Error in downloadAndUnzipFromUrl for URL: $downloadUrl", e)
            throw e // Re-throw the exception
        } finally {
            // Always delete the zip file
            val deleted = zipFile.delete()
            Log.d("OtaManager", "Cleaned up temp zip file: ${zipFile.absolutePath}, deleted: $deleted")
        }
    }

    /**
     * Gets the stored unzipped path from shared preferences.
     *
     * @return The stored unzipped directory path, or null if not found
     */
    fun getStoredUnzippedPath(): String? {
        return preferences.getOtaUnzippedPath()
    }

    /**
     * Gets the stored Android bundle name from shared preferences.
     *
     * @return The stored Android bundle name, or null if not found
     */
    fun getStoredBundleName(): String? {
        return preferences.getOtaBundleName()
    }

    /**
     * Gets the stored OTA version from shared preferences.
     *
     * @return The stored OTA version, or null if not found
     */
    fun getStoredOtaVersion(): String? {
        return preferences.getOtaVersion()
    }

    /**
     * Checks for updates by downloading the current version from the version check URL
     * and comparing it with the stored version. Returns true if a new version is available.
     *
     * @param versionCheckUrl The URL to check for version information (optional, uses stored URL if not provided)
     * @return true if a new version is available, false if current version is up to date
     * @throws Exception If download fails
     */
    fun checkForUpdates(versionCheckUrl: String? = null): Boolean {
        val checkUrl = versionCheckUrl ?: preferences.getUpdateVersionCheckUrl()
            ?: throw IllegalStateException("No version check URL provided and none stored. Call downloadAndUnzipFromUrl with versionCheckUrl first or provide URL.")

        val storedVersion = preferences.getOtaVersion()

        Log.d("OtaManager", "Checking for updates using version check URL: $checkUrl")
        Log.d("OtaManager", "Current stored version: $storedVersion")

        // Download current version from the URL
        val currentVersion = downloadVersionFromUrl(checkUrl)
        Log.d("OtaManager", "Latest version from URL: $currentVersion")

        // Blacklist check: if this version was previously rolled back, skip it
        val blacklisted = preferences.getBlacklistedVersions()
        if (blacklisted.contains(currentVersion)) {
            Log.w("OtaManager", "Remote version '$currentVersion' is blacklisted (was previously rolled back), skipping update")
            return false
        }

        // Compare versions
        val hasUpdate = storedVersion != currentVersion

        Log.d("OtaManager", "Update available: $hasUpdate")

        return hasUpdate
    }

    /**
     * Reads the ota.version.json or ota.version file from the local content folder.
     * Tries ota.version.json first, then falls back to ota.version.
     *
     * @param contentFolder The folder to read the version file from
     */
    private fun readVersionFromLocalFile(contentFolder: File) {
        // First, try to read ota.version.json
        val otaVersionJsonFile = File(contentFolder, "ota.version.json")
        if (otaVersionJsonFile.exists() && otaVersionJsonFile.isFile) {
            try {
                val jsonContent = otaVersionJsonFile.readText().trim()
                Log.d("OtaManager", "Found ota.version.json file with content: $jsonContent")
                
                val jsonObject = JSONObject(jsonContent)
                val otaVersion = jsonObject.getString("version")
                
                Log.d("OtaManager", "Parsed version from JSON: $otaVersion")
                preferences.setOtaVersion(otaVersion)
                Log.d("OtaManager", "Stored OTA version in SharedPreferences: $otaVersion")
                
                // Log additional metadata if present
                if (jsonObject.has("isSemver")) {
                    Log.d("OtaManager", "isSemver: ${jsonObject.getBoolean("isSemver")}")
                }
                if (jsonObject.has("releaseNotes")) {
                    Log.d("OtaManager", "Release notes: ${jsonObject.getString("releaseNotes")}")
                }
                if (jsonObject.has("targetVersions")) {
                    Log.d("OtaManager", "Target versions: ${jsonObject.getJSONObject("targetVersions")}")
                }
                
                return
            } catch (e: Exception) {
                Log.e("OtaManager", "Error parsing ota.version.json file", e)
                // Fall through to try ota.version file
            }
        }
        
        // Fallback to reading ota.version file
        val otaVersionFile = File(contentFolder, "ota.version")
        if (otaVersionFile.exists() && otaVersionFile.isFile) {
            val otaVersion = otaVersionFile.readText().trim()
            Log.d("OtaManager", "Found ota.version file with content: $otaVersion")
            preferences.setOtaVersion(otaVersion)
            Log.d("OtaManager", "Stored OTA version in SharedPreferences: $otaVersion")
        } else {
            Log.w("OtaManager", "Neither ota.version.json nor ota.version file found in content folder: ${contentFolder.absolutePath}")
        }
    }

    /**
     * Downloads the version from any URL and returns its content.
     *
     * @param versionUrl The URL to download the version from
     * @return The content of the version file/endpoint
     * @throws Exception If download fails
     */
    private fun downloadVersionFromUrl(versionUrl: String): String {
        Log.d("OtaManager", "Downloading version from URL: $versionUrl")

        // Download the version content as text
        val versionContent = downloadManager.downloadText(versionUrl).trim()
        Log.d("OtaManager", "Downloaded version: $versionContent")

        return versionContent
    }

    /**
     * Gets the stored version check URL from shared preferences.
     *
     * @return The stored version check URL, or null if not found
     */
    fun getStoredVersionCheckUrl(): String? {
        return preferences.getUpdateVersionCheckUrl()
    }

    /**
     * Gets the stored download URL from shared preferences.
     *
     * @return The stored download URL, or null if not found
     */
    fun getStoredDownloadUrl(): String? {
        return preferences.getUpdateDownloadUrl()
    }

    /**
     * Clears the stored OTA data (path, version, download URL, and version check URL) from shared preferences.
     */
    fun clearStoredData() {
        preferences.clearOtaData()
        Log.d("OtaManager", "Cleared stored OTA data from SharedPreferences")
    }

    // MARK: - Rollback API

    /**
     * Rolls back to the previous OTA bundle (or resets to original if count > 3 or no previous exists).
     * Blacklists the current version and logs rollback history.
     * Call reloadApp() after this to apply the change.
     * @return true if rollback was performed
     */
    fun rollbackToPreviousBundle(): Boolean {
        val previousPath = preferences.getPreviousUnzippedPath()
        val previousVersion = preferences.getPreviousVersion()
        val currentVersion = preferences.getOtaVersion()

        // Blacklist the current (bad) version
        if (!currentVersion.isNullOrEmpty()) {
            val blacklist = preferences.getBlacklistedVersions().toMutableList()
            if (!blacklist.contains(currentVersion)) {
                blacklist.add(currentVersion)
                preferences.setBlacklistedVersions(blacklist)
            }
        }

        // Increment rollback counter
        val count = preferences.getRollbackCount() + 1
        preferences.setRollbackCount(count)

        val effectiveReason = if (count > 3) "max_rollbacks_exceeded" else "manual"
        val hasPrevious = !previousPath.isNullOrEmpty()
        val toVersion = if (!hasPrevious || count > 3) "original" else (previousVersion ?: "unknown")

        // Append to rollback history
        val record = org.json.JSONObject().apply {
            put("timestamp", System.currentTimeMillis())
            put("fromVersion", currentVersion ?: "unknown")
            put("toVersion", toVersion)
            put("reason", effectiveReason)
        }
        preferences.appendRollbackHistory(record)

        // Clear pending validation since we are manually rolling back
        preferences.setPendingValidation(false)

        return if (count > 3 || !hasPrevious) {
            // Reset to original app bundle
            preferences.setOtaUnzippedPath("")
            preferences.setOtaVersion("")
            preferences.setRollbackCount(0)
            Log.w("OtaManager", "Rollback limit exceeded or no previous bundle — reset to original")
            true
        } else {
            // Promote previous bundle to current
            preferences.setOtaUnzippedPath(previousPath!!)
            preferences.setOtaVersion(previousVersion ?: "")
            preferences.setPreviousUnzippedPath("")
            preferences.setPreviousVersion("")
            Log.w("OtaManager", "Rolled back from $currentVersion to $previousVersion")
            true
        }
    }

    /**
     * Confirms the current bundle is working correctly.
     * Disables the crash-rollback guard for this bundle.
     */
    fun confirmBundle() {
        preferences.setPendingValidation(false)
        Log.d("OtaManager", "Bundle confirmed — crash guard disabled for this bundle")
    }

    /**
     * Returns a JSON-encoded array of blacklisted OTA version strings.
     */
    fun getBlacklistedVersions(): String {
        return preferences.getBlacklistedVersionsJson()
    }

    /**
     * Returns a JSON-encoded array of rollback history records.
     */
    fun getRollbackHistory(): String {
        return preferences.getRollbackHistoryJson()
    }

    /**
     * Blacklists the current bundle and triggers a rollback with a custom reason.
     * Call reloadApp() after this to apply.
     */
    fun markCurrentBundleAsBad(reason: String) {
        rollbackToPreviousBundle()
        // Update the reason in the last history entry to the user-provided reason
        val historyJson = preferences.getRollbackHistoryJson()
        try {
            val arr = org.json.JSONArray(historyJson)
            if (arr.length() > 0) {
                val last = arr.getJSONObject(arr.length() - 1)
                last.put("reason", reason)
                arr.put(arr.length() - 1, last)
                preferences.setRollbackHistory(arr.toString())
            }
        } catch (e: Exception) {
            Log.e("OtaManager", "Failed to update rollback reason in history", e)
        }
    }
}

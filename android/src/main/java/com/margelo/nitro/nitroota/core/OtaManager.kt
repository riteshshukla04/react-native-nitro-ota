package com.margelo.nitro.nitroota.core

import android.content.Context
import com.margelo.nitro.nitroota.network.DownloadManager
import com.margelo.nitro.nitroota.utils.PreferencesUtils
import com.margelo.nitro.nitroota.utils.UrlUtils
import com.margelo.nitro.nitroota.utils.ZipUtils
import java.io.File
import android.util.Log

private const val ANDROID_BUNDLE_NAME = "index.android.bundle"


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

            // Keep only the first 2 (most recent), delete the rest
            val dirsToDelete = sortedDirs.drop(2)
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
     * Finds the content folder inside the unzip directory and renames it to "bundles".
     * GitHub zips typically create a folder with the format "repo-name-branch".
     *
     * @param unzipDir The directory where files were unzipped
     * @return The renamed content folder, or null if not found
     */
    private fun findAndRenameContentFolder(unzipDir: File): File? {
        val files = unzipDir.listFiles()
        if (files != null) {
            for (file in files) {
                if (file.isDirectory) {
                    // Found a directory, rename it to "bundles"
                    val bundlesDir = File(unzipDir, "bundles")
                    val renamed = file.renameTo(bundlesDir)
                    if (renamed) {
                        Log.d("OtaManager", "Renamed content folder from '${file.name}' to 'bundles'")
                        return bundlesDir
                    } else {
                        Log.w("OtaManager", "Failed to rename folder '${file.name}' to 'bundles'")
                        return file // Return the original folder if rename failed
                    }
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

            // Find the actual content folder and rename it to "bundles"
            val contentFolder = findAndRenameContentFolder(unzipDir)
            if (contentFolder != null) {
                Log.d("OtaManager", "Using content folder: ${contentFolder.absolutePath}")

                // Read version from provided URL or fallback to ota.version file
                if (versionCheckUrl != null) {
                    try {
                        val otaVersion = downloadVersionFromUrl(versionCheckUrl)
                        Log.d("OtaManager", "Downloaded version from URL: $otaVersion")
                        preferences.setOtaVersion(otaVersion)
                        Log.d("OtaManager", "Stored OTA version in SharedPreferences: $otaVersion")
                    } catch (e: Exception) {
                        Log.w("OtaManager", "Failed to download version from URL: $versionCheckUrl", e)
                        // Fallback to local file
                        readVersionFromLocalFile(contentFolder)
                    }
                } else {
                    // No version check URL provided, try to read from local file
                    readVersionFromLocalFile(contentFolder)
                }

                // Store the content folder path in shared preferences
                preferences.setOtaUnzippedPath(contentFolder.absolutePath + "/" + ANDROID_BUNDLE_NAME)
                Log.d("OtaManager", "Stored content folder path in SharedPreferences: ${contentFolder.absolutePath}")

                // Store the Android bundle name in shared preferences
                preferences.setOtaBundleName(ANDROID_BUNDLE_NAME)
                Log.d("OtaManager", "Stored Android bundle name in SharedPreferences: $ANDROID_BUNDLE_NAME")

                // Clean up old OTA directories, keeping only the 2 most recent
                cleanupOldOtaDirectories()

                return contentFolder.absolutePath
            } else {
                Log.w("OtaManager", "No content folder found in unzip directory")
                // Fallback to unzip directory
                preferences.setOtaUnzippedPath(unzipDir.absolutePath)
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

                // Store the Android bundle name in shared preferences
                preferences.setOtaBundleName(ANDROID_BUNDLE_NAME)
                Log.d("OtaManager", "Stored Android bundle name in SharedPreferences: $ANDROID_BUNDLE_NAME")

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

        // Compare versions
        val hasUpdate = storedVersion != currentVersion

        Log.d("OtaManager", "Update available: $hasUpdate")

        return hasUpdate
    }

    /**
     * Reads the ota.version file from the local content folder.
     *
     * @param contentFolder The folder to read the version file from
     */
    private fun readVersionFromLocalFile(contentFolder: File) {
        // Read ota.version file from the content folder
        val otaVersionFile = File(contentFolder, "ota.version")
        if (otaVersionFile.exists() && otaVersionFile.isFile) {
            val otaVersion = otaVersionFile.readText().trim()
            Log.d("OtaManager", "Found ota.version file with content: $otaVersion")
            preferences.setOtaVersion(otaVersion)
            Log.d("OtaManager", "Stored OTA version in SharedPreferences: $otaVersion")
        } else {
            Log.w("OtaManager", "ota.version file not found in content folder: ${contentFolder.absolutePath}")
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
     * Clears the stored OTA data (path, version, download URL, and version check URL) from shared preferences.
     */
    fun clearStoredData() {
        preferences.clearOtaData()
        Log.d("OtaManager", "Cleared stored OTA data from SharedPreferences")
    }
}

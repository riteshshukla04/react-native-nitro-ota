package com.margelo.nitro.nitroota.utils

import android.content.Context
import android.content.SharedPreferences

class PreferencesUtils(private val sharedPreferences: SharedPreferences) {

    companion object {
        private const val OTA_UNZIPPED_PATH = "ota_unzipped_path"
        private const val OTA_VERSION = "ota_version"
        private const val OTA_REPO_URL = "ota_repo_url"
        private const val OTA_REPO_BRANCH = "ota_repo_branch"
        private const val OTA_BUNDLE_NAME = "ota_bundle_name"

        fun create(context: Context): PreferencesUtils {
            val sharedPreferences = context.getSharedPreferences("NitroOtaPrefs", Context.MODE_PRIVATE)
            return PreferencesUtils(sharedPreferences)
        }
    }

    /**
     * Stores the unzipped OTA path.
     */
    fun setOtaUnzippedPath(path: String) {
        sharedPreferences.edit().putString(OTA_UNZIPPED_PATH, path).apply()
    }

    /**
     * Gets the stored unzipped OTA path.
     */
    fun getOtaUnzippedPath(): String? {
        return sharedPreferences.getString(OTA_UNZIPPED_PATH, null)
    }

    /**
     * Stores the OTA version.
     */
    fun setOtaVersion(version: String) {
        sharedPreferences.edit().putString(OTA_VERSION, version).apply()
    }

    /**
     * Gets the stored OTA version.
     */
    fun getOtaVersion(): String? {
        return sharedPreferences.getString(OTA_VERSION, null)
    }

    /**
     * Stores the repository URL.
     */
    fun setOtaRepoUrl(url: String) {
        sharedPreferences.edit().putString(OTA_REPO_URL, url).apply()
    }

    /**
     * Gets the stored repository URL.
     */
    fun getOtaRepoUrl(): String? {
        return sharedPreferences.getString(OTA_REPO_URL, null)
    }

    /**
     * Stores the repository branch.
     */
    fun setOtaRepoBranch(branch: String) {
        sharedPreferences.edit().putString(OTA_REPO_BRANCH, branch).apply()
    }

    /**
     * Gets the stored repository branch.
     */
    fun getOtaRepoBranch(): String? {
        return sharedPreferences.getString(OTA_REPO_BRANCH, "master")
    }

    /**
     * Stores the Android bundle name.
     */
    fun setOtaBundleName(bundleName: String) {
        sharedPreferences.edit().putString(OTA_BUNDLE_NAME, bundleName).apply()
    }

    /**
     * Gets the stored Android bundle name.
     */
    fun getOtaBundleName(): String? {
        return sharedPreferences.getString(OTA_BUNDLE_NAME, null)
    }

    /**
     * Stores all OTA data at once (useful during download).
     */
    fun setOtaData(unzippedPath: String, version: String, repoUrl: String, repoBranch: String, bundleName: String? = null) {
        val editor = sharedPreferences.edit()
            .putString(OTA_UNZIPPED_PATH, unzippedPath)
            .putString(OTA_VERSION, version)
            .putString(OTA_REPO_URL, repoUrl)
            .putString(OTA_REPO_BRANCH, repoBranch)
        bundleName?.let { editor.putString(OTA_BUNDLE_NAME, it) }
        editor.apply()
    }

    /**
     * Clears all stored OTA data.
     */
    fun clearOtaData() {
        sharedPreferences.edit()
            .remove(OTA_UNZIPPED_PATH)
            .remove(OTA_VERSION)
            .remove(OTA_REPO_URL)
            .remove(OTA_REPO_BRANCH)
            .remove(OTA_BUNDLE_NAME)
            .apply()
    }

    /**
     * Checks if OTA data exists (has been downloaded before).
     */
    fun hasOtaData(): Boolean {
        return getOtaRepoUrl() != null
    }
}

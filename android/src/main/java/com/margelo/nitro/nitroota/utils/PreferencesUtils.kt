package com.margelo.nitro.nitroota.utils

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build

class PreferencesUtils(private val sharedPreferences: SharedPreferences, private val versionCode: Long) {

    companion object {
        private fun getAppVersionCode(context: Context): Long {
            return try {
                val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    packageInfo.longVersionCode
                } else {
                    @Suppress("DEPRECATION")
                    packageInfo.versionCode.toLong()
                }
            } catch (e: PackageManager.NameNotFoundException) {
                1L // Default fallback
            }
        }

        fun create(context: Context): PreferencesUtils {
            val sharedPreferences = context.getSharedPreferences("NitroOtaPrefs", Context.MODE_PRIVATE)
            val versionCode = getAppVersionCode(context)
            return PreferencesUtils(sharedPreferences, versionCode)
        }
    }

    private val OTA_UNZIPPED_PATH = "ota_unzipped_path_$versionCode"
    private val OTA_VERSION = "ota_version_$versionCode"
    private val OTA_UPDATE_DOWNLOAD_URL = "ota_update_download_url_$versionCode"
    private val OTA_UPDATE_VERSION_CHECK_URL = "ota_update_version_check_url_$versionCode"
    private val OTA_BUNDLE_NAME = "ota_bundle_name_$versionCode"

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
     * Stores the update download URL.
     */
    fun setUpdateDownloadUrl(url: String) {
        sharedPreferences.edit().putString(OTA_UPDATE_DOWNLOAD_URL, url).apply()
    }

    /**
     * Gets the stored update download URL.
     */
    fun getUpdateDownloadUrl(): String? {
        return sharedPreferences.getString(OTA_UPDATE_DOWNLOAD_URL, null)
    }

    /**
     * Stores the update version check URL.
     */
    fun setUpdateVersionCheckUrl(url: String) {
        sharedPreferences.edit().putString(OTA_UPDATE_VERSION_CHECK_URL, url).apply()
    }

    /**
     * Gets the stored update version check URL.
     */
    fun getUpdateVersionCheckUrl(): String? {
        return sharedPreferences.getString(OTA_UPDATE_VERSION_CHECK_URL, null)
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
    fun setOtaData(unzippedPath: String, version: String, downloadUrl: String, versionCheckUrl: String? = null, bundleName: String? = null) {
        val editor = sharedPreferences.edit()
            .putString(OTA_UNZIPPED_PATH, unzippedPath)
            .putString(OTA_VERSION, version)
            .putString(OTA_UPDATE_DOWNLOAD_URL, downloadUrl)
        versionCheckUrl?.let { editor.putString(OTA_UPDATE_VERSION_CHECK_URL, it) }
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
            .remove(OTA_UPDATE_DOWNLOAD_URL)
            .remove(OTA_UPDATE_VERSION_CHECK_URL)
            .remove(OTA_BUNDLE_NAME)
            .apply()
    }

    /**
     * Checks if OTA data exists (has been downloaded before).
     */
    fun hasOtaData(): Boolean {
        return getUpdateDownloadUrl() != null
    }
}

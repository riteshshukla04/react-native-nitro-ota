package com.margelo.nitro.nitroota

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.margelo.nitro.nitroota.core.OtaManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class BackgroundTaskWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "BackgroundTaskWorker"
        const val UNIQUE_WORK_NAME = "com.pikachu.NitroOta.backgroundOTA"
        const val DATA_KEY_VERSION_CHECK_URL = "version_check_url"
        const val DATA_KEY_DOWNLOAD_URL = "download_url"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "Background OTA check starting...")
        Log.d(TAG, "Input data keys: ${inputData.keyValueMap.keys}")
        
        try {
            val versionCheckUrl = inputData.getString(DATA_KEY_VERSION_CHECK_URL)
            val downloadUrl = inputData.getString(DATA_KEY_DOWNLOAD_URL)
            
            Log.d(TAG, "Retrieved from input data:")
            Log.d(TAG, "  - $DATA_KEY_VERSION_CHECK_URL = $versionCheckUrl")
            Log.d(TAG, "  - $DATA_KEY_DOWNLOAD_URL = $downloadUrl")
            
            if (versionCheckUrl.isNullOrEmpty()) {
                Log.e(TAG, "Version check URL is missing from input data")
                Log.e(TAG, "All input data: ${inputData.keyValueMap}")
                return@withContext Result.failure()
            }
            
            Log.d(TAG, "Version check URL: $versionCheckUrl")
            if (!downloadUrl.isNullOrEmpty()) {
                Log.d(TAG, "Download URL: $downloadUrl")
            }
            
            // Initialize OtaManager
            val otaManager = OtaManager(applicationContext)
            
            // Check for updates using native code
            Log.d(TAG, "Checking for updates...")
            val hasUpdate = otaManager.checkForUpdates(versionCheckUrl)
            
            if (hasUpdate) {
                Log.d(TAG, "Update available! Starting download...")
                
                // Use provided download URL or fall back to stored URL
                val urlToDownload = downloadUrl ?: versionCheckUrl
                
                try {
                    val unzippedPath = otaManager.downloadAndUnzipFromUrl(urlToDownload, versionCheckUrl)
                    Log.d(TAG, "Update downloaded and extracted successfully to: $unzippedPath")
                    Log.d(TAG, "App will use the new bundle on next restart")
                    return@withContext Result.success()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to download update", e)
                    return@withContext Result.failure()
                }
            } else {
                Log.d(TAG, "No update available, app is up to date")
                return@withContext Result.success()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error during background OTA check", e)
            return@withContext Result.failure()
        }
    }
}


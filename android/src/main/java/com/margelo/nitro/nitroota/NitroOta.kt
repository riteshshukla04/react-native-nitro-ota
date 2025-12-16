package com.margelo.nitro.nitroota

import android.util.Log
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Data
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.BackoffPolicy
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.NullType
import com.margelo.nitro.nitroota.core.OtaManager
import com.jakewharton.processphoenix.ProcessPhoenix
import java.util.concurrent.TimeUnit
import java.util.UUID

@DoNotStrip
class NitroOta : HybridNitroOtaSpec() {
    private val otaManager by lazy {
        val context = NitroModules.applicationContext ?: throw Error("Cannot get Android Context - No Context available!")
        OtaManager(context)
    }

  override fun checkForUpdates(url: String): Promise<Boolean> {
    return Promise.async {
      try {
        Log.d("NitroOta", "Checking for updates using version check URL: $url")
        val hasUpdate = otaManager.checkForUpdates(url)
        Log.d("NitroOta", "Update check result: $hasUpdate")
        return@async hasUpdate
      } catch (e: Exception) {
        Log.e("NitroOta", "Failed to check for updates", e)
        throw RuntimeException("Failed to check for updates: ${e.message}", e)
      }
    }
  }

  override fun getStoredOtaVersion(): Variant_NullType_String {
    val version = otaManager.getStoredOtaVersion()
    return if (version == null) {
      Variant_NullType_String.create(NullType.NULL)
    } else {
      Variant_NullType_String.create(version)
    }
  }

  override fun getStoredUnzippedPath(): Variant_NullType_String {
    val path = otaManager.getStoredUnzippedPath()
    return if (path == null) {
      Variant_NullType_String.create(NullType.NULL)
    } else {
      Variant_NullType_String.create(path)
    }
  }

  fun getStoredBundlePath(): String? {
    return otaManager.getStoredUnzippedPath()
  }

  override fun reloadApp(): Unit {
    ProcessPhoenix.triggerRebirth(NitroModules.applicationContext!!)
  }

  override fun downloadZipFromUrl(url: String): Promise<String> {
    return Promise.async {
      Log.d("NitroOta", "Starting download from URL: $url")
      val unzippedPath = otaManager.downloadAndUnzipFromUrl(url, null)
      Log.d("NitroOta", "Unzipped path: $unzippedPath")
      return@async unzippedPath
    }
  }
  override fun scheduleBackgroundOTACheck(versionCheckUrl: String, downloadUrl: Variant_NullType_String?, interval: Double): Unit {
    // Extract the actual download URL string from the Variant (null | string)
    val downloadUrlString = downloadUrl?.asSecondOrNull()
    
    Log.d("NitroOta", "Scheduling background OTA check with WorkManager")
    Log.d("NitroOta", "  - Version check URL: $versionCheckUrl")
    Log.d("NitroOta", "  - Download URL: ${downloadUrlString ?: "null (will use version check URL)"}")
    Log.d("NitroOta", "  - Interval: $interval seconds")
    
    val context = NitroModules.applicationContext 
        ?: throw Error("Cannot schedule background task - No Context available!")
    
    if (versionCheckUrl.isBlank()) {
        Log.e("NitroOta", "Cannot schedule background check: Version check URL is empty")
        throw IllegalArgumentException("Version check URL cannot be empty")
    }
    
    // Create input data with URLs passed from JavaScript (not from stored preferences)
    val inputData = Data.Builder()
        .putString(BackgroundTaskWorker.DATA_KEY_VERSION_CHECK_URL, versionCheckUrl)
        .apply {
            if (!downloadUrlString.isNullOrBlank()) {
                putString(BackgroundTaskWorker.DATA_KEY_DOWNLOAD_URL, downloadUrlString)
            }
        }
        .build()
    
    // Log the input data to verify it's being set correctly
    Log.d("NitroOta", "Input data created:")
    Log.d("NitroOta", "  - ${BackgroundTaskWorker.DATA_KEY_VERSION_CHECK_URL} = ${inputData.getString(BackgroundTaskWorker.DATA_KEY_VERSION_CHECK_URL)}")
    Log.d("NitroOta", "  - ${BackgroundTaskWorker.DATA_KEY_DOWNLOAD_URL} = ${inputData.getString(BackgroundTaskWorker.DATA_KEY_DOWNLOAD_URL)}")
    
    // Create constraints - require network since we need to check for updates
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
    
    // WorkManager requires minimum 15 minutes for periodic work
    val intervalMinutes = if (interval < 900) 15L else (interval / 60).toLong()
    
    // Create a periodic work request that runs repeatedly at the specified interval
    val workRequest = PeriodicWorkRequestBuilder<BackgroundTaskWorker>(
        intervalMinutes, TimeUnit.MINUTES
    )
        .setInputData(inputData)
        .setConstraints(constraints)
        .setBackoffCriteria(
            BackoffPolicy.EXPONENTIAL,
            10000L, // 10 seconds minimum backoff
            TimeUnit.MILLISECONDS
        )
        .build()
    
    // Use enqueueUniquePeriodicWork with REPLACE policy to prevent multiple schedules
    // This ensures that even if called multiple times (e.g., in useEffect), 
    // only one background task will be scheduled at a time
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        BackgroundTaskWorker.UNIQUE_WORK_NAME,
        ExistingPeriodicWorkPolicy.REPLACE, // Replace any existing scheduled work
        workRequest
    )
    
    Log.d("NitroOta", "Background OTA check scheduled successfully")
    Log.d("NitroOta", "  - Unique work name: ${BackgroundTaskWorker.UNIQUE_WORK_NAME}")
    Log.d("NitroOta", "  - Interval: $intervalMinutes minutes (minimum 15 minutes required by WorkManager)")
    Log.d("NitroOta", "  - Policy: REPLACE (will cancel any existing scheduled work)")
    Log.d("NitroOta", "  - Safe to call multiple times (e.g., in useEffect)")
    Log.d("NitroOta", "  - Will check for updates PERIODICALLY and download automatically using native code")
    Log.d("NitroOta", "  - Works even when app is closed!")
    Log.d("NitroOta", "  - Using URLs provided from JavaScript (not stored preferences)")
  }
}

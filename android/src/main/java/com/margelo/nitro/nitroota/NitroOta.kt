package com.margelo.nitro.nitroota

import android.util.Log
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Data
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
      Variant_NullType_String.create(NullType.instance())
    } else {
      Variant_NullType_String.create(version)
    }
  }

  override fun getStoredUnzippedPath(): Variant_NullType_String {
    val path = otaManager.getStoredUnzippedPath()
    return if (path == null) {
      Variant_NullType_String.create(NullType.instance())
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
  override fun scheduleJSInBackground(callback: () -> Promise<Promise<Unit>>, interval: Double): Unit {
    Log.d("NitroOta", "Scheduling background task with WorkManager, interval: $interval seconds")
    
    val context = NitroModules.applicationContext 
        ?: throw Error("Cannot schedule background task - No Context available!")
    
    // Generate unique work ID
    val workId = UUID.randomUUID().toString()
    
    // Register the async callback with the Worker
    BackgroundTaskWorker.registerCallback(workId, callback)
    
    // Create input data with the work ID
    val inputData = Data.Builder()
        .putString("work_id", workId)
        .build()
    
    // Create a one-time work request with initial delay
    val workRequest = OneTimeWorkRequestBuilder<BackgroundTaskWorker>()
        .setInitialDelay(interval.toLong(), TimeUnit.SECONDS)
        .setInputData(inputData)
        .addTag(BackgroundTaskWorker.TASK_ID)
        .addTag(workId)
        .build()
    
    // Schedule the work with WorkManager
    WorkManager.getInstance(context).enqueue(workRequest)
    
    Log.d("NitroOta", "Background task scheduled (Task ID: ${BackgroundTaskWorker.TASK_ID}, Work ID: $workId)")
  }
}

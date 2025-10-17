package com.margelo.nitro.nitroota

import android.util.Log
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.nitroota.core.OtaManager

@DoNotStrip
class NitroOta : HybridNitroOtaSpec() {
    private val otaManager by lazy {
        val context = NitroModules.applicationContext ?: throw Error("Cannot get Android Context - No Context available!")
        OtaManager(context)
    }

  override fun checkForUpdates(url: String, branch: String?): Promise<Boolean> {
    return Promise.async {
      try {
        Log.d("NitroOta", "Checking for updates for URL: $url, branch: ${branch ?: "master"}")
        val hasUpdate = otaManager.checkForUpdates(url, branch ?: "master")
        Log.d("NitroOta", "Update check result: $hasUpdate")
        return@async hasUpdate
      } catch (e: Exception) {
        Log.e("NitroOta", "Failed to check for updates", e)
        throw RuntimeException("Failed to check for updates: ${e.message}", e)
      }
    }
  }

  override fun getStoredOtaVersion(): String? {
    return otaManager.getStoredOtaVersion()
  }

  override fun getStoredUnzippedPath(): String? {
    return otaManager.getStoredUnzippedPath()
  }

  fun getStoredBundlePath(): String? {
    return otaManager.getStoredUnzippedPath()
  }

  override fun downloadZipFromGitHub(url: String, branch: String?): Promise<String> {
    val promise = Promise<String>()

    // Run the download and unzip on a background thread
    Thread {
      try {
        Log.d("NitroOta", "Starting download from URL: $url with branch: ${branch ?: "master"}")
        val unzippedPath = otaManager.downloadAndUnzipFromGitHub(url, branch ?: "master")

        Log.d("NitroOta", "Unzipped path: $unzippedPath")
        promise.resolve(unzippedPath)
      } catch (e: Exception) {
        Log.e("NitroOta", "Failed to download and unzip from GitHub", e)
        promise.reject(RuntimeException("Failed to download and unzip from GitHub: ${e.message}", e))
      }
    }.start()

    return promise
  }

}

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

  override fun getStoredOtaVersion(): String? {
    return otaManager.getStoredOtaVersion()
  }

  override fun getStoredUnzippedPath(): String? {
    return otaManager.getStoredUnzippedPath()
  }

  fun getStoredBundlePath(): String? {
    return otaManager.getStoredUnzippedPath()
  }

  override fun downloadZipFromUrl(url: String): Promise<String> {
    return Promise.async {
      Log.d("NitroOta", "Starting download from URL: $url")
      val unzippedPath = otaManager.downloadAndUnzipFromUrl(url, null)
      Log.d("NitroOta", "Unzipped path: $unzippedPath")
      return@async unzippedPath
    }
  }
}

package com.margelo.nitro.nitroota.core

import android.content.Context
import com.margelo.nitro.nitroota.utils.CrashHandler
import com.margelo.nitro.nitroota.utils.PreferencesUtils

/**
 * Returns the stored bundle path from shared preferences.
 * This method retrieves the full path to the OTA bundle file directly from preferences.
 *
 * Also installs the crash handler on every app start (idempotent).
 * The crash handler is only active if the current bundle is pending validation.
 *
 * @param context The application context
 * @return The bundle path if available, null otherwise
 */
fun getStoredBundlePath(context: Context): String? {
    // Install crash handler before returning the bundle path.
    // This ensures crash protection is active before the JS bundle is executed.
    CrashHandler.install(context)

    val preferences = PreferencesUtils.create(context)
    val path = preferences.getOtaUnzippedPath()

    // An empty string means the OTA was reset to original after too many rollbacks.
    // Return null so React Native falls back to the bundled .bundle file.
    return if (path.isNullOrEmpty()) null else path
}

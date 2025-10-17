package com.margelo.nitro.nitroota.core

import android.content.Context
import com.margelo.nitro.nitroota.utils.PreferencesUtils

/**
 * Returns the stored bundle path from shared preferences.
 * This method retrieves the full path to the OTA bundle file directly from preferences.
 *
 * @param context The application context
 * @return The bundle path if available, null otherwise
 */
fun getStoredBundlePath(context: Context): String? {
    val preferences = PreferencesUtils.create(context)
    return preferences.getOtaUnzippedPath()
}

package com.margelo.nitro.nitroota.utils

import android.content.Context
import android.util.Log
import org.json.JSONObject

/**
 * CrashHandler installs a Thread.UncaughtExceptionHandler that automatically
 * rolls back a new OTA bundle if the app crashes before the bundle is confirmed.
 *
 * Uses the "pending confirmation" pattern — the crash handler is ONLY active when
 * [PreferencesUtils.isPendingValidation] is true (i.e., a new bundle was downloaded
 * but [confirmBundle] has not yet been called).
 *
 * This means normal app crashes in a confirmed bundle will NOT trigger a rollback.
 *
 * Installed automatically from [BundleManager.getStoredBundlePath], which runs
 * in MainApplication.getJSBundleFile() — before any JS bundle is executed.
 */
class CrashHandler private constructor(private val context: Context) {

    companion object {
        private const val TAG = "NitroOtaCrashHandler"

        @Volatile
        private var installed = false

        /**
         * Installs the crash handler. Safe to call multiple times (idempotent).
         * Must be called before the JS bundle is loaded.
         */
        fun install(context: Context) {
            if (installed) return
            installed = true
            CrashHandler(context.applicationContext).doInstall()
        }
    }

    private val previousDefaultHandler: Thread.UncaughtExceptionHandler? =
        Thread.getDefaultUncaughtExceptionHandler()

    private fun doInstall() {
        val prefs = PreferencesUtils.create(context)

        if (!prefs.isPendingValidation()) {
            // Current bundle is confirmed good — no crash guard needed.
            // Normal app crashes will NOT trigger a rollback.
            Log.d(TAG, "Bundle is confirmed, crash guard not needed")
            return
        }

        Log.d(TAG, "Bundle is pending validation, installing crash guard")

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            // Re-read the flag in case confirmBundle() was called before the crash
            if (prefs.isPendingValidation()) {
                Log.w(TAG, "Crash detected while bundle is pending validation — rolling back", throwable)
                performCrashRollback(prefs)
            } else {
                Log.d(TAG, "Crash detected but bundle was already confirmed — no rollback")
            }
            // Always forward to the previous handler (system default, Crashlytics, Sentry, etc.)
            previousDefaultHandler?.uncaughtException(thread, throwable)
        }
    }

    private fun performCrashRollback(prefs: PreferencesUtils) {
        try {
            val currentVersion = prefs.getOtaVersion()
            val previousPath = prefs.getPreviousUnzippedPath()
            val previousVersion = prefs.getPreviousVersion()

            // --- Blacklist the bad version so it is never re-downloaded ---
            if (!currentVersion.isNullOrEmpty()) {
                val blacklist = prefs.getBlacklistedVersions().toMutableList()
                if (!blacklist.contains(currentVersion)) {
                    blacklist.add(currentVersion)
                    prefs.setBlacklistedVersions(blacklist)
                }
            }

            // --- Increment rollback counter ---
            val count = prefs.getRollbackCount() + 1
            prefs.setRollbackCount(count)

            val effectiveReason = if (count > 3) "max_rollbacks_exceeded" else "crash_detected"
            val hasPrevious = !previousPath.isNullOrEmpty()
            val toVersion = if (!hasPrevious || count > 3) "original" else (previousVersion ?: "unknown")

            // --- Append to rollback history ---
            val record = JSONObject().apply {
                put("timestamp", System.currentTimeMillis())
                put("fromVersion", currentVersion ?: "unknown")
                put("toVersion", toVersion)
                put("reason", effectiveReason)
            }
            // Use synchronous commit() so data is flushed before the process dies
            prefs.appendRollbackHistorySync(record)

            // --- Swap bundles or reset to original ---
            if (count > 3 || !hasPrevious) {
                // Too many rollbacks or no fallback: reset to original app bundle
                prefs.setOtaUnzippedPath("")
                prefs.setOtaVersion("")
                prefs.setRollbackCount(0)
                Log.w(TAG, "Rollback limit exceeded or no previous bundle — resetting to original bundle")
            } else {
                // Promote previous bundle to current
                prefs.setOtaUnzippedPath(previousPath!!)
                prefs.setOtaVersion(previousVersion ?: "")
                prefs.setPreviousUnzippedPath("")
                prefs.setPreviousVersion("")
                Log.w(TAG, "Rolled back from $currentVersion to $previousVersion")
            }

            // --- Clear pending validation flag (synchronous) ---
            prefs.setPendingValidationSync(false)

        } catch (e: Exception) {
            Log.e(TAG, "Error during crash rollback — this should not happen", e)
        }
    }
}

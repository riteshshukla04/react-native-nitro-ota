import Foundation
import NitroModules

/**
 * Returns the stored bundle path from user defaults.
 * This method retrieves the full path to the OTA bundle file directly from user defaults.
 *
 * @param context The application context (not needed in iOS)
 * @return The bundle path if available, null otherwise
 */
func getStoredBundlePath() -> String? {
    let preferences = PreferencesUtils()
    return preferences.getOtaUnzippedPath()
}

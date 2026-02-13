import type { HybridObject } from 'react-native-nitro-modules';

export interface NitroOta extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  checkForUpdates(versionCheckUrl: string): Promise<boolean>;
  downloadZipFromUrl(downloadUrl: string): Promise<string>;
  getStoredOtaVersion(): string | null;
  getStoredUnzippedPath(): string | null;
  reloadApp(): void;

  /**
   * Schedule a background OTA check that runs natively (no JavaScript callbacks needed).
   *
   * @param versionCheckUrl - URL to check for version updates
   * @param downloadUrl - URL to download the update from (optional, defaults to versionCheckUrl)
   * @param interval - Delay in seconds before the check runs
   *
   * Note:
   * - Android: Uses WorkManager, works even when app is closed
   * - iOS: Uses background tasks, behavior depends on iOS version and permissions
   * - Safe to call multiple times (replaces existing scheduled tasks)
   */
  scheduleBackgroundOTACheck(
    versionCheckUrl: string,
    downloadUrl: string | null,
    interval: number
  ): void;

  /**
   * Rollback to the previous OTA bundle.
   * Blacklists the current (bad) bundle version so it is never downloaded again.
   * Increments the consecutive rollback counter. If the counter exceeds 3,
   * all OTA data is cleared and the original app bundle will be used.
   * Call reloadApp() after this to apply the change.
   * @returns true if rollback succeeded (previous bundle activated or reset to original)
   */
  rollbackToPreviousBundle(): Promise<boolean>;

  /**
   * Confirm that the current OTA bundle is working correctly.
   * Call this after verifying critical app flows work on the new bundle.
   * This disables the automatic crash-rollback guard for this bundle.
   * If not called and the app crashes, the crash handler will auto-rollback.
   */
  confirmBundle(): void;

  /**
   * Returns a JSON-encoded array of blacklisted OTA version strings.
   * Blacklisted versions will never be downloaded again.
   * Example: '["1.2.3", "1.2.4"]'
   */
  getBlacklistedVersions(): Promise<string>;

  /**
   * Returns a JSON-encoded array of rollback history records.
   * Each record: { timestamp: number, fromVersion: string, toVersion: string, reason: string }
   * reason values: "crash_detected" | "manual" | "max_rollbacks_exceeded"
   */
  getRollbackHistory(): Promise<string>;

  /**
   * Manually marks the current bundle as bad, blacklists it, and triggers a rollback.
   * Call reloadApp() after this to apply the rollback.
   * @param reason - A description of why the bundle is being marked as bad
   */
  markCurrentBundleAsBad(reason: string): Promise<void>;
}

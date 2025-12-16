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
  scheduleBackgroundOTACheck(versionCheckUrl: string, downloadUrl: string | null, interval: number): void;
}

import { NitroModules } from 'react-native-nitro-modules';
import type { NitroOta } from './NitroOta.nitro';
import {
  checkOTAVersion,
  hasCompatibleUpdate,
  type OTAVersionCheckResult,
} from './otaVersionChecker';

const NitroOtaHybridObject =
  NitroModules.createHybridObject<NitroOta>('NitroOta');

/**
 * Target versions for OTA updates
 */
export interface OTATargetVersions {
  /** List of Android app versions this OTA can be safely installed on. Leave empty to target all versions */
  android?: string[];
  /** List of iOS app versions this OTA can be safely installed on. Leave empty to target all versions */
  ios?: string[];
}

/**
 * OTA version configuration structure for ota.version.json
 */
export interface OTAVersionConfig {
  /** The OTA version identifier */
  version: string;
  /** Target app versions for different platforms */
  targetVersions?: OTATargetVersions;
  /** Whether the version follows semantic versioning (x.y.z format). Defaults to false */
  isSemver?: boolean;
  /** Optional release notes for this OTA update */
  releaseNotes?: string;
}

export function checkForOTAUpdates(versionCheckUrl: string): Promise<boolean> {
  console.log('checkForUpdates', versionCheckUrl);
  return NitroOtaHybridObject.checkForUpdates(versionCheckUrl);
}

export function downloadZipFromUrl(downloadUrl: string): Promise<string> {
  console.log('downloadZipFromUrl', downloadUrl);
  return NitroOtaHybridObject.downloadZipFromUrl(downloadUrl);
}

export function getStoredOtaVersion(): string | null {
  return NitroOtaHybridObject.getStoredOtaVersion();
}

export function getStoredUnzippedPath(): string | null {
  return NitroOtaHybridObject.getStoredUnzippedPath();
}

export function reloadApp(): void {
  NitroOtaHybridObject.reloadApp();
}

/**
 * Gets the current app version from the native bundle
 * Note: This requires react-native-device-info or similar package to be installed
 * If not available, returns a default version
 */
export function getAppVersion(): string {
  try {
    // Try to get from react-native-device-info if available
    const DeviceInfo = require('react-native-device-info');
    return DeviceInfo.getVersion();
  } catch {
    console.warn(
      'OTA: react-native-device-info not found. Using default app version. Install react-native-device-info for accurate version checking.'
    );
    // Return a default version if DeviceInfo is not available
    return '1.0.0';
  }
}

/**
 * Checks for OTA updates with enhanced version comparison
 * Supports both plain text (ota.version) and JSON (ota.version.json) formats
 *
 * @param versionCheckUrl - URL to check for version information
 * @param appVersion - Optional app version (auto-detected if not provided)
 * @returns OTAVersionCheckResult with detailed update information
 */
export async function checkForOTAUpdatesJS(
  versionCheckUrl?: string,
  appVersion?: string
): Promise<OTAVersionCheckResult | null> {
  if (!versionCheckUrl) {
    return null;
  }

  const currentOtaVersion = getStoredOtaVersion();
  const currentAppVersion = appVersion || getAppVersion();

  try {
    const result = await checkOTAVersion(
      versionCheckUrl,
      currentOtaVersion,
      currentAppVersion
    );

    return result;
  } catch (error) {
    console.error('OTA: Error checking for updates:', error);
    throw error;
  }
}

/**
 * Simple check for compatible OTA updates (backward compatible API)
 * @param versionCheckUrl - URL to check for version information
 * @param appVersion - Optional app version (auto-detected if not provided)
 * @returns true if a compatible update is available, false otherwise
 */
export async function hasOTAUpdate(
  versionCheckUrl?: string,
  appVersion?: string
): Promise<boolean> {
  if (!versionCheckUrl) {
    return false;
  }

  const currentOtaVersion = getStoredOtaVersion();
  const currentAppVersion = appVersion || getAppVersion();

  try {
    return await hasCompatibleUpdate(
      versionCheckUrl,
      currentOtaVersion,
      currentAppVersion
    );
  } catch (error) {
    console.error('OTA: Error checking for compatible updates:', error);
    return false;
  }
}

/**
 * OTA Update Manager class for handling over-the-air updates
 */
export class OTAUpdateManager {
  private downloadUrl: string;
  private versionCheckUrl?: string;

  constructor(downloadUrl: string, versionCheckUrl?: string) {
    this.downloadUrl = downloadUrl;
    this.versionCheckUrl = versionCheckUrl;
  }

  /**
   * Checks if there are any updates available by comparing versions
   */
  async checkForUpdates(): Promise<boolean> {
    try {
      const urlToCheck = this.versionCheckUrl || this.downloadUrl;
      console.log(
        `OTA: Checking for updates using version check URL: ${urlToCheck}`
      );
      return await checkForOTAUpdates(urlToCheck);
    } catch (error) {
      console.error('OTA: Failed to check for updates:', error);
      throw error;
    }
  }
  /**
   * Checks for updates using JS implementation with detailed version comparison
   * @param appVersion - Optional app version (auto-detected if not provided)
   * @returns Detailed version check result
   */
  async checkForUpdatesJS(
    appVersion?: string
  ): Promise<OTAVersionCheckResult | null> {
    return await checkForOTAUpdatesJS(this.versionCheckUrl, appVersion);
  }

  /**
   * Simple check for compatible updates (backward compatible)
   * @param appVersion - Optional app version (auto-detected if not provided)
   * @returns true if a compatible update is available
   */
  async hasCompatibleUpdate(appVersion?: string): Promise<boolean> {
    return await hasOTAUpdate(this.versionCheckUrl, appVersion);
  }

  /**
   * Downloads and extracts the OTA update
   */
  async downloadUpdate(): Promise<string> {
    try {
      console.log(`OTA: Downloading update from ${this.downloadUrl}`);
      const path = await downloadZipFromUrl(this.downloadUrl);
      console.log(`OTA: Update downloaded to: ${path}`);
      return path;
    } catch (error) {
      console.error('OTA: Failed to download update:', error);
      throw error;
    }
  }

  /**
   * Gets the current stored OTA version
   */
  getVersion(): string | null {
    const version = getStoredOtaVersion();
    console.log(`OTA: Current version: ${version}`);
    return version;
  }

  /**
   * Gets the stored unzipped path
   */
  getUnzippedPath(): string | null {
    const path = getStoredUnzippedPath();
    console.log(`OTA: Unzipped path: ${path}`);
    return path;
  }

  /**
   * Reloads the app
   */
  reloadApp(): void {
    NitroOtaHybridObject.reloadApp();
  }

  /**
   * Schedule a background OTA check that runs natively (no JavaScript callbacks needed).
   *
   * @param interval - Delay in seconds before the check runs
   *
   * Note:
   * - Android: Uses WorkManager, works even when app is closed
   * - iOS: Uses background tasks, behavior depends on iOS version and permissions
   * - Safe to call multiple times (replaces existing scheduled tasks)
   * - URLs are passed from JavaScript (doesn't rely on stored preferences)
   *
   * @example
   * ```typescript
   * const manager = new OTAUpdateManager(downloadUrl, versionCheckUrl);
   * manager.scheduleBackgroundCheck(3600); // Check every hour
   * ```
   */
  scheduleBackgroundCheck(interval: number): void {
    if (!this.versionCheckUrl) {
      throw new Error(
        'Version check URL is required to schedule background checks'
      );
    }

    NitroOtaHybridObject.scheduleBackgroundOTACheck(
      this.versionCheckUrl,
      this.downloadUrl,
      interval
    );
  }
}

export { githubOTA } from './githubUtils';
export type { OTAVersionCheckResult } from './otaVersionChecker';
export {
  checkOTAVersion,
  hasCompatibleUpdate as checkCompatibleUpdate,
} from './otaVersionChecker';

import { NitroModules } from 'react-native-nitro-modules';
import type { NitroOta } from './NitroOta.nitro';
import {
  checkOTAVersion,
  hasCompatibleUpdate,
  type OTAVersionCheckResult,
} from './otaVersionChecker';

const NitroOtaHybridObject =
  NitroModules.createHybridObject<NitroOta>('NitroOta');

// ---------------------------------------------------------------------------
// onRollback listener infrastructure
// ---------------------------------------------------------------------------
type RollbackCallback = (record: RollbackHistoryRecord) => void;
const rollbackListeners = new Set<RollbackCallback>();
// Cache of crash rollbacks detected from the previous session (loaded once).
let _crashRollbacksFromPreviousSession: RollbackHistoryRecord[] | null = null;

function _notifyRollback(record: RollbackHistoryRecord) {
  rollbackListeners.forEach((cb) => cb(record));
}

async function _loadCrashRollbacksOnce(): Promise<RollbackHistoryRecord[]> {
  if (_crashRollbacksFromPreviousSession !== null) {
    return _crashRollbacksFromPreviousSession;
  }
  try {
    const history = await getRollbackHistory();
    // Only entries beyond the last acknowledged index are "new".
    // This prevents re-firing the same crash rollback on every subsequent launch.
    const notifiedCount = NitroOtaHybridObject.getNotifiedRollbackCount();
    const newEntries = history.slice(notifiedCount).filter(
      (r) => r.reason === 'crash_detected'
    );
    _crashRollbacksFromPreviousSession = newEntries;
    if (newEntries.length > 0) {
      // Acknowledge immediately so the next session won't re-report these.
      NitroOtaHybridObject.acknowledgeRollbackHistory();
    }
  } catch {
    _crashRollbacksFromPreviousSession = [];
  }
  return _crashRollbacksFromPreviousSession;
}

/**
 * A single rollback history record.
 * Stored on-device every time a rollback is performed (crash or manual).
 */
export interface RollbackHistoryRecord {
  /** Unix timestamp in milliseconds when the rollback occurred */
  timestamp: number;
  /** The OTA version that was active before the rollback */
  fromVersion: string;
  /**
   * The version that was restored.
   * "original" means the original app bundle (no OTA).
   */
  toVersion: string;
  /**
   * Why the rollback happened.
   * "crash_detected" — automatic crash handler triggered rollback
   * "manual"         — user called rollbackToPreviousBundle()
   * "max_rollbacks_exceeded" — rollback counter > 3; reset to original bundle
   * Any other string — custom reason passed to markCurrentBundleAsBad()
   */
  reason: 'crash_detected' | 'manual' | 'max_rollbacks_exceeded' | string;
}

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

export function downloadZipFromUrl(
  downloadUrl: string,
  onProgress?: (received: number, total: number) => void
): Promise<string> {
  console.log('downloadZipFromUrl', downloadUrl);
  return NitroOtaHybridObject.downloadZipFromUrl(downloadUrl, onProgress ?? null);
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
 * Rollback to the previous OTA bundle.
 *
 * Blacklists the current (bad) version so it is never re-downloaded.
 * Increments the consecutive rollback counter. If the counter exceeds 3,
 * all OTA data is cleared and the original app bundle will be used on next launch.
 * Call reloadApp() after this to apply the change.
 *
 * @returns true if rollback succeeded (previous bundle activated or reset to original)
 */
export async function rollbackToPreviousBundle(): Promise<boolean> {
  const success = await NitroOtaHybridObject.rollbackToPreviousBundle();
  if (success) {
    // Notify listeners with the persisted history entry. Guard separately so
    // a listener failure never masks the rollback result.
    try {
      const history = await getRollbackHistory();
      const lastRecord = history[history.length - 1];
      if (lastRecord) {
        _notifyRollback(lastRecord);
      }
    } catch {
      // Notification is best-effort — do not re-throw.
    }
  }
  return success;
}

/**
 * Confirm that the current OTA bundle is working correctly.
 *
 * Call this after verifying that critical app flows work on the new bundle
 * (e.g., after a successful login or key screen load). Once confirmed, the
 * automatic crash-rollback guard is disabled for this bundle — future crashes
 * will not trigger a rollback.
 *
 * If you never call this after a new bundle is applied, the crash handler will
 * roll back the bundle if the app crashes on the next launch.
 */
export function confirmBundle(): void {
  NitroOtaHybridObject.confirmBundle();
}

/**
 * Returns the list of blacklisted OTA version strings.
 * Blacklisted versions will never be downloaded again.
 */
export async function getBlacklistedVersions(): Promise<string[]> {
  const json = await NitroOtaHybridObject.getBlacklistedVersions();
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

/**
 * Returns the rollback history.
 * Each entry records one rollback event (crash or manual).
 */
export async function getRollbackHistory(): Promise<RollbackHistoryRecord[]> {
  const json = await NitroOtaHybridObject.getRollbackHistory();
  try {
    return JSON.parse(json) as RollbackHistoryRecord[];
  } catch {
    return [];
  }
}

/**
 * Manually marks the current bundle as bad, blacklists it, and triggers a rollback.
 * Call reloadApp() after this to apply.
 * @param reason - A description of why the bundle is being marked as bad
 */
export async function markCurrentBundleAsBad(reason: string): Promise<void> {
  await NitroOtaHybridObject.markCurrentBundleAsBad(reason);
  // Notify listeners with the last history entry (written natively).
  // Guard separately so a listener failure never masks the original call.
  try {
    const history = await getRollbackHistory();
    const lastRecord = history[history.length - 1];
    if (lastRecord) {
      _notifyRollback(lastRecord);
    }
  } catch {
    // Notification is best-effort — do not re-throw.
  }
}

/**
 * Subscribe to rollback events.
 *
 * The callback is fired in two situations:
 *  1. **Crash rollback from the previous session** — if the crash handler
 *     rolled back the bundle before JS started (detected on first call by
 *     inspecting the persisted rollback history).
 *  2. **Manual rollback in the current session** — when
 *     `rollbackToPreviousBundle()` or `markCurrentBundleAsBad()` is called
 *     and succeeds.
 *
 * @param callback - Receives the `RollbackHistoryRecord` describing the rollback.
 * @returns An unsubscribe function. Call it to remove the listener.
 *
 * @example
 * ```typescript
 * const unsubscribe = onRollback((record) => {
 *   console.log('Rollback!', record.reason, record.fromVersion, '→', record.toVersion);
 * });
 * // Later:
 * unsubscribe();
 * ```
 */
export function onRollback(callback: RollbackCallback): () => void {
  rollbackListeners.add(callback);

  // Fire any crash rollbacks from the previous session immediately.
  _loadCrashRollbacksOnce().then((records) => {
    records.forEach((r) => callback(r));
  });

  return () => {
    rollbackListeners.delete(callback);
  };
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
   * Downloads and extracts the OTA update.
   * @param onProgress - Optional callback invoked with (bytesReceived, totalBytes)
   *   during the download. `totalBytes` is -1 if the server does not send Content-Length.
   */
  async downloadUpdate(
    onProgress?: (received: number, total: number) => void
  ): Promise<string> {
    try {
      console.log(`OTA: Downloading update from ${this.downloadUrl}`);
      const path = await downloadZipFromUrl(this.downloadUrl, onProgress);
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
   * Rollback to the previous OTA bundle.
   * Blacklists the current version so it is not re-downloaded.
   * Call reloadApp() after this to apply the change.
   * @returns true if rollback was applied
   */
  async rollback(): Promise<boolean> {
    const success = await rollbackToPreviousBundle();
    if (success) {
      console.log('OTA: Rollback successful. Call reloadApp() to apply.');
    }
    return success;
  }

  /**
   * Confirm the current OTA bundle is working correctly.
   * Disables the automatic crash-rollback guard for this bundle.
   * Call this after verifying critical flows work on the new bundle.
   */
  confirm(): void {
    confirmBundle();
    console.log('OTA: Bundle confirmed as working.');
  }

  /**
   * Returns the list of blacklisted OTA version strings.
   */
  async getBlacklist(): Promise<string[]> {
    return getBlacklistedVersions();
  }

  /**
   * Returns the rollback history.
   */
  async getHistory(): Promise<RollbackHistoryRecord[]> {
    return getRollbackHistory();
  }

  /**
   * Manually marks the current bundle as bad, blacklists it, and triggers a rollback.
   * Call reloadApp() after this to apply.
   * @param reason - Why the bundle is being marked as bad (default: 'manual')
   */
  async markAsBad(reason: string = 'manual'): Promise<void> {
    await markCurrentBundleAsBad(reason);
    console.log('OTA: Bundle marked as bad. Call reloadApp() to apply rollback.');
  }

  /**
   * Subscribe to rollback events for this manager's bundle.
   *
   * Fires when:
   * - A crash rollback happened in the previous session (detected on registration).
   * - `rollback()` or `markAsBad()` is called in the current session.
   *
   * @param callback - Receives the `RollbackHistoryRecord` of the rollback event.
   * @returns An unsubscribe function.
   */
  onRollback(callback: (record: RollbackHistoryRecord) => void): () => void {
    return onRollback(callback);
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

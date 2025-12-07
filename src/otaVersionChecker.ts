import { Platform } from 'react-native';
import type { OTAVersionConfig } from './index';

/**
 * Represents a semantic version (major.minor.patch)
 */
interface SemverVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parses a semantic version string into components
 * @param version - Version string in format "x.y.z"
 * @returns Parsed version object or null if invalid
 */
function parseSemver(version: string): SemverVersion | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compares two semantic versions
 * @param v1 - First version string
 * @param v2 - Second version string
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2, null if either version is invalid
 */
function compareSemver(v1: string, v2: string): number | null {
  const version1 = parseSemver(v1);
  const version2 = parseSemver(v2);

  if (!version1 || !version2) {
    return null;
  }

  if (version1.major !== version2.major) {
    return version1.major > version2.major ? 1 : -1;
  }

  if (version1.minor !== version2.minor) {
    return version1.minor > version2.minor ? 1 : -1;
  }

  if (version1.patch !== version2.patch) {
    return version1.patch > version2.patch ? 1 : -1;
  }

  return 0;
}

/**
 * Checks if the current app version is in the target versions list
 * @param targetVersions - Target versions object with android/ios arrays
 * @param currentAppVersion - Current app version
 * @returns true if current version is targeted or no target versions specified, false otherwise
 */
function isVersionTargeted(
  targetVersions: OTAVersionConfig['targetVersions'],
  currentAppVersion: string
): boolean {
  if (!targetVersions) {
    // No target versions specified means all versions are targeted
    return true;
  }

  const platform = Platform.OS as 'ios' | 'android';
  const targetList = targetVersions[platform];

  if (!targetList || targetList.length === 0) {
    // No target versions for this platform means all versions are targeted
    return true;
  }

  // Check if current version is in the target list
  return targetList.includes(currentAppVersion);
}

/**
 * Result of an OTA version check
 */
export interface OTAVersionCheckResult {
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Whether the update is compatible with the current app version */
  isCompatible: boolean;
  /** The remote OTA version */
  remoteVersion: string;
  /** The currently installed OTA version (if any) */
  currentVersion: string | null;
  /** Additional metadata from the version config */
  metadata?: {
    isSemver?: boolean;
    releaseNotes?: string;
    targetVersions?: OTAVersionConfig['targetVersions'];
  };
}

/**
 * Checks for OTA updates by comparing versions
 * @param versionCheckUrl - URL to check for version information
 * @param currentOtaVersion - Currently installed OTA version (if any)
 * @param currentAppVersion - Current app version
 * @returns Version check result with update availability and compatibility info
 */
export async function checkOTAVersion(
  versionCheckUrl: string,
  currentOtaVersion: string | null,
  currentAppVersion: string
): Promise<OTAVersionCheckResult> {
  const response = await fetch(versionCheckUrl);
  const contentType = response.headers.get('content-type');

  let remoteVersion: string;
  let versionConfig: OTAVersionConfig | null = null;

  // Check if response is JSON
  if (contentType && contentType.includes('application/json')) {
    const jsonData = await response.json();
    if (!jsonData || typeof jsonData !== 'object' || !jsonData.version) {
      throw new Error('Invalid JSON response: missing version field');
    }
    versionConfig = jsonData as OTAVersionConfig;
    remoteVersion = versionConfig.version;
  } else {
    // Fall back to text response
    const data = await response.text();
    if (!data) {
      throw new Error('Empty response from version check URL');
    }
    remoteVersion = data.trim();
  }

  // If no current version, update is available
  if (!currentOtaVersion) {
    const isCompatible = versionConfig
      ? isVersionTargeted(versionConfig.targetVersions, currentAppVersion)
      : true;

    return {
      hasUpdate: true,
      isCompatible,
      remoteVersion,
      currentVersion: null,
      metadata: versionConfig
        ? {
            isSemver: versionConfig.isSemver,
            releaseNotes: versionConfig.releaseNotes,
            targetVersions: versionConfig.targetVersions,
          }
        : undefined,
    };
  }

  // From here, we know currentOtaVersion exists

  // Determine if update is available based on version comparison
  let hasUpdate = false;

  if (versionConfig?.isSemver) {
    // Use semver comparison
    const comparison = compareSemver(remoteVersion, currentOtaVersion);
    if (comparison === null) {
      console.warn(
        'OTA: Invalid semver format detected. Falling back to string comparison.',
        { remoteVersion, currentOtaVersion }
      );
      hasUpdate = remoteVersion !== currentOtaVersion;
    } else {
      // Update available if remote version is greater
      hasUpdate = comparison > 0;
    }
  } else {
    // Simple string comparison
    hasUpdate = remoteVersion !== currentOtaVersion;
  }

  // Check if the update is compatible with current app version
  const isCompatible = versionConfig
    ? isVersionTargeted(versionConfig.targetVersions, currentAppVersion)
    : true;

  return {
    hasUpdate,
    isCompatible,
    remoteVersion,
    currentVersion: currentOtaVersion,
    metadata: versionConfig
      ? {
          isSemver: versionConfig.isSemver,
          releaseNotes: versionConfig.releaseNotes,
          targetVersions: versionConfig.targetVersions,
        }
      : undefined,
  };
}

/**
 * Simple helper to check if an OTA update is both available and compatible
 * @param versionCheckUrl - URL to check for version information
 * @param currentOtaVersion - Currently installed OTA version (if any)
 * @param currentAppVersion - Current app version
 * @returns true if update is available and compatible, false otherwise
 */
export async function hasCompatibleUpdate(
  versionCheckUrl: string,
  currentOtaVersion: string | null,
  currentAppVersion: string
): Promise<boolean> {
  const result = await checkOTAVersion(
    versionCheckUrl,
    currentOtaVersion,
    currentAppVersion
  );
  return result.hasUpdate && result.isCompatible;
}

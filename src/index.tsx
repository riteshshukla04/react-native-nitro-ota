import { NitroModules } from 'react-native-nitro-modules';
import type { NitroOta } from './NitroOta.nitro';

const NitroOtaHybridObject =
  NitroModules.createHybridObject<NitroOta>('NitroOta');

export function checkForOTAUpdates(versionCheckUrl: string): Promise<boolean> {
  console.log("checkForUpdates", versionCheckUrl);
  return NitroOtaHybridObject.checkForUpdates(versionCheckUrl);
}

export function downloadZipFromUrl(downloadUrl: string): Promise<string> {
  console.log("downloadZipFromUrl", downloadUrl);
  return NitroOtaHybridObject.downloadZipFromUrl(downloadUrl);
}

export function getStoredOtaVersion(): string | null {
  return NitroOtaHybridObject.getStoredOtaVersion();
}

export function getStoredUnzippedPath(): string | null {
  return NitroOtaHybridObject.getStoredUnzippedPath();
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
      console.log(`OTA: Checking for updates using version check URL: ${urlToCheck}`);
      return await checkForOTAUpdates(urlToCheck);
    } catch (error) {
      console.error('OTA: Failed to check for updates:', error);
      throw error;
    }
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
}

export { githubOTA } from './githubUtils';
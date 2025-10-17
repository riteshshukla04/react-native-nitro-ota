import { NitroModules } from 'react-native-nitro-modules';
import type { NitroOta } from './NitroOta.nitro';

const NitroOtaHybridObject =
  NitroModules.createHybridObject<NitroOta>('NitroOta');

export function checkForOTAUpdates(url: string, branch?: string): Promise<boolean> {
  console.log("checkForUpdates", url, branch);
  return NitroOtaHybridObject.checkForUpdates(url, branch);
}

export function downloadZipFromGitHub(url: string, branch?: string): Promise<string> {
  console.log("downloadZipFromGitHub", url, branch);
  return NitroOtaHybridObject.downloadZipFromGitHub(url, branch);
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
  private repoUrl: string;
  private branch: string;

  constructor(repoUrl: string, branch: string = 'master') {
    this.repoUrl = repoUrl;
    this.branch = branch;
  }

  /**
   * Checks if there are any updates available by comparing versions
   */
  async checkForUpdates(): Promise<boolean> {
    try {
      console.log(`OTA: Checking for updates for ${this.repoUrl} on branch ${this.branch}`);
      return await checkForOTAUpdates(this.repoUrl, this.branch);
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
      console.log(`OTA: Downloading update from ${this.repoUrl} on branch ${this.branch}`);
      const path = await downloadZipFromGitHub(this.repoUrl, this.branch);
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
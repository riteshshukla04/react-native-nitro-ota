import type { HybridObject } from 'react-native-nitro-modules';

export interface NitroOta
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  checkForUpdates(versionCheckUrl: string, branch?: string): Promise<boolean>;
  downloadZipFromUrl(downloadUrl: string, branch?: string): Promise<string>;
  getStoredOtaVersion(): string | null;
  getStoredUnzippedPath(): string | null;
}

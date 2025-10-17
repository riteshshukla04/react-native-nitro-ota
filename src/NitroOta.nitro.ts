import type { HybridObject } from 'react-native-nitro-modules';

export interface NitroOta
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  checkForUpdates(url: string, branch?: string): Promise<boolean>;
  downloadZipFromGitHub(url: string, branch?: string): Promise<string>;
  getStoredOtaVersion(): string | null;
  getStoredUnzippedPath(): string | null;
}

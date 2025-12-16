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


  scheduleJSInBackground(callback: () => Promise<void>, interval: number): void;
}

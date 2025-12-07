import { checkOTAVersion, hasCompatibleUpdate } from '../otaVersionChecker';
import { Platform } from 'react-native';

// Mock fetch globally
global.fetch = jest.fn();

describe('otaVersionChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to android for testing
    Platform.OS = 'android';
  });

  describe('Plain text version format', () => {
    it('should detect update when versions differ (plain text)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'text/plain',
        },
        text: async () => '1.2.0',
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version',
        '1.1.0',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(true);
      expect(result.isCompatible).toBe(true);
      expect(result.remoteVersion).toBe('1.2.0');
      expect(result.currentVersion).toBe('1.1.0');
    });

    it('should return no update when versions are same (plain text)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'text/plain',
        },
        text: async () => '1.1.0',
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version',
        '1.1.0',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(false);
      expect(result.isCompatible).toBe(true);
    });
  });

  describe('JSON version format', () => {
    it('should parse JSON version correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.2.0',
          isSemver: false,
          releaseNotes: 'Bug fixes',
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(true);
      expect(result.isCompatible).toBe(true);
      expect(result.remoteVersion).toBe('1.2.0');
      expect(result.metadata?.releaseNotes).toBe('Bug fixes');
    });

    it('should handle semver comparison when isSemver is true', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '2.0.0',
          isSemver: true,
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '1.9.9',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(true);
      expect(result.isCompatible).toBe(true);
    });

    it('should detect no update when remote version is lower (semver)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.0.0',
          isSemver: true,
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '2.0.0',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(false);
    });

    it('should handle patch version updates correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.0.1',
          isSemver: true,
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '1.0.0',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(true);
    });
  });

  describe('Target version compatibility', () => {
    it('should mark as compatible when targetVersions is not specified', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.2.0',
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result.isCompatible).toBe(true);
    });

    it('should mark as compatible when app version is in targetVersions list', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.2.0',
          targetVersions: {
            android: ['2.0.0', '2.1.0'],
            ios: ['2.0.0'],
          },
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(true);
      expect(result.isCompatible).toBe(true);
    });

    it('should mark as incompatible when app version is not in targetVersions list', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.2.0',
          targetVersions: {
            android: ['3.0.0'],
            ios: ['3.0.0'],
          },
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(true);
      expect(result.isCompatible).toBe(false);
    });

    it('should mark as compatible when targetVersions list is empty for platform', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.2.0',
          targetVersions: {
            android: [],
            ios: ['3.0.0'],
          },
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result.isCompatible).toBe(true);
    });
  });

  describe('hasCompatibleUpdate helper', () => {
    it('should return true when update is available and compatible', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.2.0',
          targetVersions: {
            android: ['2.0.0'],
            ios: ['2.0.0'],
          },
        }),
      });

      const result = await hasCompatibleUpdate(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result).toBe(true);
    });

    it('should return false when update is available but incompatible', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.2.0',
          targetVersions: {
            android: ['3.0.0'],
            ios: ['3.0.0'],
          },
        }),
      });

      const result = await hasCompatibleUpdate(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result).toBe(false);
    });

    it('should return false when no update is available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.1.0',
        }),
      });

      const result = await hasCompatibleUpdate(
        'https://example.com/ota.version.json',
        '1.1.0',
        '2.0.0'
      );

      expect(result).toBe(false);
    });
  });

  describe('First time installation (no current version)', () => {
    it('should mark as update available when no current version exists', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          version: '1.0.0',
          targetVersions: {
            android: ['2.0.0'],
            ios: ['2.0.0'],
          },
        }),
      });

      const result = await checkOTAVersion(
        'https://example.com/ota.version.json',
        null,
        '2.0.0'
      );

      expect(result.hasUpdate).toBe(true);
      expect(result.isCompatible).toBe(true);
      expect(result.currentVersion).toBe(null);
    });
  });
});

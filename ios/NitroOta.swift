import NitroModules

class NitroOta: HybridNitroOtaSpec {
    private lazy var otaManager = OtaManager()

    func checkForUpdates(versionCheckUrl: String, branch: String?) throws -> Promise<Bool> {
        return Promise.async {
            do {
                print("NitroOta: Checking for updates using version check URL: \(versionCheckUrl)")
                let hasUpdate = try self.otaManager.checkForUpdates(versionCheckUrl)
                print("NitroOta: Update check result: \(hasUpdate)")
                return hasUpdate
            } catch {
                print("NitroOta: Failed to check for updates: \(error.localizedDescription)")
                throw error
            }
        }
    }

    func downloadZipFromUrl(downloadUrl: String, branch: String?) throws -> Promise<String> {
        return Promise.async {
            do {
                print("NitroOta: Starting download from URL: \(downloadUrl)")
                let unzippedPath = try self.otaManager.downloadAndUnzipFromUrl(downloadUrl, versionCheckUrl: nil)
                print("NitroOta: Unzipped path: \(unzippedPath)")
                return unzippedPath
            } catch {
                print("NitroOta: Failed to download and unzip: \(error.localizedDescription)")
                throw error
            }
        }
    }

    func getStoredOtaVersion() throws -> String? {
        return otaManager.getStoredOtaVersion()
    }

    func getStoredUnzippedPath() throws -> String? {
        return otaManager.getStoredUnzippedPath()
    }

    func getStoredBundlePath() -> String? {
        return otaManager.getStoredUnzippedPath()
    }
}

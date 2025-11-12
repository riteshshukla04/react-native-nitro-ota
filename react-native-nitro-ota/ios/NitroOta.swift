//
//  NitroOta.swift
//  Pods
//
//  Created by Ritesh Shukla on 12/11/25.
//
import NitroModules
import React


class NitroOta:HybridNitroOtaSpec {
    
    
    private lazy var nitroOtaManager =  NitroOtaManager()
    // Methods
    func checkForUpdates(_versionCheckUrl: String) throws -> Promise<Bool> {
            return Promise.async {
                return try self.nitroOtaManager.checkForUpdates(_versionCheckUrl)
            }
        }

        func downloadZipFromUrl(_downloadUrl: String) throws -> Promise<String> {
            return Promise.async {
                return try self.nitroOtaManager.downloadAndUnzipFromUrl(_downloadUrl,versionCheckUrl: nil)
            }
        }
    func getStoredOtaVersion() throws -> String? {
        return nitroOtaManager.getStoredOtaVersion()
    }
    func getStoredUnzippedPath() throws -> String? {
        return nitroOtaManager.getStoredOtaVersion()
    }
   
    func reloadApp() throws -> Void {
        let reload={
              RCTTriggerReloadCommandListeners("NITRO OTA UPDATE")
            }
            if (Thread.isMainThread) {
              reload()
            } else{
              DispatchQueue.main.sync {
                      reload()
              }
            }
          
    }
}

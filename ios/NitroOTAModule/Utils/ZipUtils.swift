//
//  ZipUtils.swift
//  NitroOta
//
//  Created by Ritesh Shukla on 19/10/25.
//


import Foundation
import SSZipArchive

class ZipUtils {
    static func unzip(zipFile: URL, to destination: URL) throws {
        let fileManager = FileManager.default
        
        // Ensure destination directory exists
        try fileManager.createDirectory(at: destination, withIntermediateDirectories: true, attributes: nil)
        
        // Use SSZipArchive to extract the zip file
        var error: NSError?
        let success = SSZipArchive.unzipFile(
            atPath: zipFile.path,
            toDestination: destination.path,
            preserveAttributes: true, overwrite: true,
            password: nil,
            error: &error,
            delegate: nil
        )
        
        if !success {
            if let error = error {
                throw error
            } else {
                throw NSError(
                    domain: "ZipUtils",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to unzip file at path: \(zipFile.path)"]
                )
            }
        }
        
        print("ZipUtils: Successfully unzipped file from \(zipFile.path) to \(destination.path)")
    }
}

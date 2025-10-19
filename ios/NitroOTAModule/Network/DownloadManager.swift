//
//  DownloadManager.swift
//  NitroOta
//
//  Created by Ritesh Shukla on 19/10/25.
//


import Foundation

class DownloadManager {
    func downloadFile(from url: URL, to destination: URL) throws {
        let data = try Data(contentsOf: url)
        try data.write(to: destination)
    }

    func downloadText(from url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        guard let text = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to decode text data"])
        }
        return text
    }

    func downloadText(from urlString: String) throws -> String {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "DownloadManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        return try downloadText(from: url)
    }
}

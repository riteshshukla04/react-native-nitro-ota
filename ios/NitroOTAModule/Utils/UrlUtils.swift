//
//  UrlUtils.swift
//  NitroOta
//
//  Created by Ritesh Shukla on 19/10/25.
//


import Foundation

class UrlUtils {
    // GitHub-specific URL utilities (kept for backward compatibility)
    static func convertGitUrlToDownloadUrl(gitUrl: String, branch: String = "master") -> String {
        let cleanUrl = gitUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")).replacingOccurrences(of: ".git", with: "")
        let parts = cleanUrl.components(separatedBy: "/")

        guard parts.count >= 5, parts[2] == "github.com" else {
            fatalError("Invalid GitHub URL format. Expected: https://github.com/owner/repo")
        }

        let owner = parts[3]
        let repo = parts[4]

        return "https://github.com/\(owner)/\(repo)/archive/refs/heads/\(branch).zip"
    }

    static func convertGitUrlToRawContentUrl(gitUrl: String, branch: String = "master", filePath: String) -> String {
        let cleanUrl = gitUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")).replacingOccurrences(of: ".git", with: "")
        let parts = cleanUrl.components(separatedBy: "/")

        guard parts.count >= 5, parts[2] == "github.com" else {
            fatalError("Invalid GitHub URL format. Expected: https://github.com/owner/repo")
        }

        let owner = parts[3]
        let repo = parts[4]

        return "https://raw.githubusercontent.com/\(owner)/\(repo)/\(branch)/\(filePath)"
    }

    static func isGitHubUrl(_ url: String) -> Bool {
        let githubPattern = "^https://github\\.com/[^/]+/[^/]+(?:\\.git)?/?$"
        let regex = try? NSRegularExpression(pattern: githubPattern, options: [])
        let range = NSRange(location: 0, length: url.count)
        return regex?.firstMatch(in: url, options: [], range: range) != nil
    }
}

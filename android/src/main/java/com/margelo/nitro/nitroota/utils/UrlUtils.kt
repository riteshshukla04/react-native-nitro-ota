package com.margelo.nitro.nitroota.utils

object UrlUtils {

    /**
     * Converts a GitHub repository URL to a downloadable zip archive URL.
     *
     * Examples:
     * - https://github.com/user/repo.git -> https://github.com/user/repo/archive/refs/heads/master.zip
     * - https://github.com/user/repo -> https://github.com/user/repo/archive/refs/heads/master.zip
     * https://codeload.github.com/Jellify-Music/App-Bundles/zip/refs/heads/main
     * @param gitUrl The GitHub repository URL (with or without .git suffix)
     * @param branch The branch to download (default: "master")
     * @return The GitHub archive download URL
     * @throws IllegalArgumentException If the URL is not a valid GitHub repository URL
     */
    fun convertGitUrlToDownloadUrl(gitUrl: String, branch: String = "master"): String {
    
        val cleanUrl = gitUrl.removeSuffix("/").removeSuffix(".git")
        val parts = cleanUrl.split("/")
        
        require(parts.size >= 5 && parts[2] == "github.com") {
            "Invalid GitHub URL format. Expected: https://github.com/owner/repo"
        }
        
        val owner = parts[3]
        val repo = parts[4]
        
        return "https://github.com/$owner/$repo/archive/refs/heads/$branch.zip"
    }

    /**
     * Converts a GitHub repository URL to a raw content URL for a specific file.
     *
     * Examples:
     * - https://github.com/user/repo.git + "ota.version" -> https://raw.githubusercontent.com/user/repo/master/ota.version
     * - https://github.com/user/repo + "ota.version" -> https://raw.githubusercontent.com/user/repo/master/ota.version
     *
     * @param gitUrl The GitHub repository URL (with or without .git suffix)
     * @param branch The branch to download from (default: "master")
     * @param filePath The path to the file within the repository
     * @return The GitHub raw content URL
     * @throws IllegalArgumentException If the URL is not a valid GitHub repository URL
     */
    fun convertGitUrlToRawContentUrl(gitUrl: String, branch: String = "master", filePath: String): String {
        val cleanUrl = gitUrl.removeSuffix("/").removeSuffix(".git")
        val parts = cleanUrl.split("/")

        require(parts.size >= 5 && parts[2] == "github.com") {
            "Invalid GitHub URL format. Expected: https://github.com/owner/repo"
        }

        val owner = parts[3]
        val repo = parts[4]

        return "https://raw.githubusercontent.com/$owner/$repo/$branch/$filePath"
    }

    /**
     * Checks if the given URL is a valid GitHub repository URL.
     */
    private fun isGitHubUrl(url: String): Boolean {
        val githubPattern = Regex("^https://github\\.com/[^/]+/[^/]+(?:\\.git)?/?$")
        return githubPattern.matches(url)
    }
}

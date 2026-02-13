package com.margelo.nitro.nitroota.network

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class DownloadManager(private val client: OkHttpClient = OkHttpClient()) {

    /**
     * Downloads a file from the given URL and saves it to the specified file.
     *
     * @param url The URL to download from
     * @param outputFile The file to save the downloaded content to
     * @throws IOException If the download fails or response is not successful
     */
    fun downloadFile(url: String, outputFile: File, onProgress: ((Long, Long) -> Unit)? = null) {
        val request = Request.Builder()
            .url(url)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Failed to download file: ${response.code}")
            }

            val body = response.body ?: throw IOException("Response body is null")
            val contentLength = body.contentLength() // -1 if unknown

            FileOutputStream(outputFile).use { output ->
                body.byteStream().use { input ->
                    if (onProgress == null) {
                        input.copyTo(output)
                    } else {
                        val buffer = ByteArray(8 * 1024)
                        var bytesRead: Int
                        var totalRead = 0L
                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            output.write(buffer, 0, bytesRead)
                            totalRead += bytesRead
                            onProgress(totalRead, contentLength)
                        }
                        // Final call: received == total signals download complete.
                        // If contentLength was unknown (-1) this is the first time
                        // the caller learns the actual size.
                        onProgress(totalRead, totalRead)
                    }
                }
            }
        }
    }

    /**
     * Downloads text content from the given URL and returns it as a string.
     * Supports both raw GitHub URLs and custom CDN URLs (text/plain responses).
     *
     * @param url The URL to download from
     * @return The text content as a string
     * @throws IOException If the download fails or response is not successful
     */
    fun downloadText(url: String): String {
        val request = Request.Builder()
            .url(url)
            .header("Accept", "text/plain, */*")
            .cacheControl(okhttp3.CacheControl.Builder().noCache().noStore().build())
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Failed to download text from $url: HTTP ${response.code}")
            }

            return response.body?.string() ?: throw IOException("Response body is null for $url")
        }
    }
}

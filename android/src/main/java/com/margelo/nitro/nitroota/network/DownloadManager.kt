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
    fun downloadFile(url: String, outputFile: File) {
        val request = Request.Builder()
            .url(url)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Failed to download file: ${response.code}")
            }

            val body = response.body ?: throw IOException("Response body is null")

            FileOutputStream(outputFile).use { output ->
                body.byteStream().use { input ->
                    input.copyTo(output)
                }
            }
        }
    }

    /**
     * Downloads text content from the given URL and returns it as a string.
     *
     * @param url The URL to download from
     * @return The text content as a string
     * @throws IOException If the download fails or response is not successful
     */
    fun downloadText(url: String): String {
        val request = Request.Builder()
            .url(url)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Failed to download text: ${response.code}")
            }

            return response.body?.string() ?: throw IOException("Response body is null")
        }
    }
}

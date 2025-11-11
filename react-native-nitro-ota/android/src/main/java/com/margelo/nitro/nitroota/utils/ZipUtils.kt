package com.margelo.nitro.nitroota.utils

import java.io.File
import java.io.IOException
import java.util.zip.ZipInputStream

object ZipUtils {

    /**
     * Unzips a zip file to the specified destination directory.
     * Includes security checks to prevent directory traversal attacks.
     *
     * @param zipFile The zip file to unzip
     * @param destinationDir The directory to extract files to
     * @throws IOException If an I/O error occurs
     * @throws SecurityException If a directory traversal attack is detected
     */
    fun unzip(zipFile: File, destinationDir: File) {
        ZipInputStream(zipFile.inputStream()).use { zipInput ->
            var entry = zipInput.nextEntry
            while (entry != null) {
                val entryFile = File(destinationDir, entry.name)

                // Prevent directory traversal attacks
                if (!entryFile.canonicalPath.startsWith(destinationDir.canonicalPath)) {
                    throw SecurityException("Entry is outside of the target dir: ${entry.name}")
                }

                if (entry.isDirectory) {
                    entryFile.mkdirs()
                } else {
                    entryFile.parentFile?.mkdirs()
                    entryFile.outputStream().use { output ->
                        zipInput.copyTo(output)
                    }
                }

                zipInput.closeEntry()
                entry = zipInput.nextEntry
            }
        }
    }
}

package com.margelo.nitro.nitroota.utils

import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest

/**
 * Applies NITROBSD patches (bsdiff algorithm, raw blocks) to rebuild a bundle file.
 */
object PatchUtils {
    private val MAGIC = "NITROBSD".toByteArray(Charsets.US_ASCII)
    private const val HEADER_SIZE = 84
    private const val MAX_NEW_SIZE = 256 * 1024 * 1024

    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    fun apply(base: File, patch: File, output: File) {
        output.writeBytes(apply(base.readBytes(), patch.readBytes()))
    }

    fun apply(old: ByteArray, patch: ByteArray): ByteArray {
        if (patch.size < HEADER_SIZE || !patch.copyOfRange(0, 8).contentEquals(MAGIC)) {
            throw IOException("Invalid patch header")
        }
        val buffer = ByteBuffer.wrap(patch).order(ByteOrder.LITTLE_ENDIAN)
        val ctrlLen = buffer.getInt(8)
        val diffLen = buffer.getInt(12)
        val newSize = buffer.getInt(16)
        if (ctrlLen < 0 || ctrlLen % 12 != 0 || diffLen < 0 || newSize < 0 || newSize > MAX_NEW_SIZE ||
            HEADER_SIZE.toLong() + ctrlLen + diffLen > patch.size
        ) {
            throw IOException("Corrupt patch header")
        }
        if (!sha256(old).contentEquals(patch.copyOfRange(20, 52))) {
            throw IOException("Base bundle mismatch")
        }

        val out = ByteArray(newSize)
        var ctrl = HEADER_SIZE
        val ctrlEnd = HEADER_SIZE + ctrlLen
        var diff = ctrlEnd
        val diffEnd = ctrlEnd + diffLen
        var extra = diffEnd
        var oldPos = 0L
        var newPos = 0

        while (newPos < newSize) {
            if (ctrl + 12 > ctrlEnd) throw IOException("Corrupt patch control block")
            val x = buffer.getInt(ctrl)
            val y = buffer.getInt(ctrl + 4)
            val z = buffer.getInt(ctrl + 8)
            ctrl += 12
            if (x < 0 || y < 0 || oldPos < 0 || oldPos + x > old.size ||
                newPos.toLong() + x + y > newSize || diff.toLong() + x > diffEnd || extra.toLong() + y > patch.size
            ) {
                throw IOException("Corrupt patch data")
            }
            val o = oldPos.toInt()
            for (i in 0 until x) {
                out[newPos + i] = (old[o + i] + patch[diff + i]).toByte()
            }
            newPos += x
            diff += x
            oldPos += x
            System.arraycopy(patch, extra, out, newPos, y)
            newPos += y
            extra += y
            oldPos += z
        }

        if (!sha256(out).contentEquals(patch.copyOfRange(52, 84))) {
            throw IOException("Patched bundle hash mismatch")
        }
        return out
    }
}

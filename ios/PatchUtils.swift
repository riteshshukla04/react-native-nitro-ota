//
//  PatchUtils.swift
//  NitroOta
//
//  Applies NITROBSD patches (bsdiff algorithm, raw blocks) to rebuild a bundle file.
//

import CryptoKit
import Foundation

enum PatchUtils {
    private static let magic = Array("NITROBSD".utf8)
    private static let headerSize = 84
    private static let maxNewSize = 256 * 1024 * 1024

    static func sha256(_ bytes: [UInt8]) -> [UInt8] {
        return Array(SHA256.hash(data: bytes))
    }

    static func apply(base: URL, patch: URL, output: URL) throws {
        let old = [UInt8](try Data(contentsOf: base))
        let patchBytes = [UInt8](try Data(contentsOf: patch))
        let new = try apply(old: old, patch: patchBytes)
        try Data(new).write(to: output, options: .atomic)
    }

    static func apply(old: [UInt8], patch p: [UInt8]) throws -> [UInt8] {
        guard p.count >= headerSize, Array(p[0..<8]) == magic else {
            throw error("Invalid patch header")
        }
        let ctrlLen = Int(readInt32(p, 8))
        let diffLen = Int(readInt32(p, 12))
        let newSize = Int(readInt32(p, 16))
        guard ctrlLen >= 0, ctrlLen % 12 == 0, diffLen >= 0,
              newSize >= 0, newSize <= maxNewSize,
              headerSize + ctrlLen + diffLen <= p.count else {
            throw error("Corrupt patch header")
        }
        guard sha256(old) == Array(p[20..<52]) else {
            throw error("Base bundle mismatch")
        }

        var out = [UInt8](repeating: 0, count: newSize)
        var ctrl = headerSize
        let ctrlEnd = headerSize + ctrlLen
        var diff = ctrlEnd
        let diffEnd = ctrlEnd + diffLen
        var extra = diffEnd
        var oldPos = 0
        var newPos = 0

        while newPos < newSize {
            guard ctrl + 12 <= ctrlEnd else { throw error("Corrupt patch control block") }
            let x = Int(readInt32(p, ctrl))
            let y = Int(readInt32(p, ctrl + 4))
            let z = Int(readInt32(p, ctrl + 8))
            ctrl += 12
            guard x >= 0, y >= 0, oldPos >= 0, oldPos + x <= old.count,
                  newPos + x + y <= newSize, diff + x <= diffEnd, extra + y <= p.count else {
                throw error("Corrupt patch data")
            }
            for i in 0..<x {
                out[newPos + i] = old[oldPos + i] &+ p[diff + i]
            }
            newPos += x
            diff += x
            oldPos += x
            for i in 0..<y {
                out[newPos + i] = p[extra + i]
            }
            newPos += y
            extra += y
            oldPos += z
        }

        guard sha256(out) == Array(p[52..<84]) else {
            throw error("Patched bundle hash mismatch")
        }
        return out
    }

    private static func readInt32(_ b: [UInt8], _ i: Int) -> Int32 {
        let value = UInt32(b[i]) | UInt32(b[i + 1]) << 8 | UInt32(b[i + 2]) << 16 | UInt32(b[i + 3]) << 24
        return Int32(bitPattern: value)
    }

    private static func error(_ message: String) -> NSError {
        return NSError(domain: "OtaManager", code: -1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}

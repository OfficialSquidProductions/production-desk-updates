import Foundation
import PDFKit
import CryptoKit
import UniformTypeIdentifiers

extension UTType {
    static let productionDeskProject = UTType(exportedAs: "org.squidproductions.productiondesk.project", conformingTo: .json)
}

enum NativeFileError: LocalizedError {
    case invalidRequest, emptyFile, tooLarge, unreadablePDF, scannedPDF, emptyReport
    var errorDescription: String? {
        switch self {
        case .invalidRequest: return "The local file request was not valid."
        case .emptyFile: return "This file is empty or damaged. Choose another Production Desk project, backup, or script."
        case .tooLarge: return "This file exceeds the supported limit (40 MB per script/PDF, 200 MB per project or backup)."
        case .unreadablePDF: return "This PDF could not be opened. Unlock it or export an unencrypted copy."
        case .scannedPDF: return "This PDF has no selectable text. Scanned scripts need a text layer before import."
        case .emptyReport: return "Open a report or shot list before sharing a PDF."
        }
    }
}

enum NativeFiles {
    static let maximumBytes = 200 * 1024 * 1024

    static func importFile(_ url: URL) throws -> [String: String] {
        guard url.isFileURL else { throw NativeFileError.invalidRequest }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        var coordinationError: NSError?
        var outcome: Result<Data, Error>?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinated in
            outcome = Result {
                let values = try coordinated.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
                let limit = ["json", "productiondesk"].contains(url.pathExtension.lowercased()) ? maximumBytes : 40 * 1024 * 1024
                guard values.isRegularFile == true else { throw NativeFileError.invalidRequest }
                guard let size = values.fileSize, size > 0 else { throw NativeFileError.emptyFile }
                guard size <= limit else { throw NativeFileError.tooLarge }
                let data = try Data(contentsOf: coordinated)
                guard data.count <= limit else { throw NativeFileError.tooLarge }
                return data
            }
        }
        if let coordinationError { throw coordinationError }
        guard let outcome else { throw NativeFileError.invalidRequest }
        return ["filename": safeFilename(url.lastPathComponent), "base64": try outcome.get().base64EncodedString()]
    }

    static func extractPDF(_ data: Data) throws -> String {
        guard data.count <= 40 * 1024 * 1024 else { throw NativeFileError.tooLarge }
        guard let document = PDFDocument(data: data), !document.isLocked else { throw NativeFileError.unreadablePDF }
        // The script parser uses form feeds to retain screenplay page numbers.
        let text = (0..<document.pageCount).map { document.page(at: $0)?.string ?? "" }.joined(separator: "\n\u{000C}\n")
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw NativeFileError.scannedPDF }
        return text
    }

    static func safeFilename(_ raw: String) -> String {
        let name = raw.replacingOccurrences(of: "\\", with: "/").split(separator: "/").last.map(String.init) ?? "Production-Desk-export.json"
        let cleaned = name.components(separatedBy: CharacterSet.controlCharacters.union(CharacterSet(charactersIn: ":"))).joined(separator: "-")
        return cleaned == "." || cleaned == ".." || cleaned.isEmpty ? "Production-Desk-export.json" : String(cleaned.prefix(180))
    }

    static func export(_ data: Data, filename: String, directory: URL = FileManager.default.temporaryDirectory) throws -> URL {
        guard data.count <= maximumBytes else { throw NativeFileError.tooLarge }
        let folder = directory.appendingPathComponent("ProductionDeskShares").appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent(safeFilename(filename))
        try data.write(to: url, options: .atomic)
        return url
    }
}

// Original PDF files use their content digest as their immutable filename.
// The full-backup format matches the current Mac/Windows 1.5.2 format.
enum PDFRepository {
    static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    static func url(_ hash: String, directory: URL) throws -> URL {
        guard hash.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw NativeFileError.invalidRequest }
        return directory.appendingPathComponent("pdfs").appendingPathComponent(hash + ".pdf")
    }
    static func store(_ data: Data, filename: String, directory: URL) throws -> [String: Any] {
        guard data.count > 0, data.count <= 40 * 1024 * 1024,
              let pdf = PDFDocument(data: data), !pdf.isLocked else { throw NativeFileError.unreadablePDF }
        let hash = digest(data), file = try url(hash, directory: directory)
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: file.path) { _ = try read(hash, directory: directory) }
        else { try data.write(to: file, options: .atomic) }
        return ["sha256":hash, "filename":NativeFiles.safeFilename(filename), "marks":[]]
    }
    static func references(_ workspace: [String: Any]) throws -> Set<String> {
        guard let projects = workspace["projects"] as? [[String: Any]] else { throw NativeFileError.invalidRequest }
        var result = Set<String>()
        for project in projects {
            if let lining = project["_linedScript"] as? [String: Any], let documents = lining["documents"] as? [[String: Any]] {
                for document in documents {
                    guard let hash = document["sha256"] as? String else { throw NativeFileError.invalidRequest }
                    _ = try url(hash, directory: FileManager.default.temporaryDirectory)
                    result.insert(hash)
                }
            }
        }
        return result
    }
    static func read(_ hash: String, directory: URL) throws -> Data {
        let data = try Data(contentsOf: url(hash, directory: directory))
        guard data.count <= 40 * 1024 * 1024, digest(data) == hash else { throw NativeFileError.unreadablePDF }
        return data
    }
    static func backup(_ workspace: [String: Any], directory: URL) throws -> [String: String] {
        var result = [String:String](), count = 0
        for hash in try references(workspace) {
            let data = try read(hash, directory: directory)
            let encoded = data.base64EncodedString();count += encoded.utf8.count
            guard count < 160 * 1024 * 1024 else { throw NativeFileError.tooLarge }
            result[hash] = encoded
        }
        return result
    }
    static func restore(_ workspace: [String: Any], directory: URL) throws {
        let attachments = workspace["_pdfDocuments"] as? [String:String] ?? [:]
        var verified = [Data]()
        for hash in try references(workspace) {
            if let encoded = attachments[hash] {
                guard encoded.utf8.count <= 56 * 1024 * 1024, let data = Data(base64Encoded: encoded), data.count <= 40 * 1024 * 1024, digest(data) == hash,
                      let pdf = PDFDocument(data: data), !pdf.isLocked else { throw NativeFileError.unreadablePDF }
                verified.append(data)
            } else { _ = try read(hash, directory: directory) }
        }
        // Validate every attachment before writing any. Existing PDFs are immutable.
        for data in verified { _ = try store(data, filename: "script.pdf", directory: directory) }
    }
}

import Foundation
import PDFKit

guard CommandLine.arguments.count == 2,
      let pdf = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    fputs("Could not read this PDF. It may be encrypted or damaged.\n", stderr)
    exit(1)
}
let pages = (0..<pdf.pageCount).map { pdf.page(at: $0)?.string ?? "" }
if pages.joined().trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
    fputs("This PDF has no extractable text. Export a searchable PDF or use Final Draft (.fdx).\n", stderr)
    exit(2)
}
print(pages.joined(separator: "\n\u{000C}\n"))

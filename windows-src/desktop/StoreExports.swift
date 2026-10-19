import AppKit
import WebKit

// Store-only export handling. The browser/direct-download path remains intact.
enum StoreExportPolicy {
    static let maximumBytes = 80 * 1024 * 1024

    static func authorized(mainFrame: Bool, scheme: String, host: String, port: Int, origin: URL?) -> Bool {
        mainFrame && scheme == "http" && host == "127.0.0.1" && port == origin?.port
            && origin?.scheme == "http" && origin?.host == "127.0.0.1"
    }

    static func requestURL(_ path: String, origin: URL) throws -> URL {
        guard origin.scheme == "http", origin.host == "127.0.0.1", origin.port != nil,
              path.utf8.count == 46,
              path.range(of: "^/api/download/[a-f0-9]{32}$", options: .regularExpression) != nil,
              let url = URL(string: path, relativeTo: origin)?.absoluteURL else {
            throw ExportError.invalidRequest
        }
        return url
    }

    static func filename(response: HTTPURLResponse, expectedURL: URL, bytes: Int) throws -> String {
        guard response.statusCode == 200, response.url == expectedURL,
              bytes >= 0, bytes <= maximumBytes,
              let header = response.value(forHTTPHeaderField: "Content-Disposition"),
              header.hasPrefix("attachment; filename=\""), header.hasSuffix("\"") else {
            throw ExportError.invalidResponse
        }
        let filename = String(header.dropFirst("attachment; filename=\"".count).dropLast())
        guard filename.range(of: "^[A-Za-z0-9_ .-]{1,200}$", options: .regularExpression) != nil,
              ["productiondesk", "csv", "json", "uss", "pdf"].contains(URL(fileURLWithPath: filename).pathExtension.lowercased()) else {
            throw ExportError.invalidResponse
        }
        return filename
    }

    static func metadataScript(version: String, build: String) -> String {
        let raw = try! JSONSerialization.data(withJSONObject: ["version": version, "build": build], options: [.sortedKeys])
        let json = String(data: raw, encoding: .utf8)!
        return """
        (() => {
          const metadata = \(json);
          window.productionDeskMacStore = true;
          const label = document.querySelector('.sidebar-bottom small');
          if (label) label.textContent = 'PRODUCTION DESK / ' + metadata.version + ' (' + metadata.build + ')';
        })();
        """
    }

    enum ExportError: LocalizedError {
        case invalidRequest, invalidResponse
        var errorDescription: String? {
            switch self {
            case .invalidRequest: return "A local Production Desk export is required."
            case .invalidResponse: return "The export could not be read. Please export it again."
            }
        }
    }
}

final class StoreExports: NSObject, URLSessionTaskDelegate {
    private var session: URLSession?
    private var busy = false

    // Never follow redirects out of the validated local download endpoint.
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }

    func save(path: String, origin: URL, window: NSWindow, reply: @escaping (Any?, String?) -> Void) {
        guard !busy, window.attachedSheet == nil else {
            reply(nil, "Finish the current save dialog first."); return
        }
        let url: URL
        do { url = try StoreExportPolicy.requestURL(path, origin: origin) }
        catch { reply(nil, error.localizedDescription); return }
        busy = true
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.timeoutIntervalForRequest = 30
        let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        self.session = session
        session.downloadTask(with: url) { [weak self] file, response, error in
            let result: Result<(Data, String), Error>
            do {
                if let error = error { throw error }
                guard let file = file, let response = response as? HTTPURLResponse else {
                    throw StoreExportPolicy.ExportError.invalidResponse
                }
                guard let bytes = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize else {
                    throw StoreExportPolicy.ExportError.invalidResponse
                }
                let name = try StoreExportPolicy.filename(response: response, expectedURL: url, bytes: bytes)
                result = .success((try Data(contentsOf: file), name))
            } catch { result = .failure(error) }
            session.finishTasksAndInvalidate()
            DispatchQueue.main.async {
                guard let self = self else { reply(nil, "The export window closed."); return }
                self.session = nil
                switch result {
                case .failure(let error):
                    self.busy = false
                    reply(nil, error.localizedDescription)
                case .success(let (data, name)):
                    let panel = NSSavePanel()
                    panel.nameFieldStringValue = name
                    panel.canCreateDirectories = true
                    panel.beginSheetModal(for: window) { response in
                        defer { self.busy = false }
                        guard response == .OK, let destination = panel.url else {
                            reply(["native": true, "cancelled": true], nil); return
                        }
                        do {
                            try data.write(to: destination, options: .atomic)
                            reply(["native": true, "cancelled": false], nil)
                        } catch { reply(nil, "The export could not be saved: " + error.localizedDescription) }
                    }
                }
            }
        }.resume()
    }
}

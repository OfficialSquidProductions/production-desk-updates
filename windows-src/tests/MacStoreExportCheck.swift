import Foundation

@main
struct MacStoreExportCheck {
    static func main() throws {
        let origin = URL(string: "http://127.0.0.1:8765/")!
        let path = "/api/download/" + String(repeating: "a", count: 32)
        let url = try StoreExportPolicy.requestURL(path, origin: origin)
        precondition(url.absoluteString == "http://127.0.0.1:8765" + path)
        for invalid in ["https://example.com" + path, "//example.com" + path, path + "?x=1", path + "\n", "/api/download/../workspace", "/api/workspace", path + "/file"] {
            do { _ = try StoreExportPolicy.requestURL(invalid, origin: origin); fatalError("Accepted invalid export: " + invalid) } catch {}
        }
        precondition(StoreExportPolicy.authorized(mainFrame: true, scheme: "http", host: "127.0.0.1", port: 8765, origin: origin))
        for input in [(false, "http", "127.0.0.1", 8765), (true, "https", "127.0.0.1", 8765), (true, "http", "example.com", 8765), (true, "http", "127.0.0.1", 8766)] {
            precondition(!StoreExportPolicy.authorized(mainFrame: input.0, scheme: input.1, host: input.2, port: input.3, origin: origin))
        }
        func response(_ filename: String, status: Int = 200, location: URL? = nil) -> HTTPURLResponse {
            HTTPURLResponse(url: location ?? url, statusCode: status, httpVersion: nil,
                headerFields: ["Content-Disposition": "attachment; filename=\"" + filename + "\""])!
        }
        for filename in ["demo.productiondesk", "demo-schedule.csv", "backup.json", "schedule.uss", "lined-script.pdf"] {
            let parsed = try StoreExportPolicy.filename(response: response(filename), expectedURL: url, bytes: 1024)
            precondition(parsed == filename)
        }
        for invalid in ["../private.csv", "dir/file.csv", "file\\name.csv", "payload.app", "line\nbreak.csv"] {
            do { _ = try StoreExportPolicy.filename(response: response(invalid), expectedURL: url, bytes: 1); fatalError("Accepted unsafe filename") } catch {}
        }
        for invalid in [(response("expired.csv", status: 404), 1), (response("large.csv"), StoreExportPolicy.maximumBytes + 1), (response("negative.csv"), -1), (response("redirect.csv", location: URL(string: "https://example.com/file")!), 1)] {
            do { _ = try StoreExportPolicy.filename(response: invalid.0, expectedURL: url, bytes: invalid.1); fatalError("Accepted invalid response") } catch {}
        }
        let script = StoreExportPolicy.metadataScript(version: "1.5.5", build: "25")
        precondition(script.contains("\"version\":\"1.5.5\"") && script.contains("\"build\":\"25\""))
        precondition(!script.contains("1.5.2"))
        print("Mac Store export policy passed: local origin/frame, token paths, filenames, response status/size, bundle metadata.")
    }
}

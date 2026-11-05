import AppKit
import Foundation

// Convert the approved full app artwork without redrawing, framing or cropping it.
guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: render-icon ICONSET_DIRECTORY PRODUCTION_DESK_PNG")
}
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
guard let artwork = NSImage(contentsOfFile: CommandLine.arguments[2]),
      artwork.size.width > 0, artwork.size.width == artwork.size.height else {
    fatalError("A square Production Desk app icon is required")
}
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
for (name, size) in [("icon_16x16",16),("icon_16x16@2x",32),("icon_32x32",32),("icon_32x32@2x",64),("icon_128x128",128),("icon_128x128@2x",256),("icon_256x256",256),("icon_256x256@2x",512),("icon_512x512",512),("icon_512x512@2x",1024)] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSGraphicsContext.current!.imageInterpolation = .high
    artwork.draw(in: NSRect(x: 0, y: 0, width: size, height: size),
                 from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!
        .write(to: directory.appendingPathComponent(name + ".png"))
}

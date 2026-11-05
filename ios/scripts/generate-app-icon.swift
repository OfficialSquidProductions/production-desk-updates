#!/usr/bin/env swift
// Scale the shared supplied artwork without cropping or redrawing it.
// iOS App Store icons must be opaque; only transparent pixels receive black.
import AppKit
import ImageIO
import UniformTypeIdentifiers
let script = URL(fileURLWithPath: #filePath).standardizedFileURL
let root = script.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
let source = root.appendingPathComponent("windows-src/desktop/assets/ProductionDesk.png")
let output = root.appendingPathComponent("ios/ProductionDesk/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
guard let input = CGImageSourceCreateWithURL(source as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(input, 0, nil), image.width == image.height,
      let space = CGColorSpace(name: CGColorSpace.sRGB),
      let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8,
                              bytesPerRow: 0, space: space,
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
    fatalError("Cannot read square canonical artwork or create opaque icon context")
}
context.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
context.interpolationQuality = .high
context.draw(image, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
guard let rendered = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("Cannot encode app icon")
}
CGImageDestinationAddImage(destination, rendered, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Cannot write app icon") }
print("Generated opaque 1024px iPhone/iPad icon: \(output.path)")

import AppKit
import Foundation

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
guard CommandLine.arguments.count > 2, let logo=NSImage(contentsOfFile:CommandLine.arguments[2]) else { fatalError("SP logo is required") }
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
for (name, size) in [("icon_16x16",16),("icon_16x16@2x",32),("icon_32x32",32),("icon_32x32@2x",64),("icon_128x128",128),("icon_128x128@2x",256),("icon_256x256",256),("icon_256x256@2x",512),("icon_512x512",512),("icon_512x512@2x",1024)] {
    let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
    let scale=CGFloat(size)/1024
    NSGraphicsContext.current!.cgContext.scaleBy(x:scale,y:scale)
    NSColor(calibratedWhite:1,alpha:1).setFill()
    NSBezierPath(roundedRect:NSRect(x:40,y:40,width:944,height:944),xRadius:205,yRadius:205).fill()
    // Draw the user's supplied transparent logo directly, preserving its proportions.
    logo.draw(in:NSRect(x:85,y:85,width:854,height:854),from:.zero,operation:.sourceOver,fraction:1)
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using:.png,properties:[:])!.write(to:directory.appendingPathComponent(name+".png"))
}

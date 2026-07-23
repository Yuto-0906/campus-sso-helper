import AppKit
import Foundation

struct SizeSpec {
    let name: String
    let width: Int
    let height: Int
    let deviceWidthRatio: CGFloat
}

struct Palette {
    static let ivory = NSColor(srgbRed: 0.969, green: 0.949, blue: 0.910, alpha: 1)
    static let cream = NSColor(srgbRed: 1.000, green: 0.988, blue: 0.969, alpha: 1)
    static let sand = NSColor(srgbRed: 0.847, green: 0.765, blue: 0.647, alpha: 1)
    static let cocoa = NSColor(srgbRed: 0.435, green: 0.306, blue: 0.216, alpha: 1)
    static let darkCocoa = NSColor(srgbRed: 0.141, green: 0.110, blue: 0.090, alpha: 1)
    static let muted = NSColor(srgbRed: 0.459, green: 0.412, blue: 0.369, alpha: 1)
}

final class Composer {
    let root: URL
    let spec: SizeSpec
    let width: CGFloat
    let height: CGFloat

    init(root: URL, spec: SizeSpec) {
        self.root = root
        self.spec = spec
        self.width = CGFloat(spec.width)
        self.height = CGFloat(spec.height)
    }

    private func image(_ relativePath: String) -> NSImage {
        let url = root.appendingPathComponent(relativePath)
        guard let image = NSImage(contentsOf: url) else {
            fatalError("Unable to load image: \(url.path)")
        }
        return image
    }

    private func rect(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) -> NSRect {
        NSRect(x: x, y: self.height - y - height, width: width, height: height)
    }

    private func roundedPath(_ topRect: NSRect, radius: CGFloat) -> NSBezierPath {
        NSBezierPath(
            roundedRect: rect(
                x: topRect.origin.x,
                y: topRect.origin.y,
                width: topRect.width,
                height: topRect.height
            ),
            xRadius: radius,
            yRadius: radius
        )
    }

    private func drawAspectFill(_ source: NSImage, in topRect: NSRect, fraction: CGFloat = 1) {
        let sourceSize = source.size
        let scale = max(topRect.width / sourceSize.width, topRect.height / sourceSize.height)
        let drawSize = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
        let drawRect = NSRect(
            x: topRect.midX - drawSize.width / 2,
            y: topRect.midY - drawSize.height / 2,
            width: drawSize.width,
            height: drawSize.height
        )
        source.draw(
            in: rect(x: drawRect.origin.x, y: drawRect.origin.y, width: drawRect.width, height: drawRect.height),
            from: .zero,
            operation: .sourceOver,
            fraction: fraction,
            respectFlipped: true,
            hints: [.interpolation: NSImageInterpolation.high]
        )
    }

    private func drawAspectFit(_ source: NSImage, in topRect: NSRect, fraction: CGFloat = 1) {
        let sourceSize = source.size
        let scale = min(topRect.width / sourceSize.width, topRect.height / sourceSize.height)
        let drawSize = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
        let drawRect = NSRect(
            x: topRect.midX - drawSize.width / 2,
            y: topRect.midY - drawSize.height / 2,
            width: drawSize.width,
            height: drawSize.height
        )
        source.draw(
            in: rect(x: drawRect.origin.x, y: drawRect.origin.y, width: drawRect.width, height: drawRect.height),
            from: .zero,
            operation: .sourceOver,
            fraction: fraction,
            respectFlipped: true,
            hints: [.interpolation: NSImageInterpolation.high]
        )
    }

    private func drawText(
        _ text: String,
        x: CGFloat,
        y: CGFloat,
        width: CGFloat,
        height: CGFloat,
        size: CGFloat,
        weight: NSFont.Weight,
        color: NSColor,
        lineHeight: CGFloat? = nil,
        alignment: NSTextAlignment = .left,
        kern: CGFloat = 0
    ) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = alignment
        paragraph.lineBreakMode = .byWordWrapping
        if let lineHeight {
            paragraph.minimumLineHeight = lineHeight
            paragraph.maximumLineHeight = lineHeight
        }
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: size, weight: weight),
            .foregroundColor: color,
            .paragraphStyle: paragraph,
            .kern: kern
        ]
        NSAttributedString(string: text, attributes: attributes).draw(
            with: rect(x: x, y: y, width: width, height: height),
            options: [.usesLineFragmentOrigin, .usesFontLeading]
        )
    }

    private func fillRounded(_ topRect: NSRect, radius: CGFloat, color: NSColor, shadow: Bool = false) {
        NSGraphicsContext.saveGraphicsState()
        if shadow {
            let shadowStyle = NSShadow()
            shadowStyle.shadowColor = NSColor.black.withAlphaComponent(0.18)
            shadowStyle.shadowBlurRadius = width * 0.025
            shadowStyle.shadowOffset = NSSize(width: 0, height: -height * 0.008)
            shadowStyle.set()
        }
        color.setFill()
        roundedPath(topRect, radius: radius).fill()
        NSGraphicsContext.restoreGraphicsState()
    }

    private func strokeRounded(_ topRect: NSRect, radius: CGFloat, color: NSColor, lineWidth: CGFloat) {
        color.setStroke()
        let path = roundedPath(topRect, radius: radius)
        path.lineWidth = lineWidth
        path.stroke()
    }

    private func drawImageCard(
        _ source: NSImage,
        in topRect: NSRect,
        radius: CGFloat,
        padding: CGFloat = 0,
        background: NSColor = Palette.cream,
        border: NSColor = Palette.sand
    ) {
        fillRounded(topRect, radius: radius, color: background, shadow: true)
        let content = NSRect(
            x: topRect.origin.x + padding,
            y: topRect.origin.y + padding,
            width: topRect.width - padding * 2,
            height: topRect.height - padding * 2
        )
        NSGraphicsContext.saveGraphicsState()
        roundedPath(content, radius: max(8, radius - padding)).addClip()
        drawAspectFit(source, in: content)
        NSGraphicsContext.restoreGraphicsState()
        strokeRounded(topRect, radius: radius, color: border.withAlphaComponent(0.82), lineWidth: max(2, width * 0.002))
    }

    private func drawDevice(_ source: NSImage, x: CGFloat, y: CGFloat, deviceWidth: CGFloat) {
        let ratio = source.size.height / source.size.width
        let deviceHeight = deviceWidth * ratio
        let bezel = max(16, deviceWidth * 0.018)
        let outer = NSRect(x: x, y: y, width: deviceWidth, height: deviceHeight)
        fillRounded(outer, radius: deviceWidth * 0.105, color: Palette.darkCocoa, shadow: true)
        let screen = NSRect(
            x: x + bezel,
            y: y + bezel,
            width: deviceWidth - bezel * 2,
            height: deviceHeight - bezel * 2
        )
        NSGraphicsContext.saveGraphicsState()
        roundedPath(screen, radius: deviceWidth * 0.088).addClip()
        drawAspectFill(source, in: screen)
        NSGraphicsContext.restoreGraphicsState()
        strokeRounded(screen, radius: deviceWidth * 0.088, color: NSColor.white.withAlphaComponent(0.22), lineWidth: max(2, width * 0.002))
    }

    private func drawPill(_ text: String, x: CGFloat, y: CGFloat, width: CGFloat, fill: NSColor, textColor: NSColor) {
        let pillHeight = max(70, self.width * 0.063)
        fillRounded(NSRect(x: x, y: y, width: width, height: pillHeight), radius: pillHeight / 2, color: fill)
        drawText(
            text,
            x: x,
            y: y + pillHeight * 0.22,
            width: width,
            height: pillHeight * 0.62,
            size: pillHeight * 0.34,
            weight: .semibold,
            color: textColor,
            alignment: .center
        )
    }

    private func drawBrandMark(dark: Bool) {
        let icon = image("Sources/app-icon.png")
        let iconSize = min(width * 0.105, 150)
        let margin = width * 0.085
        let iconRect = NSRect(x: margin, y: height * 0.055, width: iconSize, height: iconSize)
        NSGraphicsContext.saveGraphicsState()
        roundedPath(iconRect, radius: iconSize * 0.23).addClip()
        drawAspectFill(icon, in: iconRect)
        NSGraphicsContext.restoreGraphicsState()
        drawText(
            "非公式Safari機能拡張",
            x: margin + iconSize + width * 0.026,
            y: height * 0.071,
            width: width * 0.62,
            height: iconSize * 0.5,
            size: min(width * 0.025, 38),
            weight: .bold,
            color: dark ? Palette.ivory : Palette.cocoa,
            kern: width * 0.001
        )
    }

    private func makeBitmap() -> NSBitmapImageRep {
        guard let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: spec.width,
            pixelsHigh: spec.height,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bitmapFormat: [],
            bytesPerRow: 0,
            bitsPerPixel: 32
        ) else {
            fatalError("Unable to create bitmap")
        }
        bitmap.size = NSSize(width: spec.width, height: spec.height)
        return bitmap
    }

    private func render(background: String, drawing: () -> Void) -> NSBitmapImageRep {
        let bitmap = makeBitmap()
        guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
            fatalError("Unable to create graphics context")
        }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        Palette.ivory.setFill()
        NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()
        drawAspectFill(image(background), in: NSRect(x: 0, y: 0, width: width, height: height))
        drawing()
        context.flushGraphics()
        NSGraphicsContext.restoreGraphicsState()
        return bitmap
    }

    private func save(_ bitmap: NSBitmapImageRep, relativePath: String) {
        let output = root.appendingPathComponent(relativePath)
        try? FileManager.default.createDirectory(
            at: output.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        guard let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.98]) else {
            fatalError("Unable to encode JPEG")
        }
        try! data.write(to: output, options: .atomic)
    }

    func makeSlide1() {
        let dark = false
        let bitmap = render(background: "Backgrounds/01-hero.png") {
            drawBrandMark(dark: dark)
            let margin = width * 0.085
            let titleSize = min(width * 0.081, spec.name == "ipad-13" ? 126 : 108)
            drawText(
                "大学SSOを，\nもっとスムーズに。",
                x: margin,
                y: height * 0.145,
                width: width - margin * 2,
                height: height * 0.19,
                size: titleSize,
                weight: .heavy,
                color: Palette.darkCocoa,
                lineHeight: titleSize * 1.16
            )
            drawText(
                "繰り返すログイン操作を，すっきり短縮。",
                x: margin,
                y: height * 0.305,
                width: width - margin * 2,
                height: height * 0.05,
                size: min(width * 0.033, 52),
                weight: .medium,
                color: Palette.muted
            )
            let source = image("Sources/iphone-6.9-latest.png")
            let deviceWidth = width * spec.deviceWidthRatio
            drawDevice(
                source,
                x: (width - deviceWidth) / 2,
                y: height * 0.365,
                deviceWidth: deviceWidth
            )
        }
        save(bitmap, relativePath: "\(spec.name)/01-smooth-login.jpg")
    }

    func makeSlide2() {
        let bitmap = render(background: "Backgrounds/02-speed.png") {
            drawBrandMark(dark: true)
            let margin = width * 0.085
            let titleSize = min(width * 0.081, spec.name == "ipad-13" ? 126 : 108)
            drawText(
                "設定まで，\n迷わない。",
                x: margin,
                y: height * 0.145,
                width: width - margin * 2,
                height: height * 0.19,
                size: titleSize,
                weight: .heavy,
                color: Palette.cream,
                lineHeight: titleSize * 1.16
            )
            drawText(
                "Safari機能拡張の設定を，わかりやすく案内。",
                x: margin,
                y: height * 0.305,
                width: width - margin * 2,
                height: height * 0.06,
                size: min(width * 0.032, 50),
                weight: .medium,
                color: Palette.sand
            )

            let menu = image("Sources/setup-menu.png")
            let settings = image("Sources/setup-settings.png")
            if spec.name == "iphone-6.9" {
                let menuWidth = width * 0.84
                let menuHeight = menuWidth / (menu.size.width / menu.size.height)
                drawImageCard(
                    menu,
                    in: NSRect(x: width * 0.08, y: height * 0.385, width: menuWidth, height: menuHeight),
                    radius: width * 0.04,
                    padding: width * 0.018
                )
                let settingsWidth = width * 0.67
                let settingsHeight = settingsWidth / (settings.size.width / settings.size.height)
                drawImageCard(
                    settings,
                    in: NSRect(x: width * 0.25, y: height * 0.60, width: settingsWidth, height: settingsHeight),
                    radius: width * 0.05,
                    padding: width * 0.018
                )
            } else {
                let menuWidth = width * 0.64
                let menuHeight = menuWidth / (menu.size.width / menu.size.height)
                drawImageCard(
                    menu,
                    in: NSRect(x: width * 0.08, y: height * 0.38, width: menuWidth, height: menuHeight),
                    radius: width * 0.03,
                    padding: width * 0.012
                )
                let settingsWidth = width * 0.42
                let settingsHeight = settingsWidth / (settings.size.width / settings.size.height)
                drawImageCard(
                    settings,
                    in: NSRect(x: width * 0.50, y: height * 0.53, width: settingsWidth, height: settingsHeight),
                    radius: width * 0.035,
                    padding: width * 0.012
                )
            }
        }
        save(bitmap, relativePath: "\(spec.name)/02-easy-setup.jpg")
    }

    func makeSlide3() {
        let bitmap = render(background: "Backgrounds/03-privacy.png") {
            drawBrandMark(dark: false)
            let margin = width * 0.085
            let titleSize = min(width * 0.081, spec.name == "ipad-13" ? 126 : 108)
            drawText(
                "資格情報は，\n端末内だけ。",
                x: margin,
                y: height * 0.145,
                width: width - margin * 2,
                height: height * 0.19,
                size: titleSize,
                weight: .heavy,
                color: Palette.darkCocoa,
                lineHeight: titleSize * 1.16
            )
            drawText(
                "開発者のサーバーへ送信しません。",
                x: margin,
                y: height * 0.305,
                width: width - margin * 2,
                height: height * 0.055,
                size: min(width * 0.033, 52),
                weight: .medium,
                color: Palette.muted
            )

            let credentials = image("Sources/setup-credentials.png")
            let cardWidth = width * (spec.name == "iphone-6.9" ? 0.76 : 0.48)
            let cardHeight = cardWidth / (credentials.size.width / credentials.size.height)
            drawImageCard(
                credentials,
                in: NSRect(
                    x: (width - cardWidth) / 2,
                    y: height * 0.385,
                    width: cardWidth,
                    height: cardHeight
                ),
                radius: width * 0.045,
                padding: width * 0.016
            )

            let pillY = min(height * 0.82, height * 0.385 + cardHeight + height * 0.045)
            let gap = width * 0.025
            let pillWidth = (width - margin * 2 - gap) / 2
            drawPill(
                "広告なし",
                x: margin,
                y: pillY,
                width: pillWidth,
                fill: Palette.cream.withAlphaComponent(0.94),
                textColor: Palette.cocoa
            )
            drawPill(
                "追跡なし",
                x: margin + pillWidth + gap,
                y: pillY,
                width: pillWidth,
                fill: Palette.cream.withAlphaComponent(0.94),
                textColor: Palette.cocoa
            )
            drawText(
                "Safari機能拡張のローカル領域に保存",
                x: margin,
                y: pillY + width * 0.085,
                width: width - margin * 2,
                height: width * 0.06,
                size: min(width * 0.026, 40),
                weight: .semibold,
                color: Palette.muted,
                alignment: .center
            )
        }
        save(bitmap, relativePath: "\(spec.name)/03-local-privacy.jpg")
    }

    func makeSlide4() {
        let bitmap = render(background: "Backgrounds/04-steps.png") {
            drawBrandMark(dark: false)
            let margin = width * 0.085
            let titleSize = min(width * 0.081, spec.name == "ipad-13" ? 126 : 108)
            drawText(
                "4ステップで，\nすぐ使える。",
                x: margin,
                y: height * 0.145,
                width: width - margin * 2,
                height: height * 0.19,
                size: titleSize,
                weight: .heavy,
                color: Palette.darkCocoa,
                lineHeight: titleSize * 1.16
            )
            drawText(
                "実際の画面を見ながら設定できます。",
                x: margin,
                y: height * 0.305,
                width: width - margin * 2,
                height: height * 0.055,
                size: min(width * 0.033, 52),
                weight: .medium,
                color: Palette.muted
            )

            let source = image("Sources/iphone-6.9-latest.png")
            let deviceWidth = width * spec.deviceWidthRatio
            drawDevice(
                source,
                x: (width - deviceWidth) / 2,
                y: height * 0.37,
                deviceWidth: deviceWidth
            )
        }
        save(bitmap, relativePath: "\(spec.name)/04-four-steps.jpg")
    }
}

let fileURL = URL(fileURLWithPath: #filePath)
let root = fileURL.deletingLastPathComponent()
let specs = [
    SizeSpec(name: "iphone-6.9", width: 1320, height: 2868, deviceWidthRatio: 0.78),
    SizeSpec(name: "ipad-13", width: 2064, height: 2752, deviceWidthRatio: 0.48)
]

for spec in specs {
    let composer = Composer(root: root, spec: spec)
    composer.makeSlide1()
    composer.makeSlide2()
    composer.makeSlide3()
    composer.makeSlide4()
    print("Rendered \(spec.name)")
}

import Foundation
import Vision
import AppKit

// Usage: ocr <image1> [image2 ...]
// Emits a JSON array: [{"file":"...","text":"..."}, ...]
// Recognition happens fully on-device via the macOS Vision framework.

let args = Array(CommandLine.arguments.dropFirst())

if args.isEmpty {
    FileHandle.standardError.write("usage: ocr <image> [image ...]\n".data(using: .utf8)!)
    exit(2)
}

struct Entry: Codable {
    let file: String
    let text: String
    let error: String?
}

var out: [Entry] = []

for path in args {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        out.append(Entry(file: path, text: "", error: "cannot-load-image"))
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = false
    request.recognitionLanguages = ["en-US"]

    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do {
        try handler.perform([request])
        var lines: [String] = []
        for obs in (request.results ?? []) {
            if let candidate = obs.topCandidates(1).first {
                lines.append(candidate.string)
            }
        }
        out.append(Entry(file: path, text: lines.joined(separator: "\n"), error: nil))
    } catch {
        out.append(Entry(file: path, text: "", error: "\(error)"))
    }
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]
let data = try! encoder.encode(out)
FileHandle.standardOutput.write(data)

'use strict';

// Free, on-device OCR via the compiled Swift binary (Apple Vision).
// No network, no tokens, ~30ms per question image.

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);

function ocrBinaryPath() {
  if (process.env.NPTEL_QUIZ_OCR) return process.env.NPTEL_QUIZ_OCR;
  return path.join(__dirname, '..', 'bin', 'ocr');
}

function decodeDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  return Buffer.from(payload, isBase64 ? 'base64' : 'utf8');
}

/**
 * OCR a list of image data URLs (or raw base64 strings).
 * @param {string[]} images
 * @returns {Promise<string[]>} recognized text, aligned to the input order
 */
async function ocrImages(images) {
  if (!images || images.length === 0) return [];

  const bin = ocrBinaryPath();
  if (!fs.existsSync(bin)) {
    throw new Error(
      `OCR binary not found at ${bin}. Run "npm run build:ocr" (needs Xcode CLT).`
    );
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nptel-quiz-ocr-'));
  try {
    const paths = images.map((img, i) => {
      const p = path.join(tmp, `q${String(i + 1).padStart(3, '0')}.png`);
      fs.writeFileSync(p, decodeDataUrl(img));
      return p;
    });

    const { stdout } = await execFileAsync(bin, paths, {
      maxBuffer: 32 * 1024 * 1024
    });

    const parsed = JSON.parse(stdout.toString('utf8'));
    return images.map((_, i) => {
      const entry = parsed[i];
      if (!entry) return '';
      if (entry.error) throw new Error(`OCR failed for image ${i + 1}: ${entry.error}`);
      return entry.text;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { ocrImages, ocrBinaryPath };

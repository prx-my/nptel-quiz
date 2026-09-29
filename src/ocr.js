'use strict';

// Platform-dispatched, on-device OCR. Exactly one backend per OS:
//   darwin  -> Apple Vision (native/ocr.swift compiled to bin/ocr)
//   win32   -> Windows.Media.Ocr (native/ocr.ps1, built into Windows)
// No backend ever runs on the wrong OS, so they cannot collide.

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);
const ROOT = path.join(__dirname, '..');

/**
 * @returns {{name:string, kind:'binary'|'powershell', path:string}|null}
 */
function ocrBackend() {
  if (process.platform === 'darwin') {
    return {
      name: 'vision',
      kind: 'binary',
      path: process.env.NPTEL_QUIZ_OCR || path.join(ROOT, 'bin', 'ocr')
    };
  }
  if (process.platform === 'win32') {
    return {
      name: 'winrt',
      kind: 'powershell',
      path: process.env.NPTEL_QUIZ_OCR || path.join(ROOT, 'native', 'ocr.ps1')
    };
  }
  return null;
}

/** Readiness of the OCR backend for the current OS. */
function ocrReady() {
  const backend = ocrBackend();
  if (!backend) {
    return { ok: false, backend: null, reason: `no on-device OCR backend for ${process.platform}` };
  }
  if (!fs.existsSync(backend.path)) {
    return { ok: false, backend, reason: `missing ${backend.path}` };
  }
  return { ok: true, backend };
}

function decodeDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  return Buffer.from(payload, isBase64 ? 'base64' : 'utf8');
}

async function runBackend(backend, paths) {
  let stdout;
  if (backend.kind === 'binary') {
    ({ stdout } = await execFileAsync(backend.path, paths, { maxBuffer: 32 * 1024 * 1024 }));
  } else {
    const ps = process.env.NPTEL_QUIZ_POWERSHELL || 'powershell';
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', backend.path, ...paths];
    ({ stdout } = await execFileAsync(ps, args, { maxBuffer: 32 * 1024 * 1024, windowsHide: true }));
  }
  const parsed = JSON.parse(stdout.toString('utf8'));
  return Array.isArray(parsed) ? parsed : [parsed];
}

/**
 * OCR a list of image data URLs (or raw base64 strings).
 * @param {string[]} images
 * @returns {Promise<string[]>} recognized text, aligned to the input order
 */
async function ocrImages(images) {
  if (!images || images.length === 0) return [];

  const ready = ocrReady();
  if (!ready.ok) {
    throw new Error(
      `OCR unavailable: ${ready.reason}.\n` +
        (process.platform === 'darwin'
          ? 'Build it with: npm run build:ocr  (needs: xcode-select --install)'
          : 'Windows should include Windows.Media.Ocr; ensure a language pack is installed.')
    );
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nptel-quiz-ocr-'));
  try {
    const paths = images.map((img, i) => {
      const p = path.join(tmp, `q${String(i + 1).padStart(3, '0')}.png`);
      fs.writeFileSync(p, decodeDataUrl(img));
      return p;
    });

    const parsed = await runBackend(ready.backend, paths);

    return images.map((_, i) => {
      const entry = parsed[i];
      if (!entry) return '';
      if (entry.error) throw new Error(`OCR failed for image ${i + 1}: ${entry.error}`);
      return entry.text || '';
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { ocrImages, ocrBackend, ocrReady };

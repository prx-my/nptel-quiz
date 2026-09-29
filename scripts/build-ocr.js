#!/usr/bin/env node
'use strict';

// Compiles native/ocr.swift -> bin/ocr using the macOS toolchain.
// Runs on `npm install` (postinstall). Safe to re-run.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'native', 'ocr.swift');
const outDir = path.join(root, 'bin');
const out = path.join(outDir, 'ocr');

function log(msg) {
  process.stdout.write(`[nptel-quiz] ${msg}\n`);
}

if (process.platform === 'win32') {
  const ps1 = path.join(root, 'native', 'ocr.ps1');
  if (!fs.existsSync(ps1)) {
    log(`Missing Windows OCR script: ${ps1}`);
    process.exit(1);
  }
  log('Windows: using the built-in Windows.Media.Ocr engine (native/ocr.ps1). No build required.');
  process.exit(0);
}

if (process.platform !== 'darwin') {
  log(`${process.platform}: no on-device OCR backend available; the OCR step is disabled.`);
  process.exit(0);
}

if (!fs.existsSync(src)) {
  log(`Missing source: ${src}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// Prefer an already-built, up-to-date binary.
if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) {
  log('bin/ocr already up to date.');
  process.exit(0);
}

// Prefer swiftc on PATH (usually the Xcode toolchain); fall back to xcrun.
let compiler = null;
const which = spawnSync('which', ['swiftc'], { encoding: 'utf8' });
if (which.status === 0 && which.stdout.trim()) {
  compiler = which.stdout.trim();
}
if (!compiler) {
  const x = spawnSync('xcrun', ['--find', 'swiftc'], { encoding: 'utf8' });
  if (x.status === 0 && x.stdout.trim()) compiler = x.stdout.trim();
}
if (!compiler) {
  log('swiftc not found. Install the Xcode Command Line Tools:');
  log('  xcode-select --install');
  // Don't hard-fail the whole npm install; OCR can be built later.
  process.exit(0);
}

log(`Compiling native OCR (Apple Vision) with ${compiler}...`);

const args = [
  '-O',
  '-o', out,
  src,
  '-framework', 'Vision',
  '-framework', 'AppKit',
  '-framework', 'Foundation'
];

const res = spawnSync(compiler, args, { stdio: 'inherit' });
if (res.status !== 0) {
  log('Failed to compile bin/ocr. Run again after installing Xcode CLT.');
  process.exit(1);
}

fs.chmodSync(out, 0o755);
log('Built bin/ocr.');

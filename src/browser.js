'use strict';

// Persistent-context browser helper. Log in once, reuse the profile forever.
// Playwright is loaded lazily so `doctor` can report a missing install cleanly.

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_COURSE_URL =
  process.env.NPTEL_QUIZ_COURSE_URL ||
  'https://onlinecourses.nptel.ac.in/e-learning/course/noc26_cs153';

const INSTALL_HINT =
  'Playwright/Chromium is not ready. Fix it with:\n' +
  '  nptel-quiz doctor --fix\n' +
  'or manually:\n' +
  '  npm install\n' +
  '  npx playwright install chromium';

function profileDir() {
  return (
    process.env.NPTEL_QUIZ_PROFILE ||
    path.join(os.homedir(), '.nptel-quiz', 'profile')
  );
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const err = new Error('The "playwright" package is not installed.\n\n' + INSTALL_HINT);
    err.code = 'PLAYWRIGHT_MISSING';
    throw err;
  }
}

/**
 * Check whether Playwright and its Chromium browser are installed.
 * @returns {{ok: boolean, playwright: boolean, chromium: boolean, executablePath?: string, reason?: string}}
 */
function checkPlaywright() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    return { ok: false, playwright: false, chromium: false, reason: 'playwright package not installed' };
  }
  let exe;
  try {
    exe = chromium.executablePath();
  } catch {
    return { ok: false, playwright: true, chromium: false, reason: 'cannot resolve Chromium path' };
  }
  if (!exe || !fs.existsSync(exe)) {
    return {
      ok: false,
      playwright: true,
      chromium: false,
      executablePath: exe,
      reason: 'Chromium browser not downloaded'
    };
  }
  return { ok: true, playwright: true, chromium: true, executablePath: exe };
}

function launchOptions(opts = {}) {
  const headless = opts.headless !== undefined ? opts.headless : true;
  const args = ['--no-first-run', '--no-default-browser-check'];
  return {
    headless,
    args,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: false
  };
}

/**
 * Launch a persistent Chromium context (shares the saved login profile).
 * @param {object} [opts] { headless?: boolean, channel?: string }
 */
async function launch(opts = {}) {
  const { chromium } = loadPlaywright();

  const check = checkPlaywright();
  if (!check.ok) throw new Error(check.reason + '.\n\n' + INSTALL_HINT);

  const dir = profileDir();
  fs.mkdirSync(dir, { recursive: true });
  const options = launchOptions(opts);
  if (opts.channel) options.channel = opts.channel;

  try {
    const context = await chromium.launchPersistentContext(dir, options);
    context.setDefaultTimeout(20000);
    context.setDefaultNavigationTimeout(45000);
    return context;
  } catch (err) {
    const msg = String(err && err.message);
    if (/Executable doesn't exist|download new browsers|playwright install/i.test(msg)) {
      throw new Error('Chromium is missing or out of date.\n\n' + INSTALL_HINT);
    }
    throw err;
  }
}

async function isLoggedIn(context) {
  const page = context.pages()[0] || (await context.newPage());
  try {
    await page.goto(DEFAULT_COURSE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const signedOut = await page
      .locator('button:has-text("Sign In")')
      .count()
      .catch(() => 0);
    return signedOut === 0;
  } catch {
    return false;
  }
}

module.exports = {
  launch,
  isLoggedIn,
  profileDir,
  checkPlaywright,
  loadPlaywright,
  DEFAULT_COURSE_URL,
  launchOptions,
  INSTALL_HINT
};

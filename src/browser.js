'use strict';

// Persistent-context browser helper. Log in once, reuse the profile forever.

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_COURSE_URL =
  process.env.NPTEL_QUIZ_COURSE_URL ||
  'https://onlinecourses.nptel.ac.in/e-learning/course/noc26_cs153';

function profileDir() {
  return (
    process.env.NPTEL_QUIZ_PROFILE ||
    path.join(os.homedir(), '.nptel-quiz', 'profile')
  );
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
  const dir = profileDir();
  fs.mkdirSync(dir, { recursive: true });
  const options = launchOptions(opts);
  if (opts.channel) options.channel = opts.channel;
  const context = await chromium.launchPersistentContext(dir, options);
  context.setDefaultTimeout(20000);
  context.setDefaultNavigationTimeout(45000);
  return context;
}

async function isLoggedIn(context) {
  const page = context.pages()[0] || (await context.newPage());
  try {
    await page.goto(DEFAULT_COURSE_URL, { waitUntil: 'domcontentloaded' });
    // Give the SPA a moment to hydrate.
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

module.exports = { launch, isLoggedIn, profileDir, DEFAULT_COURSE_URL, launchOptions };

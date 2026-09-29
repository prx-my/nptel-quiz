#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const nq = require('../src');
const { DEFAULT_COURSE_URL } = require('../src/browser');

const pkg = require('../package.json');

const HELP = `
nptel-quiz v${pkg.version} — OCR + auto-answer for NPTEL image quizzes (macOS)

Usage:
  nptel-quiz login   [--course <url>] [--channel chrome]
  nptel-quiz ocr     --url <quizUrl> [--json <file>] [--headless]
  nptel-quiz submit  --url <quizUrl> --answers "a,b,c" [--dry-run] [--headless]
  nptel-quiz run     --url <quizUrl> [--provider gemini|opencode] [--model <m>]
                     [--answers "a,b,c"] [--dry-run] [--headless]

Options:
  --url <quizUrl>     Quiz page URL, e.g.
                      https://onlinecourses.nptel.ac.in/e-learning/course/<course>?unitId=<u>&assessmentId=<id>
  --provider <name>   gemini (default) calls the Gemini API with GEMINI_API_KEY.
                      opencode/none does no API call — pair with "ocr" + "submit".
  --answers <list>    Answers per question, comma-separated.
                      MSQ: join multiple options with "+" (e.g. "a+c,b,d").
  --json <file>       Write the OCR'd questions as JSON.
  --dry-run           Select options but do NOT click Submit.
  --headless          Run the browser headless (default for non-login commands).
  --channel <name>    Use an installed browser, e.g. "chrome".

Environment:
  GEMINI_API_KEY      Required for --provider gemini.
  NPTEL_QUIZ_PROFILE  Override the browser profile dir (~/.nptel-quiz/profile).
  NPTEL_QUIZ_OCR      Override the OCR binary path.
  NPTEL_QUIZ_GEMINI_MODEL  Override the Gemini model (default gemini-2.5-flash).

Examples:
  nptel-quiz login
  nptel-quiz run --url "https://.../?unitId=98&assessmentId=763"
  nptel-quiz ocr --url "https://.../?" | pbcopy      # let an agent answer
  nptel-quiz submit --url "https://.../?" --answers "b,a,b,a,c,d,b,a,b,a"
`;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key === 'help' || key === 'version' || key === 'json' || key === 'dry-run' || key === 'headless') {
        if (key === 'json') {
          const next = argv[i + 1];
          if (next && !next.startsWith('--')) {
            out.json = next;
            i++;
          } else {
            out.json = true;
          }
        } else {
          out[key] = true;
        }
      } else {
        out[key] = argv[i + 1];
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function parseAnswers(str) {
  if (!str) return null;
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length)
    .map((token) =>
      token
        .split('+')
        .map((x) => x.trim())
        .filter(Boolean)
    );
}

function loadAnswersFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const arr = Array.isArray(data) ? data : data.answers;
  if (!Array.isArray(arr)) throw new Error('answers file must be an array or {answers:[...]}');
  return arr.map((a) => (Array.isArray(a) ? a.map(String) : [String(a)]));
}

async function withContext(opts, fn) {
  const context = await nq.launch({ headless: opts.headless !== false });
  try {
    return await fn(context);
  } finally {
    await context.close();
  }
}

async function cmdLogin(opts) {
  const url = opts.course || DEFAULT_COURSE_URL;
  const context = await nq.launch({ headless: false, channel: opts.channel });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  process.stdout.write(
    '\nA browser window is open. Sign in to NPTEL (Google SSO) there.\n' +
      'Waiting for sign-in to complete...\n'
  );

  const deadline = Date.now() + 5 * 60 * 1000;
  let ok = false;
  while (Date.now() < deadline) {
    const signedOut = await page
      .locator('button:has-text("Sign In")')
      .count()
      .catch(() => 1);
    if (signedOut === 0) {
      ok = true;
      break;
    }
    await page.waitForTimeout(2500);
  }

  if (ok) {
    process.stdout.write(`Signed in. Profile saved at ${nq.profileDir()}\n`);
  } else {
    process.stdout.write('Timed out waiting for sign-in. Re-run "nptel-quiz login".\n');
  }
  await context.close();
  process.exit(ok ? 0 : 1);
}

async function cmdOcr(opts) {
  if (!opts.url) throw new Error('--url is required');
  return withContext(opts, async (context) => {
    const { title, type, questions } = await nq.ocrQuiz(context, opts.url);
    process.stdout.write(`# ${title}  (${type}, ${questions.length} questions)\n\n`);
    questions.forEach((q, i) => {
      process.stdout.write(`[Q${i + 1}]\n${q}\n\n`);
    });
    if (opts.json) {
      const payload = { title, type, questions };
      if (opts.json === true) {
        process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      } else {
        fs.writeFileSync(opts.json, JSON.stringify(payload, null, 2));
        process.stdout.write(`Wrote ${opts.json}\n`);
      }
    }
  });
}

async function cmdSubmit(opts) {
  if (!opts.url) throw new Error('--url is required');
  const answers = opts['answers-file']
    ? loadAnswersFile(opts['answers-file'])
    : parseAnswers(opts.answers);
  if (!answers) throw new Error('--answers or --answers-file is required');
  return withContext(opts, async (context) => {
    const res = await nq.submitAnswers(context, {
      url: opts.url,
      answers,
      dryRun: !!opts['dry-run']
    });
    process.stdout.write(
      `${res.title}\n${opts['dry-run'] ? 'Selected (dry-run)' : 'Submitted'}: ` +
        res.selected.map((s) => s.letters.join('+')).join(',') +
        '\n'
    );
  });
}

async function cmdRun(opts) {
  if (!opts.url) throw new Error('--url is required');
  const answers = parseAnswers(opts.answers);
  return withContext(opts, async (context) => {
    const res = await nq.runQuiz(context, {
      url: opts.url,
      provider: opts.provider || (answers ? 'none' : 'gemini'),
      answers,
      model: opts.model,
      dryRun: !!opts['dry-run']
    });
    const summary = res.answers.map((a) => (Array.isArray(a) ? a.join('+') : a)).join(',');
    process.stdout.write(
      `${res.title}\n${opts['dry-run'] ? 'Selected (dry-run)' : 'Submitted'}: ${summary}\n`
    );
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.version) {
    process.stdout.write(pkg.version + '\n');
    return;
  }
  const cmd = opts._[0];
  if (!cmd || opts.help) {
    process.stdout.write(HELP);
    return;
  }
  switch (cmd) {
    case 'login':
      return cmdLogin(opts);
    case 'ocr':
      return cmdOcr(opts);
    case 'submit':
      return cmdSubmit(opts);
    case 'run':
      return cmdRun(opts);
    default:
      process.stderr.write(`Unknown command "${cmd}"\n${HELP}`);
      process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});

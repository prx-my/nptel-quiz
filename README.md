# nptel-quiz

**OCR + auto-answer pipeline for NPTEL image quizzes (macOS).**

NPTEL quizzes render every question (and its options) as an image, leaving only
`a. b. c. d.` and radio buttons in the DOM. `nptel-quiz` reads those images with
**on-device Apple Vision OCR** (free, private, ~30 ms/question), then answers them
with a pluggable engine:

- **opencode / agent mode** — the agent answers; no API key, no tokens.
- **Gemini** — one batched API call per quiz with your own `GEMINI_API_KEY`.

## Install (one line)

```bash
curl -fsSL https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.sh | bash
```

The installer:

1. checks macOS + Node.js (installs Node via Homebrew if needed),
2. downloads the tool to `~/.nptel-quiz`,
3. installs dependencies + Playwright's Chromium,
4. compiles the native OCR binary with `swiftc`,
5. links the `nptel-quiz` command onto your `PATH`.

> Requires the **Xcode Command Line Tools** for `swiftc` (`xcode-select --install`).

## Quick start

```bash
# 1) Sign in to NPTEL once (Google SSO). The session is saved.
nptel-quiz login

# 2) Fully automatic with Gemini
export GEMINI_API_KEY=your-key
nptel-quiz run --url "https://onlinecourses.nptel.ac.in/e-learning/course/noc26_cs153?unitId=98&assessmentId=763"
```

## Commands

| Command | Description |
|---|---|
| `nptel-quiz login` | Open a browser and save the NPTEL login session. |
| `nptel-quiz ocr --url <u>` | Print OCR'd questions (`[Q1] ...`). Use `--json <f>` to save. |
| `nptel-quiz submit --url <u> --answers "a,b,c"` | Select + submit answers. |
| `nptel-quiz run --url <u> [--provider gemini]` | Full loop: OCR → answer → submit. |

Common flags: `--dry-run` (select but don't submit), `--headless`, `--channel chrome`, `--model <gemini-model>`.

Answer format: one letter per question, comma-separated. For multi-select (MSQ)
join a question's choices with `+`, e.g. `--answers "a+c,b,d"`.

**Quizzes use `assessmentId`** — programming assignments use `progassignmentId`.
A wrong param silently loads the last-viewed quiz, so always check the printed title.

## Agent / opencode flow

When the loop runs inside an agent, skip the API entirely:

```bash
nptel-quiz ocr --url "<quizUrl>" --json /tmp/quiz.json   # agent reads questions
# ... agent decides answers ...
nptel-quiz submit --url "<quizUrl>" --answers "b,a,b,a,c,d,b,a,b,a"
```

A ready-made skill lives in [`skill/nptel-quiz/SKILL.md`](skill/nptel-quiz/SKILL.md).

## Library / SDK

```js
const nq = require('nptel-quiz');

const ctx = await nq.launch({ headless: true });
try {
  const { title, questions } = await nq.ocrQuiz(ctx, url);   // OCR only
  const res = await nq.runQuiz(ctx, { url, provider: 'gemini' });
  console.log(res.submitted);
} finally {
  await ctx.close();
}
```

Exports: `launch`, `isLoggedIn`, `profileDir`, `extractQuiz`, `selectAnswers`,
`ocrImages`, `ocrQuiz`, `runQuiz`, `submitAnswers`, `getAnswerProvider`.

## Cost (measured)

Per quiz of 10 questions: OCR = **$0** (~29 tokens/question of text), and a single
batched answer call is **~365 tokens** total — a few hundredths of a cent on any
cheap text model, versus ~2,000+ vision tokens if you sent the images directly.

## Configuration

| Env var | Purpose |
|---|---|
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Key for `--provider gemini`. |
| `NPTEL_QUIZ_GEMINI_MODEL` | Gemini model (default `gemini-2.5-flash`). |
| `NPTEL_QUIZ_PROFILE` | Browser profile dir (default `~/.nptel-quiz/profile`). |
| `NPTEL_QUIZ_OCR` | Path to the OCR binary. |
| `NPTEL_QUIZ_COURSE_URL` | Default course URL used by `login`. |

## How it works

1. **Extract** — pull base64 question PNGs and the radio/checkbox groups from the page.
2. **OCR** — decode images to a temp dir, run the Swift/Apple Vision binary (JSON out).
3. **Answer** — Gemini (batched) or the calling agent.
4. **Submit** — map letters to input indices (using per-question option counts), `check()` them, click **Submit Answers**.

## License

MIT. For your own enrolled courses — respect NPTEL's academic-integrity policy.

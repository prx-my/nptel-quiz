# nptel-quiz

**OCR + auto-answer pipeline for NPTEL image quizzes (macOS).**

NPTEL quizzes render every question (and its options) as an image, leaving only
`a. b. c. d.` and radio buttons in the DOM. `nptel-quiz` reads those images with
**on-device Apple Vision OCR** (free, private, ~30 ms/question), then answers them
with a pluggable engine:

- **opencode / agent mode** — the agent answers; no API key, no tokens.
- **Gemini** — one batched API call per quiz with your own `GEMINI_API_KEY`.

## Install (one line)

**macOS**
```bash
curl -fsSL https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.sh | bash
```

**Windows** (PowerShell)
```powershell
powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.ps1 | iex"
```

OCR is **on-device and per-OS — the two engines never collide**:

| OS | OCR engine | Build needed |
|---|---|---|
| macOS | Apple **Vision** (`native/ocr.swift` → `bin/ocr`) | yes (`swiftc`, via Xcode CLT) |
| Windows | **Windows.Media.Ocr** (`native/ocr.ps1`) | no — built into Windows 10/11 |

The installer:

1. checks macOS + Node.js (installs Node via Homebrew if needed),
2. downloads the tool to `~/.nptel-quiz`,
3. installs dependencies + Playwright's Chromium,
4. compiles the native OCR binary with `swiftc`,
5. links the `nptel-quiz` command onto your `PATH`.

> macOS requires the **Xcode Command Line Tools** for `swiftc` (`xcode-select --install`).
> Windows needs no OCR build — it uses the built-in `Windows.Media.Ocr` engine
> (ensure a language with OCR support is installed, e.g. English).

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
| `nptel-quiz list --course <c>` | List weeks + quizzes with `done`/`TODO` status and URLs. |
| `nptel-quiz doctor [--fix]` | Check Node/Playwright/Chromium/OCR/login; `--fix` installs what's missing. |
| `nptel-quiz install-skill [--global]` | Install the Antigravity/agent skill. |

Common flags: `--dry-run` (select but don't submit), `--headless`, `--channel chrome`, `--model <gemini-model>`.

Answer format: one letter per question, comma-separated. For multi-select (MSQ)
join a question's choices with `+`, e.g. `--answers "a+c,b,d"`.

**Quizzes use `assessmentId`** — programming assignments use `progassignmentId`.
A wrong param silently loads the last-viewed quiz, so always check the printed title.

## One-prompt setup (Antigravity / any agent)

Paste this repo's URL into your agent and say **"setup"**. The agent follows
[`AGENTS.md`](AGENTS.md) / the skill and will:

1. run the installer,
2. `nptel-quiz doctor --fix` to guarantee Playwright + Chromium + OCR,
3. `nptel-quiz login` (you complete Google SSO once),
4. `nptel-quiz list --course <id>` and **ask which week to proceed with**,
5. solve the chosen week: `ocr` → (agent answers) → `submit`.

```bash
nptel-quiz list --course noc26_cs153
# Course: noc26_cs153
# Week 7 :  (unitId=66)
#   [TODO] quiz  Quiz: Week 7 : Assignment 7  (assessmentId=753)
#         https://.../noc26_cs153?unitId=66&assessmentId=753
# Week 8 :  (unitId=74)  ...
```

## Agent integration (Antigravity, opencode, …)

If an agent is driving, skip the API key entirely — the agent's own model answers:

```bash
nptel-quiz ocr --url "<quizUrl>" --json /tmp/quiz.json   # agent reads questions
# ... agent decides answers ...
nptel-quiz submit --url "<quizUrl>" --answers "b,a,b,a,c,d,b,a,b,a"
```

### Google Antigravity

Antigravity already ships Gemini Flash, so use it as the answer engine — no
`GEMINI_API_KEY` needed. Install the skill (it follows the Agent Skills standard):

```bash
nptel-quiz install-skill            # workspace: ./.agents/skills/nptel-quiz/
nptel-quiz install-skill --global   # all workspaces: ~/.gemini/config/skills/nptel-quiz/
```

Then in Antigravity, open the **Customizations** panel (or run `/skills`) to
confirm `nptel-quiz` is listed, and paste a quiz URL + "solve this quiz". The
agent will OCR via the CLI, answer with its Flash model, and submit.

> Skill paths: workspace `./.agents/skills/<name>/SKILL.md`; global
> `~/.gemini/config/skills/<name>/SKILL.md` (legacy `~/.gemini/antigravity/skills/`
> also works). Rules live in `./.agents/rules/` or `~/.gemini/GEMINI.md`.

### opencode / other agents

Same flow. A ready-made skill lives in
[`skill/nptel-quiz/SKILL.md`](skill/nptel-quiz/SKILL.md); copy it into your
agent's skills directory (for opencode: `~/.config/opencode/skills/nptel-quiz/`).

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

## Playwright / browser setup

The tool drives a real browser, so it needs Playwright and its Chromium build.
If either is missing, `nptel-quiz` fails with a clear message telling you how to
fix it, and `doctor` reports exactly what's wrong:

```bash
nptel-quiz doctor          # read-only check
nptel-quiz doctor --fix    # installs the Playwright package, Chromium, and the OCR binary
```

What `doctor` checks: Node.js >= 18, the `playwright` package, the Chromium
binary, the native OCR binary, and the saved login profile. The one-liner
installer runs `doctor` automatically at the end.

## Cost (measured)

Per quiz of 10 questions: OCR = **$0** (~29 tokens/question of text), and a single
batched answer call is **~365 tokens** total — a few hundredths of a cent on any
cheap text model, versus ~2,000+ vision tokens if you sent the images directly.

## Configuration

| Env var | Purpose |
|---|---|
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Key for `--provider gemini`. |
| `NPTEL_QUIZ_GEMINI_MODEL` | Gemini model (default `gemini-3.8-flash`, the latest Flash). |
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

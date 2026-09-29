# NPTEL Quiz Solver

NPTEL quizzes render each question as an image, so the page content can't be read
the normal way. This tool pulls those images out of the page, OCRs them locally,
passes the text to a model to choose the answers, and submits them.

It runs on macOS and Windows. OCR happens on-device (Apple Vision on macOS,
Windows.Media.Ocr on Windows), so the question images never leave your machine.
In agent mode the answers come from an AI agent you already use; alternatively a
Gemini API key lets it run on its own. Either way only short plain text is sent
out, not images.

## Requirements

- Node.js 18 or newer.
- macOS: Xcode Command Line Tools, for the Swift OCR build (`xcode-select --install`).
- Windows: nothing extra; the OCR engine is part of Windows 10/11.
- An NPTEL account enrolled in the course you're working on.

## Install

macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.sh | bash
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.ps1 | iex"
```

Both installers put the tool in `~/.nptel-quiz` (`%USERPROFILE%\.nptel-quiz` on
Windows), install Playwright's Chromium, set up OCR, and add the `nptel-quiz`
command to your PATH. To see the current state at any time:

```bash
nptel-quiz doctor        # report what's installed
nptel-quiz doctor --fix  # install whatever is missing
```

## First run

Sign in once. This opens a browser where you log in to NPTEL through Google as
usual. The session is stored in a local browser profile and reused from then on.

```bash
nptel-quiz login
```

## Usage

List the weeks in a course and see which quizzes you've already submitted:

```bash
nptel-quiz list --course noc26_cs153
```

Each entry shows the quiz title, its status (`TODO` or `done`), and the URL to
use. OCR a quiz to read the questions:

```bash
nptel-quiz ocr --url "<quiz url>"
```

This prints one block per question with its options. Decide the answers and
submit:

```bash
nptel-quiz submit --url "<quiz url>" --answers "b,a,b,a,c,d,b,a,b,a"
```

For a fully automatic run that answers with Gemini:

```bash
export GEMINI_API_KEY=...
nptel-quiz run --url "<quiz url>"
```

Answers are one letter per question, comma separated. For multi-select questions
join the choices with `+`, for example `"a+c,b,d"`. Add `--dry-run` to select the
options without submitting.

## Using it with an AI agent

When an agent such as Antigravity or opencode is driving, you don't need an API
key: the agent reads the OCR output and answers with its own model.

```bash
nptel-quiz ocr --url "<quiz url>" --json /tmp/quiz.json   # agent reads this
nptel-quiz submit --url "<quiz url>" --answers "..."      # agent supplies this
```

Install the skill so the agent can run the whole flow itself:

```bash
nptel-quiz install-skill --global
```

Then paste a quiz URL and ask the agent to solve it. The skill is written to the
standard locations: `~/.gemini/config/skills/nptel-quiz/` for Antigravity, or
`./.agents/skills/nptel-quiz/` for a single project.

## OCR backends

There are two on-device engines, chosen by operating system. Only one ever runs
on a given machine.

| OS | Engine | Build |
|---|---|---|
| macOS | Apple Vision | compiled with `swiftc` during install |
| Windows | Windows.Media.Ocr | none; ships with the OS |

## Commands

| Command | What it does |
|---|---|
| `login` | Save an NPTEL browser session. |
| `list` | List weeks and quizzes (`--all` adds programming assignments). |
| `ocr` | OCR a quiz to text. |
| `submit` | Select and submit answers. |
| `run` | OCR, answer with Gemini, submit. |
| `doctor` | Check Node, Playwright, Chromium, OCR, and login. |
| `install-skill` | Install the agent skill. |

## Configuration

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Key used by `run`. |
| `NPTEL_QUIZ_GEMINI_MODEL` | Gemini model, default `gemini-3.8-flash`. |
| `NPTEL_QUIZ_COURSE_URL` | Default course URL used by `login`. |
| `NPTEL_QUIZ_PROFILE` | Browser profile directory. |
| `NPTEL_QUIZ_HOME` | Install directory. |

## Library

The same code is usable as a module:

```js
const nq = require('nptel-quiz');

const ctx = await nq.launch();
try {
  const { title, questions } = await nq.ocrQuiz(ctx, url);
  const result = await nq.runQuiz(ctx, { url, provider: 'gemini' });
  console.log(result.submitted);
} finally {
  await ctx.close();
}
```

Exports: `launch`, `isLoggedIn`, `checkPlaywright`, `extractQuiz`, `selectAnswers`,
`ocrImages`, `ocrReady`, `ocrQuiz`, `runQuiz`, `submitAnswers`, `parseCourseId`,
`fetchOutline`, `summarizeWeeks`.

## Known limits

- Works only with quizzes whose questions are images, and the URL has to use
  `assessmentId` (programming assignments use `progassignmentId`).
- Answers to code-reading questions are only as good as the model answering them.
- OCR occasionally misreads punctuation, such as reading `()` as `O`. This does
  not change which option is correct.
- Intended for your own enrolled courses. Respect NPTEL's academic-integrity rules.

## License

MIT

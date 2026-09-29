# nptel-quiz — agent guide

You are looking at **nptel-quiz**: a macOS CLI that OCRs NPTEL image-based
quizzes (on-device Apple Vision) and submits answers. The agent's own model
answers the questions, so no API key is required.

If the user pasted this repo's URL and asked to **set up** or **solve NPTEL
quizzes**, follow the flow below using your shell/`run_command` tool.

## 1. Setup

Pick the installer for the OS:

```bash
# macOS
curl -fsSL https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.sh | bash
```
```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.ps1 | iex"
```

Then, on either OS:
```bash
nptel-quiz doctor --fix      # verify Node, Playwright, Chromium, OCR; installs anything missing
nptel-quiz login             # opens a browser; the user completes Google SSO once
```

- OCR is per-OS and never collides: macOS uses Apple **Vision**; Windows uses the
  built-in **Windows.Media.Ocr**. The macOS Vision build needs Xcode Command Line
  Tools (`xcode-select --install`); Windows needs no OCR build.
- If `nptel-quiz` is not found, the install bin dir needs to be on PATH
  (`~/.local/bin` or `/usr/local/bin` on macOS; `%USERPROFILE%\.nptel-quiz\bin` on
  Windows — re-open the terminal after install).
- Optional: `nptel-quiz install-skill --global` registers the skill for later.

## 2. Ask which week

```bash
nptel-quiz list --course noc26_cs153   # or a full course URL; add --all for assignments
```

This prints each week with its quiz, `done`/`TODO` status, and the quiz URL.
**Stop and ask the user which week to proceed with** — suggest the `TODO` weeks.
Do not submit until they choose.

## 3. Solve the chosen quiz

```bash
nptel-quiz ocr --url "<quizUrl>" --json /tmp/nptel-quiz.json   # reads [Q1] ... blocks
# ... decide the answers from the OCR text (you, the agent, are the answer engine) ...
nptel-quiz submit --url "<quizUrl>" --answers "b,a,b,a,c,d,b,a,b,a"
```

- MCQ: one letter per question, comma-separated. MSQ: join choices with `+` (`"a+c,b"`).
- Use `--dry-run` first when an answer is uncertain.
- Confirm the title from `ocr` matches the week the user picked.

## Useful commands

| Command | Purpose |
|---|---|
| `nptel-quiz doctor [--fix]` | Diagnose/install Playwright, Chromium, OCR, login. |
| `nptel-quiz login` | Save the browser session. |
| `nptel-quiz list --course <c>` | List weeks/quizzes + status + URLs. |
| `nptel-quiz ocr --url <u>` | OCR a quiz to text. |
| `nptel-quiz submit --url <u> --answers "..."` | Select + submit. |
| `nptel-quiz run --url <u>` | Fully automatic via Gemini (needs `GEMINI_API_KEY`). |
| `nptel-quiz install-skill [--global]` | Install the Antigravity/agent skill. |

## Rules

- This is for the user's own enrolled courses; respect NPTEL's integrity policy.
- Verify the quiz title before submitting; a wrong `assessmentId` loads the
  last-viewed quiz.
- Never invent answers from the visible page — the option text only exists in
  the image (OCR it).

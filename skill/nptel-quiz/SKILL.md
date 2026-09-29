---
name: nptel-quiz
description: Set up and solve NPTEL image-based quizzes (MCQ/MSQ) end to end. Use when the user shares the nptel-quiz GitHub URL and asks to set it up, shares an NPTEL quiz URL (unitId + assessmentId), or asks to auto-answer/submit NPTEL quizzes. OCRs questions with the local nptel-quiz CLI, lets the agent's own model choose answers (no API key), then submits.
---

# NPTEL quiz solver

NPTEL quizzes render every question (and its options a./b./c./d.) as an image;
the DOM exposes only `a. b. c. d.` labels and radio/checkbox inputs. This skill
OCRs the images with the local `nptel-quiz` CLI, lets **the agent's own model**
decide the answers, then selects and submits them. No Gemini API key is needed —
the agent (Antigravity's Flash model, opencode, or any agent) does the reasoning.

Repo: https://github.com/prx-my/nptel-quiz

## A. Setup (when the user says "setup" — e.g. pastes the GitHub URL)

Run these via your shell/`run_command` tool, in order:

1. Install the CLI for the OS:
   ```
   # macOS
   curl -fsSL https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.sh | bash
   ```
   ```
   # Windows (PowerShell)
   powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.ps1 | iex"
   ```
   The installer sets up dependencies, Playwright + Chromium, OCR, and a health
   check. OCR is per-OS and never collides: macOS uses Apple **Vision** (needs
   Xcode Command Line Tools via `xcode-select --install`); Windows uses the
   built-in **Windows.Media.Ocr** (no build).

2. Verify (and auto-fix if anything is missing):
   ```
   nptel-quiz doctor --fix
   ```
   If `nptel-quiz` is "command not found", the install bin dir (`~/.local/bin`
   or `/usr/local/bin`) is not on PATH — tell the user to add it.

3. Sign in once (opens a browser; the user completes Google SSO):
   ```
   nptel-quiz login
   ```
   Wait for "Signed in."

4. Register this skill for future sessions:
   ```
   nptel-quiz install-skill --global
   ```

## B. Choose a week (after setup)

List the course's weeks and quizzes with status:
```
nptel-quiz list --course noc26_cs153      # or a full course URL / --all for assignments
```
Output shows each week, its quiz, `done`/`TODO` status, and the quiz URL.

**Then ask the user which week to proceed with** (propose the `TODO` weeks first).
Do not submit anything until the user picks.

## C. Solve the chosen week's quiz

1. OCR the quiz to text:
   ```
   nptel-quiz ocr --url "<quizUrl>" --json /tmp/nptel-quiz.json
   ```
   Output is `[Q1] ... [Q2] ...` blocks (question + its a./b./c./d. options). The
   URL from `list` already has the right `unitId` + `assessmentId`.

2. **Answer each question yourself** from the OCR text only:
   - MCQ: one letter per question. MSQ: all correct letters.
   - Never guess from the visible page — the DOM has no option text.
   - For code-snippet questions, read carefully; if OCR is ambiguous
     (`()` rendered as `O`, wrapped lines), re-read that image before answering.

3. Submit:
   ```
   nptel-quiz submit --url "<quizUrl>" --answers "b,a,b,a,c,d,b,a,b,a"
   ```
   - MCQ: comma-separated letters, one per question.
   - MSQ: join a question's options with `+`, e.g. `"a+c,b,d"`.
   - Use `--dry-run` first when unsure.

4. Confirm `Submitted: ...` is printed and the page shows
   "Your answers are successfully submitted!". Then offer the next `TODO` week.

## Rules & gotchas

- Verify the quiz title from `ocr` matches what the user picked — a wrong
  `assessmentId` silently loads the last-viewed quiz.
- Quizzes are graded; if uncertain, tell the user and use `--dry-run`.
- OCR misreading `()` as `O` does not change the answer.
- Do not use this to break NPTEL's academic-integrity rules; it is for the
  user's own enrolled courses.

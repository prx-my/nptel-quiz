---
name: nptel-quiz
description: Solve NPTEL image-based quizzes (MCQ/MSQ) end to end. Use when the user shares an NPTEL quiz URL (unitId + assessmentId) whose questions are images, or asks to auto-answer/submit an NPTEL quiz or assignment. OCRs the questions with the local `nptel-quiz` CLI, lets the agent's own model choose the answers (no API key), then submits.
---

# NPTEL quiz solver

NPTEL quizzes render every question (and its options a./b./c./d.) as an image;
the DOM exposes only `a. b. c. d.` labels and radio/checkbox inputs. This skill
OCRs the images with the local `nptel-quiz` CLI, lets **the agent's own model**
decide the answers, then selects and submits them. No Gemini API key is needed —
the agent (Antigravity's Flash model, opencode, or any agent) does the reasoning.

## Prerequisites

- `nptel-quiz` is installed and on PATH (`nptel-quiz --version`).
  Install: `curl -fsSL https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.sh | bash`
- The user has run `nptel-quiz login` once (browser session saved).
- A quiz URL of the form:
  `https://onlinecourses.nptel.ac.in/e-learning/course/<course>?unitId=<u>&assessmentId=<id>`
  Quizzes use `assessmentId`; programming assignments use `progassignmentId`.

## Workflow

1. **OCR the quiz to text** (run the command via your shell/`run_command` tool):
   ```
   nptel-quiz ocr --url "<quizUrl>" --json /tmp/nptel-quiz.json
   ```
   Output is `[Q1] ... [Q2] ...` blocks; each block is one question plus its
   `a. b. c. d.` options. If `/tmp` is unavailable, omit `--json`.

2. **Answer each question yourself**, from the OCR text only:
   - MCQ: one letter per question. MSQ: all correct letters.
   - Never guess from the visible page — the DOM has no option text.
   - For code-snippet questions, read carefully; if the OCR is ambiguous
     (`()` rendered as `O`, wrapped lines), re-read that image before answering.

3. **Submit**:
   ```
   nptel-quiz submit --url "<quizUrl>" --answers "b,a,b,a,c,d,b,a,b,a"
   ```
   - MCQ: comma-separated letters, one per question.
   - MSQ: join a question's options with `+`, e.g. `"a+c,b,d"`.
   - Use `--dry-run` first to select without submitting when unsure.

4. Confirm the command prints `Submitted: ...` and the page shows
   "Your answers are successfully submitted!".

## Rules & gotchas

- Verify the quiz title printed by `ocr` matches the user's intent — a wrong
  `assessmentId` silently loads the last-viewed quiz.
- Quizzes are graded; if an answer is uncertain, tell the user and use `--dry-run`.
- OCR misreading `()` as `O` does not change the answer.
- Do not use this to break NPTEL's academic-integrity rules; it is for the user's
  own enrolled courses.

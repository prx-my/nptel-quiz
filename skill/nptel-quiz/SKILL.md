---
name: nptel-quiz
description: Solve NPTEL image-based quizzes (MCQ/MSQ) end to end. Use when the user shares an NPTEL quiz/assignment URL whose questions are images, or asks to auto-answer/submit a quiz. Uses on-device OCR plus this agent's own reasoning (no external API), then submits.
---

# NPTEL quiz solver (agent flow)

NPTEL quizzes render each question as an image; the DOM exposes only `a. b. c. d.`
labels and radio/checkbox inputs. This skill OCRs the images locally, lets the
agent choose the answers, then selects and submits them.

## Prerequisites

- `nptel-quiz` is installed and on PATH (`nptel-quiz --version`).
- The user has run `nptel-quiz login` once (browser profile saved).
- The user provides a quiz URL of the form:
  `https://onlinecourses.nptel.ac.in/e-learning/course/<course>?unitId=<u>&assessmentId=<id>`
  (quizzes use `assessmentId`; programming assignments use `progassignmentId`).

## Workflow

1. OCR the quiz to text:
   ```
   nptel-quiz ocr --url "<quizUrl>" --json /tmp/nptel-quiz.json
   ```
   This prints `[Q1] ... [Q2] ...` blocks (question + its a/b/c/d options).

2. **Answer each question yourself** from the OCR text. Rules:
   - Output one letter per question for MCQ; for MSQ output every correct option.
   - Read the options from the same block; never guess from the visible DOM
     (it has no option text).
   - Code-snippet questions may need a second look — if the OCR is ambiguous,
     re-render just that image and read it again.

3. Submit:
   ```
   nptel-quiz submit --url "<quizUrl>" --answers "b,a,b,a,c,d,b,a,b,a"
   ```
   - MCQ: comma-separated letters, one per question.
   - MSQ: join a question's options with `+`, e.g. `"a+c,b,d"`.
   - Add `--dry-run` first to select without submitting when unsure.

4. Confirm the tool reports `Submitted: ...` and the page shows
   "Your answers are successfully submitted!".

## Notes

- Verify the quiz title printed by `ocr` matches what the user expects — a wrong
  `assessmentId` silently loads the last-viewed quiz.
- If OCR misreads `()` as `O`, it does not affect answers.
- Prefer `--dry-run` + a screenshot when confidence in an answer is low.
- Do not use this to violate NPTEL's academic-integrity rules; it is for the
  user's own enrolled courses.

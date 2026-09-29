'use strict';

const { extractQuiz, selectAnswers } = require('./quiz');
const { ocrImages } = require('./ocr');
const { getAnswerProvider } = require('./providers');

async function openQuizPage(context, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  if ((await page.locator('button:has-text("Sign In")').count().catch(() => 0)) > 0) {
    await page.close();
    throw new Error('Not signed in. Run "nptel-quiz login" first, then retry.');
  }

  try {
    await page.waitForSelector('main input[type=radio], main input[type=checkbox]', {
      timeout: 30000
    });
  } catch {
    await page.close();
    throw new Error(
      'No quiz inputs found. Check that the URL uses "assessmentId" and points to a ' +
        'released quiz, and that you are signed in.'
    );
  }
  // Let all question images decode.
  await page.waitForTimeout(800);
  return page;
}

/**
 * Extract the quiz and OCR every question image.
 * @returns {Promise<{title: string, type: string, questions: string[], quiz: object}>}
 */
async function ocrQuiz(context, url) {
  const page = await openQuizPage(context, url);
  try {
    const quiz = await extractQuiz(page);
    if (!quiz) throw new Error('No quiz found on the page.');
    const questions = await ocrImages(quiz.images);
    return { title: quiz.title, type: quiz.type, questions, quiz };
  } finally {
    await page.close();
  }
}

/**
 * Full loop: OCR -> answer -> select -> submit.
 * @param {object} context Playwright persistent context
 * @param {object} opts { url, provider, answers, model, dryRun }
 */
async function runQuiz(context, opts) {
  const page = await openQuizPage(context, opts.url);
  try {
    const quiz = await extractQuiz(page);
    if (!quiz) throw new Error('No quiz found on the page.');
    if (quiz.imageCount === 0 && (!opts.answers || opts.answers.length === 0)) {
      throw new Error('No question images found and no answers supplied.');
    }

    const questions = quiz.images.length ? await ocrImages(quiz.images) : [];

    let answers = opts.answers;
    if (!answers) {
      const provider = getAnswerProvider(opts.provider || 'gemini');
      if (!provider) {
        throw new Error(
          'Provider "none/opencode" needs answers supplied via --answers. ' +
            'Use "nptel-quiz ocr" then "nptel-quiz submit --answers ...".'
        );
      }
      answers = await provider.answer(questions, {
        model: opts.model,
        quizType: quiz.type
      });
    }

    const result = await selectAnswers(page, answers, { dryRun: opts.dryRun });
    return { title: quiz.title, type: quiz.type, questions, answers, ...result };
  } finally {
    await page.close();
  }
}

/**
 * Select + submit pre-computed answers (used by the opencode-agent flow).
 */
async function submitAnswers(context, opts) {
  const page = await openQuizPage(context, opts.url);
  try {
    const quiz = await extractQuiz(page);
    const result = await selectAnswers(page, opts.answers, { dryRun: opts.dryRun });
    return { title: quiz ? quiz.title : '', ...result };
  } finally {
    await page.close();
  }
}

module.exports = { openQuizPage, ocrQuiz, runQuiz, submitAnswers };

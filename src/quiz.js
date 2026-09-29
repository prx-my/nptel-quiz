'use strict';

// DOM extraction + answer selection for NPTEL image-based quizzes.
//
// NPTEL renders each question (and its options a./b./c./d.) as a single
// base64 PNG, and the selectable inputs are radio buttons (MCQ) or
// checkboxes (MSQ). The visible DOM text only contains "a. b. c. d." labels,
// so the question content must be read via OCR.

const INPUT_SELECTOR = 'input[type=radio], input[type=checkbox]';

async function extractQuiz(page) {
  return await page.evaluate(() => {
    const main = document.querySelector('main.assessment-main') || document.querySelector('main');
    if (!main) return null;

    const text = main.innerText || '';
    const titleLine = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' — ');

    const imgs = [...main.querySelectorAll('img')]
      .map((i) => i.getAttribute('src') || '')
      .filter((src) => src.startsWith('data:image'));

    const inputs = [...main.querySelectorAll('input[type=radio], input[type=checkbox]')];
    const groupNames = [];
    inputs.forEach((el) => {
      if (!groupNames.includes(el.name)) groupNames.push(el.name);
    });

    return {
      title: titleLine,
      submitted: /last recorded submission|successfully submitted/i.test(text),
      type: inputs.some((el) => el.type === 'checkbox') ? 'msq' : 'mcq',
      imageCount: imgs.length,
      questionCount: groupNames.length,
      groups: groupNames.map((name) => ({
        name,
        size: inputs.filter((el) => el.name === name).length
      })),
      images: imgs
    };
  });
}

function letterToIndex(letter) {
  const c = String(letter).trim().toLowerCase();
  if (c.length === 0) return -1;
  return c.charCodeAt(0) - 97;
}

/**
 * Select the given answers in the page.
 * @param {import('playwright').Page} page
 * @param {Array<string|string[]>} answers one entry per question; letter(s)
 * @param {object} [opts]
 * @returns {Promise<{selected: Array<{question:number,letters:string[],indexes:number[]}>, submitted:boolean}>}
 */
async function selectAnswers(page, answers, opts = {}) {
  const quiz = await extractQuiz(page);
  if (!quiz) throw new Error('No quiz found on the page.');
  if (quiz.questionCount === 0) throw new Error('No answer inputs found on the page.');
  if (answers.length !== quiz.questionCount) {
    throw new Error(
      `Expected ${quiz.questionCount} answers, got ${answers.length}.`
    );
  }

  // Offsets so we can address inputs by absolute nth().
  const offsets = [];
  let acc = 0;
  for (const g of quiz.groups) {
    offsets.push(acc);
    acc += g.size;
  }

  const inputs = page.locator('main').first().locator(INPUT_SELECTOR);
  const selected = [];

  for (let q = 0; q < answers.length; q++) {
    const raw = answers[q];
    const letters = Array.isArray(raw) ? raw : [raw];
    const indexes = [];
    for (const letter of letters) {
      const li = letterToIndex(letter);
      if (li < 0 || li >= quiz.groups[q].size) {
        throw new Error(
          `Question ${q + 1}: invalid option "${letter}" (has ${quiz.groups[q].size} options).`
        );
      }
      const idx = offsets[q] + li;
      indexes.push(idx);
    }
    for (const idx of indexes) {
      await inputs.nth(idx).check({ force: true });
    }
    selected.push({ question: q + 1, letters: letters.map((l) => String(l).toLowerCase()), indexes });
  }

  if (opts.dryRun) return { selected, submitted: false };

  const submit = page.locator('button:has-text("Submit Answers")').first();
  if ((await submit.count()) === 0) {
    throw new Error('Submit Answers button not found.');
  }
  await submit.click();

  // Wait for the confirmation toast.
  let confirmed = false;
  try {
    await page.waitForFunction(
      () => /successfully submitted|last recorded submission/i.test(document.body.innerText),
      null,
      { timeout: 15000 }
    );
    confirmed = true;
  } catch {
    /* fall through; caller can verify via extractQuiz().submitted */
  }

  const after = await extractQuiz(page).catch(() => null);
  return { selected, submitted: confirmed || (after ? after.submitted : false) };
}

module.exports = { extractQuiz, selectAnswers, letterToIndex };

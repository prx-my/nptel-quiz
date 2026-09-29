'use strict';

// Integration test for extractQuiz + selectAnswers against a local fixture that
// mirrors NPTEL's quiz DOM (question images + radio/checkbox groups).

const assert = require('assert');
const { chromium } = require('playwright');
const { extractQuiz, selectAnswers } = require('../src/quiz');

function fixture(type) {
  const inputType = type === 'msq' ? 'checkbox' : 'radio';
  const q = (n) => `
    <div class="question">
      <p>${n}.</p>
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
      ${['a', 'b', 'c', 'd']
        .map(
          (o) =>
            `<label><input type="${inputType}" name="q${n}" value="${o}"/> ${o}.</label>`
        )
        .join('')}
    </div>`;
  return `<!doctype html><html><body>
    <main class="assessment-main">
      ${[1, 2, 3, 4].map(q).join('')}
      <button onclick="this.parentElement.insertAdjacentHTML('beforeend','Your answers are successfully submitted!')">Submit Answers</button>
    </main></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // MCQ
  await page.setContent(fixture('mcq'));
  let quiz = await extractQuiz(page);
  assert.strictEqual(quiz.questionCount, 4, '4 questions');
  assert.strictEqual(quiz.type, 'mcq');
  assert.strictEqual(quiz.imageCount, 4);

  const res = await selectAnswers(page, ['b', 'a', 'd', 'c']);
  assert.strictEqual(res.submitted, true, 'mcq submitted');
  assert.deepStrictEqual(
    res.selected.map((s) => s.indexes),
    [[1], [4], [11], [14]],
    'mcq index mapping'
  );

  // MSQ (checkbox, multi-answer with +)
  await page.setContent(fixture('msq'));
  quiz = await extractQuiz(page);
  assert.strictEqual(quiz.type, 'msq');
  const res2 = await selectAnswers(page, [['a', 'c'], ['b'], ['d'], ['a']]);
  assert.deepStrictEqual(
    res2.selected.map((s) => s.indexes),
    [[0, 2], [5], [11], [12]],
    'msq index mapping'
  );

  // Dry run must not submit
  await page.setContent(fixture('mcq'));
  const dry = await selectAnswers(page, ['a', 'a', 'a', 'a'], { dryRun: true });
  assert.strictEqual(dry.submitted, false);

  // Bad letter must throw
  await page.setContent(fixture('mcq'));
  await assert.rejects(() => selectAnswers(page, ['e', 'a', 'a', 'a']));

  await browser.close();
  console.log('select.test.js OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

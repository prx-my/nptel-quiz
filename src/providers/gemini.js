'use strict';

// Answer engine backed by the Gemini API.
// One batched request per quiz (all questions in a single call) keeps cost tiny.

const DEFAULT_MODEL = process.env.NPTEL_QUIZ_GEMINI_MODEL || 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildPrompt(questions, quizType) {
  const multi = quizType === 'msq';
  const header = multi
    ? 'You are answering a multiple-select quiz. For each question choose ALL correct options.'
    : 'You are answering a multiple-choice quiz. For each question choose exactly ONE correct option.';
  return [
    header,
    'Return ONLY minified JSON of the form {"answers":[["a"],["b","c"]]} —',
    'one array per question, containing the chosen option letters (a, b, c, d...).',
    '',
    'Questions:',
    ...questions.map((q, i) => `\n[Q${i + 1}]\n${q}`)
  ].join('\n');
}

function normalizeAnswers(parsed, count) {
  const raw = parsed && parsed.answers;
  if (!Array.isArray(raw) || raw.length !== count) {
    throw new Error(`Gemini returned ${Array.isArray(raw) ? raw.length : 0} answers, expected ${count}.`);
  }
  return raw.map((a) => {
    if (Array.isArray(a)) return a.map((x) => String(x).toLowerCase());
    return [String(a).toLowerCase()];
  });
}

async function answer(questions, opts = {}) {
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set.');
  }
  const model = opts.model || DEFAULT_MODEL;
  const quizType = opts.quizType || 'mcq';

  const url = `${ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: buildPrompt(questions, quizType) }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json'
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const text =
    json &&
    json.candidates &&
    json.candidates[0] &&
    json.candidates[0].content &&
    json.candidates[0].content.parts &&
    json.candidates[0].content.parts.map((p) => p.text || '').join('');
  if (!text) throw new Error('Gemini returned an empty response.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Could not parse Gemini response: ${text.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }

  return normalizeAnswers(parsed, questions.length);
}

module.exports = { answer, buildPrompt, DEFAULT_MODEL };

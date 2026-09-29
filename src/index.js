'use strict';

// Public library surface for integrating nptel-quiz into your own tooling.
//
//   const nq = require('nptel-quiz');
//   const ctx = await nq.launch({ headless: true });
//   const { questions } = await nq.ocrQuiz(ctx, url);
//   const { submitted } = await nq.runQuiz(ctx, { url, provider: 'gemini' });
//   await ctx.close();

const browser = require('./browser');
const quiz = require('./quiz');
const ocr = require('./ocr');
const providers = require('./providers');
const pipeline = require('./pipeline');
const course = require('./course');

module.exports = {
  // browser / session
  launch: browser.launch,
  isLoggedIn: browser.isLoggedIn,
  profileDir: browser.profileDir,
  checkPlaywright: browser.checkPlaywright,

  // low-level page ops
  extractQuiz: quiz.extractQuiz,
  selectAnswers: quiz.selectAnswers,

  // OCR (platform-dispatched: darwin=Vision, win32=Windows.Media.Ocr)
  ocrImages: ocr.ocrImages,
  ocrBackend: ocr.ocrBackend,
  ocrReady: ocr.ocrReady,

  // high-level flows
  ocrQuiz: pipeline.ocrQuiz,
  runQuiz: pipeline.runQuiz,
  submitAnswers: pipeline.submitAnswers,

  // providers
  getAnswerProvider: providers.getAnswerProvider,

  // course outline
  parseCourseId: course.parseCourseId,
  fetchOutline: course.fetchOutline,
  summarizeWeeks: course.summarizeWeeks
};

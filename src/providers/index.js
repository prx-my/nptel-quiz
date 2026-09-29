'use strict';

const gemini = require('./gemini');

/**
 * Resolve an answer provider.
 *  - "gemini"   : batched Gemini API call (BYO key)
 *  - "none"     : no programmatic engine; answers must be supplied by the caller
 *                 (this is the path used when an opencode agent does the reasoning)
 */
function getAnswerProvider(name) {
  const key = String(name || '').toLowerCase();
  switch (key) {
    case 'gemini':
      return gemini;
    case 'none':
    case 'manual':
    case 'opencode':
      return null;
    default:
      throw new Error(`Unknown provider "${name}". Use one of: gemini, none, opencode.`);
  }
}

module.exports = { getAnswerProvider };

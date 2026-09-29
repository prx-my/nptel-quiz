'use strict';

// Course outline: list weeks and their quizzes/assignments with status + URLs.

const BASE = 'https://onlinecourses.nptel.ac.in/e-learning/course';

function parseCourseId(input) {
  if (!input) return null;
  const m = String(input).match(/course\/([^/?#]+)/);
  if (m) return m[1];
  return String(input).trim();
}

async function fetchOutline(context, courseId) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/${courseId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    return await page.evaluate(async (cid) => {
      const r = await fetch(`/e-learning/api/courseoutline?course_id=${cid}`, {
        credentials: 'include'
      });
      const j = await r.json();
      return typeof j.payload === 'string' ? JSON.parse(j.payload) : j.payload;
    }, courseId);
  } finally {
    await page.close();
  }
}

function statusLabel(state) {
  if (state === 2) return 'submitted';
  if (state === 0) return 'pending';
  return `state:${state}`;
}

/**
 * Group assessments into weeks with ready-to-use URLs.
 * @param {object} outline payload from courseoutline API
 * @param {string} courseId
 * @param {{includeAssignments?: boolean}} [opts]
 */
function summarizeWeeks(outline, courseId, opts = {}) {
  const includeAssignments = !!opts.includeAssignments;
  const units = outline.units || {};
  const weekName = {};
  Object.values(units).forEach((u) => {
    if (u && u.unit_id != null && u.title) weekName[u.unit_id] = u.title;
  });

  const weeks = new Map();
  for (const item of outline.assessments || []) {
    if (!item.title) continue;
    const isQuiz = item.type === 'U';
    const isProg = item.type === 'X';
    if (!isQuiz && !(includeAssignments && isProg)) continue;

    const weekId = item.id;
    if (!weeks.has(weekId)) {
      weeks.set(weekId, {
        weekId,
        week: (weekName[weekId] || `Unit ${weekId}`).trim(),
        quizzes: [],
        assignments: []
      });
    }
    const entry = {
      title: item.title,
      contentId: item.unit_id,
      status: statusLabel(item.state),
      submitted: item.state === 2,
      url: isQuiz
        ? `${BASE}/${courseId}?unitId=${weekId}&assessmentId=${item.unit_id}`
        : `${BASE}/${courseId}?unitId=${weekId}&progassignmentId=${item.unit_id}`
    };
    (isQuiz ? weeks.get(weekId).quizzes : weeks.get(weekId).assignments).push(entry);
  }

  return Array.from(weeks.values()).sort((a, b) => a.weekId - b.weekId);
}

module.exports = { parseCourseId, fetchOutline, summarizeWeeks, statusLabel, BASE };

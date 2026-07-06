// DOM builders for the results-submission intake links. Both open the GitHub
// "Submit game results" issue form (util/submit-results.js) — submitting games
// under a fresh slug is also how a new tournament's stats page gets created,
// so "create a tournament" is the same form with no slug prefilled.
//
// Used by the stats hub (tournaments-main.js) and every per-tournament stats
// page (stats-main.js); must stay free of scorekeeper-only DOM assumptions.

import { submitResultsUrl } from '../util/submit-results.js';

function linkParagraph({ prefix, href, text, title }) {
  const p = document.createElement('p');
  p.className = 'ts-intro';
  if (prefix) p.append(prefix + ' ');
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = text;
  link.title = title;
  p.appendChild(link);
  return p;
}

export function submitResultsLink(slug) {
  return linkParagraph({
    href: submitResultsUrl(slug),
    text: 'Submit game results →',
    title: 'Publish a scored game to this page: opens a GitHub form — paste or attach the CSV(s) you exported from the scorekeeper.',
  });
}

export function createTournamentLink() {
  return linkParagraph({
    prefix: 'Running your own tournament?',
    href: submitResultsUrl(''),
    text: 'Create its stats page →',
    title: 'Opens a GitHub form — pick a fresh slug and paste or attach your games’ CSVs; the tournament’s stats page is created automatically.',
  });
}

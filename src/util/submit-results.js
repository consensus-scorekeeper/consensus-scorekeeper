// Link builder for the GitHub "Submit game results" issue form — the public
// intake of the results-submission pipeline (see
// .github/ISSUE_TEMPLATE/submit-results.yml and CLAUDE.md). Each tournament's
// stats page renders this link with its own slug prefilled; the scorer pastes
// or attaches the CSV(s) they exported from the scorekeeper.
//
// Submissions must land in the repo that hosts the canonical site even when
// the page is served from a mirror or a local dev copy, so the URL is a
// constant rather than derived from location.href.
//
// GitHub prefills issue-form fields from query params keyed by field id
// (`tournament` — see submit-results.yml).

export const SUBMISSIONS_REPO = 'consensus-scorekeeper/consensus-scorekeeper.github.io';

export function submitResultsUrl(tournamentSlug) {
  const params = new URLSearchParams({ template: 'submit-results.yml' });
  if (tournamentSlug) params.set('tournament', tournamentSlug);
  return `https://github.com/${SUBMISSIONS_REPO}/issues/new?${params}`;
}

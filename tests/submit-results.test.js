import { describe, it, expect } from 'vitest';
import { submitResultsUrl, SUBMISSIONS_REPO } from '../src/util/submit-results.js';

describe('submitResultsUrl', () => {
  it('targets the canonical repo issue form with the slug prefilled', () => {
    const url = new URL(submitResultsUrl('stanford-consensus-2026'));
    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toBe(`/${SUBMISSIONS_REPO}/issues/new`);
    expect(url.searchParams.get('template')).toBe('submit-results.yml');
    expect(url.searchParams.get('tournament')).toBe('stanford-consensus-2026');
  });

  it('omits the tournament param when no slug is given', () => {
    const url = new URL(submitResultsUrl(''));
    expect(url.searchParams.get('template')).toBe('submit-results.yml');
    expect(url.searchParams.has('tournament')).toBe(false);
  });
});

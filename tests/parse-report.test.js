// Renders the suspected-parsing-issues panel against the real index.html
// body (injected by tests/setup.js), the same pattern roster-manager tests
// use.

import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { renderParseReport } from '../src/ui/parse-report.js';

const panel = () => document.getElementById('parse-report');

beforeEach(() => {
  state.parseIssues = [];
  renderParseReport();
});

describe('renderParseReport', () => {
  it('hides the panel when there are no issues', () => {
    expect(panel().style.display).toBe('none');
  });

  it('renders summary counts and one list item per issue', () => {
    state.parseIssues = [
      { severity: 'error', code: 'jackpot-unresolved', message: 'Question 14 has no answer.', slot: 14 },
      { severity: 'warn', code: 'txt-orphan-answer', message: 'Orphaned A: line.', lineNo: 7 },
      { severity: 'warn', code: 'duplicate-number', message: 'Question 5 repeats.', slot: 5, snippet: 'Second <version>' },
    ];
    renderParseReport();
    expect(panel().style.display).not.toBe('none');
    expect(document.getElementById('parse-report-summary').textContent)
      .toContain('1 error, 2 warnings');
    const items = document.querySelectorAll('#parse-report-list li');
    expect(items).toHaveLength(3);
    expect(items[0].className).toBe('error');
    expect(items[1].textContent).toContain('line 7: ');
    // Snippets are escaped, not injected as markup.
    expect(items[2].querySelector('code').textContent).toBe('Second <version>');
  });
});

# Contributing

Thanks for your interest! This project is a static site with no build
step, so getting productive takes about two minutes.

## Ways to contribute

- **Report a bug or suggest a feature** — [open an issue](https://github.com/consensus-scorekeeper/consensus-scorekeeper.github.io/issues).
  Screenshots and, for parsing bugs, the packet file (or a link to it on
  consensustrivia.com) make issues much easier to act on.
- **Publish tournament results** — no code needed. Use the "Submit game
  results" link on the tournament's stats page; a bot validates your
  CSVs and opens a pull request automatically.
- **Code** — fork the repo, make your change on a branch, and open a
  pull request.

## Dev setup

```
python serve.py     # dev server on http://localhost:8000
npm install         # one-time: vitest + happy-dom (tests only)
npm test            # run the test suite
```

There is no bundler and no framework — plain ES modules served as-is.
Any static file server works; `serve.py` additionally proxies pack
downloads from consensustrivia.com for local development.

## Before opening a PR

- `npm test` must pass. If you touched anything near the packet parser,
  pay attention to `tests/golden-pdf.test.js` — it diffs the parse of
  two real packs byte-exactly. Only regenerate the golden fixtures
  (`node scripts/generate-golden.mjs`) when a parse-output change is
  intended, and review the JSON diff.
- New logic should come with tests. Pure logic belongs outside `src/ui/`
  (see the conventions below) so it can be tested without a DOM.
- Keep all site URLs relative — the site must work from GitHub Pages,
  a local server, and any mirror.

## Where things live

`CLAUDE.md` at the repo root is the architecture document: the module
map, state-management rules, localStorage key conventions, the packet
parsing pipeline, and the runbooks (adding a tournament, regenerating
the pack catalog). Read the relevant section before making substantial
changes — the conventions there (reducers own all state mutation, no
inline `onclick`, pure logic stays DOM-free) are enforced in review.

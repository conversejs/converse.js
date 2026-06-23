---
title: Automated Tests
description: How to run tests in Converse using Vitest.
---

Converse uses the [Vitest](https://vitest.dev/) test runner in
[browser mode](https://vitest.dev/guide/browser/) (via Playwright/Chromium) to run its
tests in a real browser. The suite was originally written for [Jasmine](https://jasmine.github.io/),
so a small compatibility shim (`vitest/setup.jasmine-shim.js`) maps the Jasmine API
(`spyOn`, `jasmine.*`, the `toEqualStanza` matcher, `fdescribe`/`fit`, ...) onto Vitest
primitives — the spec files themselves are unchanged.

In addition, we use [ESLint](https://eslint.org/) to run a static analysis (aka
linting) of the source files and report errors.

Whenever a commit is pushed to the Converse GitHub repo, all linting checks and
tests are run in our continuous integration system.

## Running tests

The primary way to run tests is using npm scripts:

```bash
npm test                  # Run main UI tests (headless Chromium, single run)
npm run test:browser      # Run main tests in a visible Chrome window (watch mode)
npm run test:all          # Run both headless and main tests
npm run test:headless     # Run headless (core XMPP) tests only
npm run test:headless:browser  # Run headless tests in a visible Chrome window
npm run lint              # Run ESLint
make check                # Run linting, type checking, and all tests (full CI suite)
```

Unlike the old Karma setup, `npm test` is a **single run** by default (it maps to
`vitest run`); there is no `--single-run` flag to remember.

> **First time?** Browser mode needs the Playwright Chromium binary. Install it once with
> `npx playwright install chromium`.

**Always build before testing.** Tests run against the pre-built `dist/converse.js` bundle,
not source files directly. Run `npm run dev` first if you've made changes.

```bash
npm run dev && npm test
```

### Headless vs browser mode

- **`npm test`** and **`npm run test:headless`** run in **headless Chromium** — fast, no visible browser, ideal for CI
- **`npm run test:browser`** and **`npm run test:headless:browser`** open a visible Chrome window (in watch mode) — useful for debugging

When running in browser mode, a Vite dev server starts and a Chrome window opens. Vitest
keeps watching for file changes and re-runs affected tests; press `q` in the terminal to quit.

## Running individual tests

Converse has many tests, and it can take a while to run through all of them.

When developing on Converse, it's often preferable to have a more rapid
turnaround time between editing a file and checking whether the most relevant
tests have passed.

Tests are described by `it` functions and the test names are written to
be read as plain English sentences that start with the word `it`.

For example:

```javascript
it("is rejected if it's an unencapsulated forwarded message",
```

Tests are grouped by `describe` functions, and contained in test files inside
the `tests/` subdirectories of each plugin.

### Running specific test files

The fastest way to focus during development is to pass a file path (or path substring)
to Vitest:

```bash
npx vitest run --project main src/plugins/chatview/tests/messages.js
npx vitest run --project headless smacks   # any file whose path matches "smacks"
```

New test files placed in a `tests/` directory are **auto-discovered** via the `include`
globs in `vitest.config.js` — there is no `files` array to update (as there was with Karma).

### Focusing tests with `fdescribe` / `fit`

To run only a single test, you can replace `it(` with `fit(` for the particular
test that you want to run. To run only a group of tests, replace `describe(` with
`fdescribe(`. (The compat shim aliases these to Vitest's `it.only`/`describe.only`.)

Note that under Vitest a focused test only narrows **within its own file**, so when running
the whole suite, combine `fit`/`fdescribe` with a file path (see above).

**Always revert `fdescribe`/`fit` back to `describe`/`it` before committing.**

## Jasmine compatibility vs. native Vitest APIs

The suite was written for Jasmine, so `vitest/setup.jasmine-shim.js` installs a thin
compatibility layer (`spyOn`, `jasmine.*`, `fdescribe`/`fit`, the `toEqualStanza` matcher,
extra matchers like `toBeTrue`/`toHaveSize`). That layer exists so the ~540 existing spy
call-sites didn't have to be rewritten — **it is purely additive**.

That means **new tests can (and should) use native Vitest APIs directly.** Both styles
work, and can be mixed in the same file, because:

- `globals: true` injects `vi`, `expect`, `describe`, `it`, `beforeEach`, … — no imports needed.
- `expect` is _extended_, not replaced, so native matchers (`toBe`, `toEqual`,
  `toHaveBeenCalledWith`, `await expect(...).rejects.toThrow()`, …) coexist with the Jasmine ones.
- `spyOn()` returns the underlying Vitest mock, so the same spy answers to both the Jasmine
  facade (`spy.and.returnValue(x)`, `spy.calls.count()`) and the native API
  (`spy.mockReturnValue(x)`, `expect(spy).toHaveBeenCalledOnce()`).

```js
// Jasmine style (existing tests)
const s = spyOn(obj, 'm').and.returnValue(5);
expect(s.calls.count()).toBe(1);
jasmine.clock().install();
```

```js
// Native Vitest (prefer for new tests)
const s = vi.spyOn(obj, 'm').mockReturnValue(5);
expect(s).toHaveBeenCalledOnce();
vi.useFakeTimers();
```

Two caveats that apply regardless of style:

1. **`vi.mock()` can't stub Converse internals.** Tests import the prebuilt `dist/converse.js`
   bundle, where every internal module is inlined. There's no separate module path for
   `vi.mock` to intercept. Stub at runtime instead: `vi.spyOn(converse.env.X, …)`,
   `vi.spyOn(SomeClass.prototype, …)`, or `vi.stubGlobal('Notification', …)`.
2. **No `.concurrent`.** The suite relies on serial execution and shared browser state
   (`fileParallelism: false`, `isolate: false`), so `describe.concurrent`/`test.concurrent`
   would break the cumulative IndexedDB/localStorage assumptions.

## Headless tests

Converse has a separate test suite in `src/headless/tests/` for core XMPP
functionality that doesn't require UI components:

```bash
npm run test:headless          # Run headless tests (headless Chromium)
npm run test:headless:browser  # Run headless tests in a visible Chrome window
```

These run as a separate Vitest **project** (`headless`) defined in the root
`vitest.config.js`, rooted at `src/headless/` and importing the prebuilt
`src/headless/dist/converse-headless.js` bundle.

> **Which suite to run?** Tests for plugins under `src/headless/` (e.g. smacks,
> roster, status, presence) live in the **headless** suite and will not be picked
> up by `npm test`. Use `npm run test:headless` when working in that area.
> `npm test` only covers the UI plugins under `src/plugins/`.

## Debugging tests

For better debugging, you can:

1. Use `npm run test:browser` to run tests in a visible Chrome window, then open the
   browser's devtools on the Vitest page
2. Pass a file path to narrow the run to the failing spec (see above)
3. Add `debugger;` statements in your test code (they pause when devtools is open)
4. Use `console.log()` statements to inspect values
5. Set `loglevel: 'debug'` in test configurations for verbose XMPP stanza logging

## Test structure

Tests follow this pattern:

```javascript
/*global mock, converse */

const { api } = converse;
const u = converse.env.utils;

describe('My Feature', function () {
    it(
        'does something',
        mock.initConverse(['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            // Test implementation
        }),
    );
});
```

The `mock.initConverse` helper sets up a test environment with specific
configuration and waits for certain promises to resolve before running the test.

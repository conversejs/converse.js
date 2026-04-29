---
title: Automated Tests
description: How to run tests in Converse using Karma and Jasmine.
---

Converse uses the [Karma](https://karma-runner.github.io/latest/index.html) test runner and
[Jasmine](https://jasmine.github.io/) testing library for running tests.

In addition, we use [ESLint](https://eslint.org/) to run a static analysis (aka
linting) of the source files and report errors.

Whenever a commit is pushed to the Converse GitHub repo, all linting checks and
tests are run in our continuous integration system.

## Running tests

The primary way to run tests is using npm scripts:

```bash
npm test                  # Run main tests (HeadlessChrome, single run)
npm run test:browser      # Run main tests in a visible Chrome window
npm run test:all          # Run both headless and main tests
npm run test:headless     # Run headless tests only (HeadlessChrome)
npm run test:headless:browser  # Run headless tests in a visible Chrome window
npm run lint              # Run ESLint
make check                # Run linting, type checking, and all tests (full CI suite)
```

**Always build before testing.** Karma tests run against the pre-built `dist/converse.js` bundle,
not source files directly. Run `npm run dev` first if you've made changes.

```bash
npm run dev && npm test
```

### Headless vs browser mode

- **`npm test`** and **`npm run test:headless`** run in **HeadlessChrome** — fast, no visible browser, ideal for CI
- **`npm run test:browser`** and **`npm run test:headless:browser`** open a visible Chrome window — useful for debugging

When running in browser mode, a Chrome window will open at http://localhost:9876.
You'll see a green bar at the top with a `Debug` button on the right. Clicking it
opens the tests in a new tab where you can use the browser's developer tools for
better error output on failed tests.

## Running individual tests

Converse has many tests, and it can take a while to run through all of them.

When developing on Converse, it's often preferable to have a more rapid
turnaround time between editing a file and checking whether the most relevant
tests have passed.

Jasmine tests are described by `it` functions and the test names are written to
be read as plain English sentences that start with the word `it`.

For example:

```javascript
it("is rejected if it's an unencapsulated forwarded message",
```

Tests are grouped by `describe` functions, and contained in test files inside
the `tests/` subdirectories of each plugin.

To run only a single test, you can replace `it(` with `fit(` for the particular
test that you want to run. You can also do this for multiple tests. All of them
will be run whenever you execute the tests.

To run only a group of tests, you can similarly replace `describe(` with `fdescribe`.

**Always revert `fdescribe`/`fit` back to `describe`/`it` before committing.**

## Running specific test files

To run only specific test files during development, you can temporarily modify
the `files` array in `karma.conf.js` to include only the test files you're
interested in:

```javascript
files: [
    // ... existing files
    { pattern: "src/plugins/my-plugin/tests/my-test.js", type: 'module' },
];
```

## Headless tests

Converse has a separate test suite in `src/headless/tests/` for core XMPP
functionality that doesn't require UI components:

```bash
npm run test:headless          # Run headless tests (HeadlessChrome)
npm run test:headless:browser  # Run headless tests in a visible Chrome window
```

These use the same Karma/Jasmine setup but with a separate configuration file
(`src/headless/karma.conf.js`).

> **Which suite to run?** Tests for plugins under `src/headless/` (e.g. smacks,
> roster, status, presence) live in the **headless** suite and will not be picked
> up by `npm test`. Use `npm run test:headless` when working in that area.
> `npm test` only covers the UI plugins under `src/plugins/`.

## Debugging tests

For better debugging, you can:

1. Use `npm run test:browser` to run tests in a visible Chrome window
2. Click the "Debug" button in the Karma test runner to open tests in a new tab with devtools
3. Add `debugger;` statements in your test code
4. Use `console.log()` statements to inspect values
5. Set `loglevel: 'debug'` in test configurations for verbose XMPP stanza logging

## Test structure

Tests follow this pattern:

```javascript
/*global mock, converse */

const { api } = converse;
const u = converse.env.utils;

describe("My Feature", function () {
    it("does something", mock.initConverse(['chatBoxesFetched'],
        { view_mode: 'fullscreen' },
        async function (_converse) {
            // Test implementation
        }
    ));
});
```

The `mock.initConverse` helper sets up a test environment with specific
configuration and waits for certain promises to resolve before running the test.

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
npm test                  # Run main tests (Karma)
npm run test:all          # Run both headless and main tests
npm run test:headless     # Run headless tests only
npm run lint              # Run ESLint
npm run check             # Run linting, type checking, and all tests (full CI suite)
```

To run tests in watch mode (automatically re-run when files change):

```bash
npm run test -- --watch   # Run tests in watch mode
```

When running tests, a browser will automatically start up, open a tab at 
http://localhost:9876 and start running the tests.

You'll see a green bar at the top of the page, and on the right inside it is a 
`Debug` button. It's often helpful to click that button and run the tests in 
debug mode. This way, you see better error output for failed tests.

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

Converse has a separate headless test suite for core XMPP functionality that 
doesn't require UI components:

```bash
npm run test:headless     # Run headless tests
```

These tests are located in `src/headless/tests/` and use the same Karma/Jasmine
setup but with a different configuration file.

## Debugging tests

For better debugging, you can:

1. Use the Karma debug mode by clicking the "Debug" button in the test browser
2. Add `debugger;` statements in your test code
3. Use `console.log()` statements to inspect values
4. Run tests in watch mode to get immediate feedback

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

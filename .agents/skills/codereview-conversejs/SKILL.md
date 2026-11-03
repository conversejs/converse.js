---
name: codereview-conversejs
description: Code review for Converse, the XMPP client (headless core, plugins, web UI, CLI, upstream dependencies). Use when reviewing Converse code, or a pull or merge request against the Converse repo (conversejs/converse.js). Checks plugin boundaries, OMEMO metadata leaks, API placement and headless portability, plus data structures, simplicity, breakage and tests.
triggers:
  - /codereview-conversejs
---

Review changes to Converse, an XMPP client built on a plugin-based
headless core (`@converse/headless`) that runs in the browser and in Node.js.
Several front ends sit on that core: the web UI, a CLI, and later a TUI.
Check its architectural and protocol constraints first, then engineering
fundamentals: data structures, unnecessary complexity, pragmatism, and
breakage. Skip style and formatting; linters handle those. Do not modify the
code. Report findings only.

## Before reviewing: learn the intent

You cannot judge whether a change is warranted from the diff alone. Read what
the author says it is for:

- For a PR: `gh pr view <N> --json title,body`
- For a branch: `git log --format='%s%n%b' <base>..<head>`

If neither says anything useful, judge from the code, and say in a finding
that the intent had to be inferred.

Also read the repo's `AGENTS.md`, in particular "Plugin Design Philosophy". It
holds the canonical version of the plugin rules below; where the two disagree,
`AGENTS.md` wins.

Then ask three questions of the change:

1. Is this solving a real problem or an imagined one?
2. Is there a simpler way?
3. What will this break?

## What to look for

### 1. Converse constraints (highest priority)

Check every one of these on every review. They outrank everything else here.

#### 1.1 Leaking abstractions

"If you can't disable a plugin and still have a working client, the
abstraction already leaked."

Converse follows XMPP's design: a minimal core, with features as plugins.
A plugin is a unit of functionality, not of specification: some implement
several XEPs, and some implement none.

- Plugin boundaries follow features (see "Plugin Design Philosophy" in
  `AGENTS.md`). Flag a new plugin for code that only serves an existing
  feature (it depends on that plugin, extends its API, and has no other
  consumer); it belongs inside that plugin, in its own file or subdirectory.
  Also flag an existing plugin growing a distinct feature that other plugins
  or front ends could use on their own, or that a deployment might want to
  leave out; that wants its own plugin.

- Core and shared code (`src/headless/core.js`, `src/headless/shared/`) must
  not import from a plugin or carry plugin-specific logic. Plugins import from
  core, never the reverse.
- Plugins should stay agnostic of one another. A cross-plugin dependency is
  allowed when it is genuinely reasonable (declared in the plugin's
  `dependencies: [...]`), but agnostic is better. Disabling any plugin should
  leave a working client, just without that feature.
- Plugins don't reach into each other by importing functions. They use a hook
  or an event:
  - **Hook**, `api.hook(name, context, data)`: a chainable async pipeline, for
    when the caller needs a return value or other plugins must transform the
    data.
  - **Event**, `api.trigger(name, data)`: fire and forget, for when plugins
    only need to know something happened.
- Nothing crosses the package boundary with relative paths or unexported
  subpaths (`'../../headless/plugins/…'`, `'@converse/headless/plugins/…'`).
  `@converse/headless` resolves to the built bundle, not source files.

For a plugin import in core, or one plugin reaching into another's internals,
the fix names the hook or event that should replace it.

#### 1.2 Metadata on encrypted messages

"Metadata you can't encrypt is metadata you don't send."

If the change adds message metadata, check what happens under legacy OMEMO.
There, metadata cannot be encrypted, and it must not ride along as cleartext
beside an encrypted message. Metadata features are off for legacy OMEMO
messages unless a `body` fallback already carries the information by design.
A diff that adds metadata without handling this is a leak.

#### 1.3 API surface

"Put it on the right surface, or every integrator inherits your shortcut."

A new function belongs on exactly one surface, not buried where only its own
plugin can reach it:

- **Public `converse`**: the top-level API, for anyone embedding Converse
  or building a front end on it.
- **`_converse`**: closured internal state (`_converse.state`,
  `_converse.exports`). Use sparingly.
- **Utilities**: `converse.env.u`, also importable as
  `import { u } from '@converse/headless'`.
- **Integration API**: namespaced methods on `api` (from
  `@converse/headless`, also `_converse.api`), defined in the plugin's or
  core's `api.js` and merged in with `Object.assign(api, …)` during
  `initialize()`. This is what integrators and front ends build against.

Flag loose exports that belong on one of these, and name which one (for
example `_converse.api.omemo.send`).

New integration API methods follow the plone.api style described under "API
design" in `AGENTS.md`: short verbs chained onto namespaces, as in
`api.user.get()` rather than `api.getUser()`. Flag:

- A new top-level method on `api` instead of one under the plugin's namespace
- A compound method name (`getActive`, `browseFeeds`) where a nested
  namespace would read better (`api.apps.active.get()`,
  `api.microblog.feeds.browse()`). Predicates (`is…`, `can…`) are fine.
- A new verb where an established one (`get`, `set`, `create`, `open`, `add`,
  `remove`) already fits

#### 1.4 Headless runs wherever its front ends do

`@converse/headless` is shared by the web UI, the CLI, and later the TUI, so
it must run in both the browser and Node.js. These block the merge:

- Browser-only globals or APIs in headless code (`window`, `document`,
  `localStorage`, DOM access) without a Node.js path
- Node-only modules in headless code without a browser path
- Assumptions about one front end in headless code: rendering, Lit or
  Bootstrap, or behaviour only the web UI needs

Front-end behaviour belongs in that front end. If a change puts it in
headless so another front end can reuse it, check it is truly front-end
neutral.

### 2. Data structures

"Bad programmers worry about the code. Good programmers worry about data
structures."

- Data structure choices that create needless complexity
- Data copying or transformation that could be eliminated
- Unclear data ownership and flow
- Missing abstractions that would simplify the logic
- Data structures that force special-case handling

### 3. Complexity and special cases

- Special cases and conditional branches that a better data structure or
  design would remove. Name that structure or design in the fix.
- Deep nesting that obscures the core algorithm. Nesting alone is not a
  finding; it is one when a flatter shape (early returns, a lookup table, a
  different structure) would make the logic plainly easier to follow.
- Functions doing several unrelated things
- Code that could be a fraction of its length with no loss of clarity

### 4. Pragmatism

Measured against the intent you found above:

- Does the solution's complexity match the problem's severity?
- Is it engineering for edge cases that cannot occur?
- Could an existing mechanism in Converse (a hook, an event, an existing
  API method or utility) do this?

### 5. Breaking existing users and integrators

- Changes that break the public `converse` API, the integration API
  (`_converse.api`), `converse.env` utilities, or user-visible behaviour
- Changes to public interfaces without a deprecation path
- Unstated assumptions about backward compatibility
- Dependency changes that affect existing users or integrators. If a lockfile
  or manifest change downgrades a dependency, flag it and ask whether it was
  intentional, naming the package and both versions.

### 6. Security and correctness (critical issues only)

Real risks, not theoretical ones:

- Unsanitised user input rendered into the DOM (XSS) or used to build stanzas
- Untrusted text (message bodies, nicknames, room subjects) written to a
  terminal without stripping control characters and escape sequences
- Hardcoded secrets or credentials
- Incorrect use of cryptographic libraries, especially around OMEMO
- Null dereferences, off-by-one errors, race conditions

### 7. Tests that prove the behaviour

If the change adds components, modules, or plugins, or changes user-visible
behaviour, there should be tests that would fail if the behaviour regressed.

- Prefer tests that exercise real code paths (stanza parsing, validation,
  model logic) and assert on outputs or state.
- Lightweight fakes are fine where needed to keep tests fast and
  deterministic.
- Flag tests that only mock the unit under test and assert it was called,
  unless they cover a gap nothing else can reach.

## Severity

Map each finding to one of:

- **high**: core importing from a plugin, a metadata leak under legacy OMEMO,
  breaking headless in the browser or Node.js, a breaking API change, a real
  security or correctness bug, a wrong data structure, or changed behaviour
  with no test.
- **medium**: a function on the wrong API surface, an API method that breaks
  the namespace convention, an avoidable cross-plugin
  dependency, an avoidable special case, a needless layer, an existing
  mechanism ignored.
- **low**: genuinely hurts maintainability but is minor. Omit pure style.

If the change is sound, say so and stop. Do not manufacture findings.

## Output

If the caller specifies an output format, use it exactly, with the severities
above. That format replaces everything below.

Otherwise:

- **Taste rating**: good (simple and sound; stop here), acceptable (works but
  could be cleaner), or needs improvement (violates fundamentals or a
  Converse constraint).
- **Findings**, grouped by severity, each as `path:line`, a category
  (leaky abstraction, OMEMO metadata, API surface, headless portability, data
  structure, complexity, pragmatism, breaking change, security, testing), the
  claim, the evidence in the code, and a concrete fix.
- **Verdict**: worth merging, or needs rework.
- **Key insight**: one sentence on the most important architectural
  observation.

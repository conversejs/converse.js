# Converse.js Agent Guidelines

**Converse.js** is an XMPP chat client built with JavaScript and web tech.
It has a plugin-based architecture, uses JSDoc TypeScript type definitions,
Bootstrap 5 and Lit UI components.

## Monorepo

Three npm workspaces:

- **Root** (`/`): Main package with UI plugins (`src/plugins/`)
- **Headless** (`src/headless/`): Core XMPP logic and state management, separate package `@converse/headless`
  The `@converse/headless` package resolves to the built bundle (`dist/converse-headless.js`),
  **not** to individual source files. Importing from relative paths pointing to `src/headless/`
  back into the main package like `src/plugins` is forbidden since they cross the package boundary.

    Read: src/headless/AGENTS.md

- **Log** (`src/log/`): Logging utility, separate package `@converse/log`

#### Media Repository

Sponsor logos are stored in a separate repository at `https://github.com/conversejs/media`.
This repo should be checked out to the `media/` directory and is git-ignored in the main repo.
Without this repo, sponsor logos in `index.html` and the fullscreen footer will show as broken images.

## Essential Commands

`npm run` lists every script; most names are self-describing (`dev`, `build`, `watch`,
`nodeps`, `cdn`, and their `:headless` / `:main` variants). Recorded here are only the
details you cannot read off `package.json`:

- `npm run dev` builds unminified and keeps `debugger` statements. `npm run build` is the
  minified full build (website CSS, then headless, then main).
- A `:headless` suffix acts on the `@converse/headless` package only, `:main` on the root
  package.
- `npm run devserver` serves with live reload on http://localhost:8008.
- `npm run serve` serves static files on http://localhost:8080, searching upwards for a
  free port if that one is taken. Pass a port with `npm run serve -- -p 8000`.
- `npm run serve-tls` is the HTTPS equivalent and needs a certificate and key in `certs/`.
- `make check` is what CI runs: lint, `npm run types`, a check that the generated types are
  committed, and all tests. Slow, use sparingly.

### Testing

Tests live in a `tests/` subdirectory of each plugin. Mock data is in
`src/headless/tests/mock.js` and `src/shared/tests/mock.js`.

**Always run `npm run dev` before running tests.** Vitest runs against the pre-built `dist/converse.js` bundle,
not source files directly. If you skip the build, you will be testing against a stale bundle and changes to source
files will have no effect.

**The full test suite takes over a minute to run.** Avoid running it unless you need to verify that nothing has
regressed across the entire codebase. When working on a specific feature, pass a file path or use `fdescribe`/`fit`
(see below).

```bash
# Run only specific files (fastest turnaround) — pass a path/substring to vitest
npx vitest run --project main src/plugins/chatview/tests/messages.js
```

> **Which suite to run?** Tests for plugins under `src/headless/` (e.g. smacks, roster,
> status, presence) live in the **headless** suite and will not be picked up by `npm test`.
> Use `npm run test:headless` (or `npm run dev:headless` before it) when
> working in that area. `npm test` only covers the UI plugins under `src/plugins/`.

#### Creating new test files

Just drop the `*.js` file in a plugin's `tests/` directory — Vitest discovers it via the
`include` globs in `vitest.config.js`. Non-spec helpers in a `tests/` dir must be added to
`commonExclude` in `vitest.config.js` so they aren't collected as empty test files.

#### Focusing tests with `fdescribe` / `fit`

**Prefer scoping a run to a file (`npx vitest run --project main path/to/test.js`), or
`fdescribe`/`fit`, over `-t`/`--testNamePattern`.** To focus within a file, temporarily
change `describe` → `fdescribe` or `it` → `fit`, then revert before committing. (The shim
aliases `fdescribe`/`fit` to Vitest's `.only`; note a focused test only narrows within its
own file, so combine it with a file path when running the whole suite.)

```javascript
// Focus an entire suite:
fdescribe('Message Reactions (XEP-0444)', function () { ... });

// Focus a single test:
fit('sends a correct XEP-0444 stanza when a reaction is added', ...);
```

**Always revert `fdescribe`/`fit` back to `describe`/`it` before committing.**

#### Jasmine shim vs. native Vitest APIs

`vitest/setup.jasmine-shim.js` is a thin, **additive** compatibility layer (`spyOn`,
`jasmine.*`, `fdescribe`/`fit`, `toEqualStanza`, matchers like `toBeTrue`/`toHaveSize`) that
lets the existing Jasmine-era specs run unchanged. It does **not** shadow Vitest.

**Write new tests with native Vitest APIs** (`vi.fn`, `vi.spyOn().mockReturnValue()`,
`vi.useFakeTimers`, native matchers). Both styles work and can be mixed in one file:
`globals: true` injects `vi`/`expect`/`describe`/`it` (no imports), `expect` is *extended*
(native + Jasmine matchers coexist), and `spyOn()` returns the underlying Vitest mock (so
`spy.and.returnValue(x)`/`spy.calls.count()` and `spy.mockReturnValue(x)`/
`expect(spy).toHaveBeenCalledOnce()` both work on the same spy).

Two caveats, independent of style:
- **`vi.mock()` can't stub Converse internals** — specs import the prebuilt `dist/converse.js`
  bundle (modules are inlined, no path to intercept). Stub at runtime: `vi.spyOn(converse.env.X, …)`,
  `vi.spyOn(SomeClass.prototype, …)`, `vi.stubGlobal('Notification', …)`.
- **No `.concurrent`** — the suite runs serially (`fileParallelism: false`) because tests
  share global state (`#conversejs`, storage) within a file.

## Code Style and Conventions

Formatting is set by `.prettierrc`. Naming conventions:

- **Files**: `kebab-case.js`
- **Variables**: `snake_case` (`camelCase` for variables referring to functions)
- **Classes**: `PascalCase`
- **Constants**: `UPPER_CASE`
- **Private methods**: `#privateMethod()`
- **Templates**: `tplPlaceholder`
- **Unused vars**: prefix with `_`
- **Logging**: use `log.debug/info/warn/error` from `@converse/log`, not `console`
- **Line endings**: LF

Types are JSDoc annotations in `.js` files. `npm run types` regenerates the `.d.ts` files
under `src/types/` and `src/headless/types/`, which are committed: include them in the
commit when a change alters them.

## Commits

Keep commit messages short: a `type(scope): summary` subject (e.g.
`fix(reactions): …`, `feat(muc): …`) that states what was fixed or which feature was
implemented. Don't explain how; the code and its comments document that.

## Architecture

### Plugin System

Converse.js uses a **plugin-based architecture** powered by `pluggable.js`:

- **Headless plugins** (`src/headless/plugins/`): Core XMPP logic, no UI
- **UI plugins** (`src/plugins/`): Visual components that depend on headless

### Plugin Structure

Every plugin follows this pattern:

```javascript
import { _converse, api, converse } from '@converse/headless';

converse.plugins.add('plugin-name', {
    dependencies: ['other-plugin-1', 'other-plugin-2'], // Other plugins that should be loaded first

    initialize() {
        // Extend Converse's settings with new plugin-specific ones.
        api.settings.extend({
            some_setting: 'default_value',
        });

        // Export models/views for other plugins
        const exports = { MyClass, myFunction };
        Object.assign(_converse.exports, exports);

        // Extend API
        Object.assign(api, my_api_methods);

        // Register event listeners
        api.listen.on('connected', () => {
            /* ... */
        });
    },
});
```

### Plugin Design Philosophy

Converse.js mirrors the XMPP philosophy: a minimal core with features implemented as
plugins corresponding to individual XEPs.

**Avoiding leaky abstractions:** Shared core code (`src/headless/shared/`, e.g.
`model-with-messages.js`) must not contain logic specific to a particular plugin.
Plugin-specific logic belongs in the plugin itself.

**Use hooks and events:** When you need to allow other plugins to participate in a processing flow.

- **Hooks** (`api.hook(name, context, data)`) are chainable async pipelines — each
  listener receives the output of the previous one and can modify the data before passing
  it along. Use hooks when the caller needs a return value or when the data should be
  transformed by plugins.
- **Events** (`api.trigger(name, data)`) are fire-and-forget notifications. Use events
  when plugins need to be informed of something but the caller does not need a response.

**Example:**

```javascript
// In the foundational chat plugin (chat/model.js):
const { handled } = await api.hook('beforeMessageCreated', this, attrs, { handled: false });
if (handled) return;

// In a higher-level plugin (e.g. reactions):
api.listen.on('beforeMessageCreated', (chatbox, attrs, data) => {
    if (attrs.reaction_to_id && !targetExists(chatbox, attrs)) {
        storeDanglingReaction(chatbox, attrs);
        return { ...data, handled: true };
    }
    return data;
});
```

**Apps own navigation; building blocks announce intent.** An app (`src/apps/*`, e.g.
the Chat and Social apps) is itself a plugin that composes lower-level view plugins
(`rosterview`, `muc-views`, etc.). Those building blocks must not import app modules to
navigate: that inverts the dependency arrow (plugin -> app) and couples a reusable view
to a specific app shell. Instead the building block triggers an event and the app
handles it:

```javascript
// In a building block (e.g. rosterview/contactview.js):
api.trigger('openConversation', { view: 'chat', jid });

// In the app plugin (apps/chat/index.js), registered at initialize() so it fires
// regardless of the view's mount state or the view_mode:
api.listen.on('openConversation', ({ view, jid, attrs }) => openConversationRouted(view, jid, attrs));
```

The Social app follows the same convention (`openSocialFeed`, `openMicroblogPost`). Use
a hook instead of an event only when the call site genuinely needs a return value.

### Import Patterns

```javascript
// Headless core imports
import { _converse, api, converse, u } from '@converse/headless';

// Logging
import { log } from '@converse/log';

// Lit framework
import { html, css } from 'lit';

// Relative imports for local files
import ChatView from './chat.js';
import './styles/index.scss';

// Utilities
// Common libraries (`u` is also available here)
const { dayjs, Strophe, sizzle, stx, $msg, $iq, $pres, $build } = converse.env;
```

#### Using utility functions from @converse/headless

Headless utility methods are exposed via the `u` object from `@converse/headless`/

```javascript
import { converse } from '@converse/headless';
const { u } = converse.env;
```

**Wrong approach:**

```javascript
// DON'T cross the package boundary with relative paths or unexported subpaths:
import { getOwnReactionJID } from '../../headless/plugins/reactions/utils.js'; // ❌ relative path
import { getOwnReactionJID } from '@converse/headless/plugins/reactions/utils.js'; // ❌ unexported subpath
```

### Component Patterns

**Lit Components** extend `CustomElement`:

```javascript
import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

export default class MyComponent extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
            some_state: { state: true }, // Internal state
        };
    }

    async initialize() {
        await this.model.initialized;
        // Listen to model changes to trigger re-render
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        return html`<div>...</div>`;
    }
}
api.elements.define('my-component', MyComponent);
```

**Templates** are functions returning `html` tagged templates:

```javascript
import { html } from 'lit';

export default (model) => html`
    <div class="chat-message">
        <span>${model.get('from')}</span>
        <p>${model.get('body')}</p>
    </div>
`;
```

### API Usage Patterns

```javascript
// Settings
api.settings.extend({ 'my_setting': 'default' });
api.settings.get('my_setting');

// Events (fire-and-forget notifications)
api.listen.on('connected', callback);
api.trigger('customEvent', data);

// Hooks (chainable async pipelines — each listener receives and can modify the data)
// Use hooks when a caller needs plugins to intercept or transform data.
const result = await api.hook('hookName', context, data);
api.listen.on('hookName', (context, data) => {
    return { ...data, modified: true }; // Return modified data to pass along the chain
});

// Promises
await api.waitUntil('connected');

// User interaction
const confirmed = await api.confirm('Are you sure?');
await api.alert('Something happened');

// Access global state via `_converse.state` (use sparingly, prefer api)
const { chatboxes } = _converse.state;
```

## Internationalization (i18n)

Translations use gettext `.po` files in `src/i18n/locales/`:

```javascript
import { __ } from '@converse/headless';

const message = __('Hello, %1$s!', username);
```

## Common Patterns and Gotchas

### 1. Async Initialization

Models and collections are initialized asynchronously:

```javascript
await this.model.initialized; // Wait for model
await this.model.messages.fetched; // Wait for data fetch
```

### 2. Event Listening

Use Backbone-style event listeners (automatically cleaned up):

```javascript
this.listenTo(this.model, 'change', () => this.requestUpdate());
this.listenTo(this.model.messages, 'add', this.onMessageAdded);
```

### 3. Waiting for Conditions

Use utility functions to wait:

```javascript
await u.waitUntil(() => sizzle('.chat-msg', view).length > 0);
await api.waitUntil('connected');
```

### 4. Accessing Converse Internals

```javascript
import { _converse, api, converse } from '@converse/headless';

// Access global state via `_converse.state` (use sparingly, prefer api)
const { chatboxes } = _converse.state;
const chatbox = chatboxes.get(jid);

// Access 3rd party libraries
const { Strophe, $msg, $iq, $pres, $build, stx } = converse.env;
```

### 5. Memory Leaks Prevention

- Always use `listenTo` instead of `on` (auto-cleanup on disconnect)
- Call `stopListening()` in `disconnectedCallback()`

## Release Process

Read: RELEASE.md

## Documentation

- **Source**: `docs/src/content/docs/` (Markdown)
- **Framework**: Starlight (Astro)
- **Output**: `docs/dist/`
- **Online**: https://conversejs.org/docs/
- **Self-contained**: the docs have their own `package.json`; building them does not
  require the root `npm install`

Build with `make doc` or `npm run docs:build`; `npm run docs:dev` starts a dev server with
live reload.

### Internal links

The site is built with `base: '/docs/'`, which Starlight applies only to the links it
generates itself (sidebar, frontmatter, pagination). Hand-written Markdown links must
carry it: `/docs/configuration/`, not `/configuration/`. Heading anchors keep
underscores, so `### bosh_service_url` is `#bosh_service_url`.

`starlight-links-validator` fails the build on a missing page or a missing anchor, but
only on a build: `npm run docs:dev` does not report. The CI `docs` job runs it.

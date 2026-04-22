# Converse.js Agent Guidelines

**Converse.js** is an XMPP chat client built with JavaScript and web tech.
It has a plugin-based architecture, uses JSDoc TypeScript type definitions,
Bootstrap 5 and Lit UI components.

## Project Overview

- **Type**: XMPP/Jabber web-based chat client
- **Build Tool**: Rspack (Webpack-compatible)
- **UI Framework**: Lit (Web Components)
- **Testing**: Karma + Jasmine
- **Styling**: SCSS with Bootstrap 5
- **Language**: JavaScript
- **Type System**: TypeScript via JSDoc annotations

## Monorepo

Three npm workspaces:
- **Root** (`/`): Main package with UI plugins (`src/plugins/`)
- **Headless** (`src/headless/`): Core XMPP logic and state management, separate package `@converse/headless`
    The `@converse/headless` package resolves to the built bundle (`dist/converse-headless.js`),
    **not** to individual source files. Importing from relative paths pointing to `src/headless/`
    back into the main package like `src/plugins` is forbidden since they cross the package boundary.

    Read: src/headless/AGENTS.md

- **Log** (`src/log/`): Logging utility, separate package `@converse/log`

### Key Entry Points

- `src/index.js` — Main entry (imports all plugins)
- `src/headless/index.js` — Headless entry
- `src/entry.js` — Alternative entry
- `rspack/` — Build configs

### Directory Structure

```
src/
├── headless/             # Core XMPP logic (separate package @converse/headless)
│   ├── plugins/          # Headless plugins (chat, muc, roster, etc.)
│   ├── shared/           # Shared headless utilities
│   ├── types/            # Generated TypeScript definitions
│   └── dist/             # Built headless package
├── plugins/              # UI plugins
│   ├── chatview/         # Chat UI
│   ├── muc-views/        # Multi-user chat UI
│   ├── rosterview/       # Contact list UI
│   └── controlbox/       # Main control panel
├── shared/               # Shared UI components
│   ├── components/       # Reusable Lit components
│   ├── chat/             # Chat-related shared components
│   ├── modals/           # Modal dialogs
│   └── styles/           # Shared SCSS files
├── templates/            # Lit template functions
├── i18n/                 # Internationalization
│   └── locales/          # Translation files (.po)
├── types/                # Generated TypeScript definitions
└── utils/                # Utility functions
```

## Essential Commands

### Development

```bash
# Development build (unminified, with debugger statements)
npm run dev                   # Build everything in dev mode
npm run dev:headless          # Build only headless package

# Watch mode (auto-rebuild on changes)
npm run watch                 # Watch both headless and main
npm run watch:headless        # Watch only headless
npm run watch:main            # Watch only main package

# Dev server with live reload
npm run devserver             # Starts on http://localhost:8080

# Serve static files
npm run serve                 # Serves on http://localhost:8000 (default)
npm run serve -- -p 8008      # Serve on custom port
npm run serve-tls             # HTTPS server (requires certs/)
```

### Building

```bash
# Production build (minified)
npm run build                 # Full build: headless + ESM + CJS + CSS
npm run build:headless        # Build headless package only
npm run build:esm             # Build ESM bundle
npm run build:cjs             # Build CommonJS bundle
npm run build:website-css     # Build website CSS
npm run build:website-min-css # Build and minify website CSS

# Special builds
npm run nodeps                # Build without dependencies
npm run cdn                   # Build for CDN deployment
```

### Testing

- **Framework**: Karma + Jasmine
- **Test files**: Located in `tests/` subdirectory of each plugin
- **Naming**: `*.js` (e.g., `chatbox.js`, `actions.js`, `corrections.js`)
- **Mock data**: `src/headless/tests/mock.js` and `src/shared/tests/mock.js`

**Always pass `--single-run`** — without it Karma waits for a browser indefinitely and hangs.

**Always run `npm run dev` before running tests.** Karma tests run against the pre-built `dist/converse.js` bundle,
not source files directly. If you skip the build, you will be testing against a stale bundle and changes to source
files will have no effect.

**The full test suite takes over a minute to run.** Avoid running it unless you need to verify that nothing has
regressed across the entire codebase. When working on a specific feature, use `fdescribe`/`fit` instead (see below).

```bash
# Always build first, then test
npm run dev && npm test -- --single-run

# Run tests (--single-run is mandatory)
npm test -- --single-run                    # Run main tests (Karma)
npm run test:all                            # Run both headless and main tests
npm run test:headless -- --single-run       # Run headless tests only
cd src/headless && npm test -- --single-run # Alternative way to run headless tests
```

> **Which suite to run?** Tests for plugins under `src/headless/` (e.g. smacks, roster,
> status, presence) live in the **headless** suite and will not be picked up by `npm test`.
> Use `npm run test:headless -- --single-run` (or `npm run dev:headless` before it) when
> working in that area. `npm test` only covers the UI plugins under `src/plugins/`.

```bash
# Full test suite (as used in CI) — slow, use sparingly
make check                    # Runs lint + types + all tests
```

#### Creating new test files

When creating a new test file, add it to the `files` array in `karma.conf.js`:

```javascript
files: [
    // ... existing files
    { pattern: "src/plugins/my-plugin/tests/my-test.js", type: 'module' },
],
```

#### Focusing tests with `fdescribe` / `fit`

**Prefer `fdescribe`/`fit` over `--grep` for running a subset of tests.** The `--grep`
flag does a substring match on the full test name but is unreliable in practice. Instead,
temporarily change `describe` → `fdescribe` or `it` → `fit` in the test file to focus
only those tests, then revert before committing.

```javascript
// Focus an entire suite:
fdescribe('Message Reactions (XEP-0444)', function () { ... });

// Focus a single test:
fit('sends a correct XEP-0444 stanza when a reaction is added', ...);
```

**Always revert `fdescribe`/`fit` back to `describe`/`it` before committing.**

### Code Quality

```bash
# Linting
npm run lint                  # Run ESLint on all source files

# Type checking
npm run types:check           # TypeScript type checking (no emit)
npm run types                 # Generate type definitions
```

## Code Style and Conventions

### Formatting (Prettier)

- **Files**: `kebab-case.js`
- **Variables**: `snake_case` (`camelCase` for variables referring to functions)
- **Classes**: `PascalCase`
- **Constants**: `UPPER_CASE`
- **Private methods**: `#privateMethod()`
- **Templates**: `tplPlaceholder`
- **Unused vars**: prefix with `_`
- **Logging**: use `log.debug/info/warn/error` from `@converse/log`, not `console`
- **Prettier**: single quotes, 120 line width, 4-space indent, `spaceBeforeFunctionParen`
- **Line endings**: LF

## Architecture

### Plugin System

Converse.js uses a **plugin-based architecture** powered by `pluggable.js`:

- **Headless plugins** (`src/headless/plugins/`): Core XMPP logic, no UI
    - Examples: `chat`, `muc`, `disco`, `roster`, `ping`, `bookmarks`
- **UI plugins** (`src/plugins/`): Visual components that depend on headless
    - Examples: `chatview`, `muc-views`, `rosterview`, `controlbox`

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

### Import Patterns

```javascript
// Headless core imports
import { _converse, api, converse } from '@converse/headless';

// Logging
import { log } from '@converse/log';

// Lit framework
import { html, css } from 'lit';

// Relative imports for local files
import ChatView from './chat.js';
import './styles/index.scss';

// Utilities
import { u } from '@converse/headless'; // Utility functions
const { dayjs, Strophe, sizzle } = converse.env; // Common libraries
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
customElements.define('my-component', MyComponent);
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
```

## TypeScript and Type Definitions

See `tsconfig.json`

### JSDoc for Types

Add JSDoc comments to document types in `.js` files:

### Type Checking

```bash
npm run types:check  # Check types without generating files
npm run types        # Generate type definitions
```

## Styling

### SCSS Organization

- **Framework**: Bootstrap 5 (imported from node_modules)
- **Location**: Component-specific styles in plugin directories
- **Shared styles**: `src/shared/styles/` (alerts, badges, buttons, forms, etc.)
- **Import paths**: Rspack configured with `node_modules/` and `src/` as includePaths

### CSS Loading

Styles are imported directly in JavaScript:

```javascript
import './styles/chat-content.scss';
```

Rspack uses `style-loader` + `css-loader` + `postcss-loader` + `sass-loader` to process and inject styles.

## Internationalization (i18n)

### Translation System

- **Library**: Jed (Gettext for JavaScript)
- **Format**: PO files in `src/i18n/locales/*/LC_MESSAGES/converse.po`

### Using Translations

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

- **Source**: `docs/source/` (ReStructuredText)
- **Build**: `make doc` (requires Python + Sphinx)
- **Output**: `docs/html/`
- **Online**: https://conversejs.org/docs/html/

Generate docs:

```bash
make docsdev  # Install Python dependencies
make doc      # Build HTML documentation
```


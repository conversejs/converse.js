### The @converse/headless package

This is the root of the `@converse/headless` package.

The goal of `@converse/headless` is to provide a basis on which multiple different potential
UIs could be implemented. The UI implemented in this monorepo being only one of them.

## Package boundary

The `@converse/headless` package resolves to the built bundle (`dist/converse-headless.js`),
**not** to individual source files. Importing from relative paths pointing to `src/headless/`
back into the main package like `src/plugins` is forbidden since they cross the package boundary.

The `package.json` exports map does not expose subpaths beyond `"."` and `"./dist/*"`, so deep
imports like `@converse/headless/plugins/reactions/utils.js` would also fail at runtime.

## Directory structure

```
src/headless/
├── index.js              # Entry point — exports all public APIs
├── plugins/              # 20 headless plugins (chat, muc, roster, omemo, smacks, etc.)
├── shared/               # Shared core: _converse, api, models, constants, i18n, parsers
├── utils/                # Core utilities (u object): jid, html, stanza, promise, storage, etc.
├── tests/                # Test helpers (mock.js) and unit tests
└── types/                # Generated TypeScript definitions
```

Each plugin in `plugins/` typically has: `index.js` (registration), `model.js`, `constants.js`,
and optionally `utils.js` and `tests/`.

## Key exports (from index.js)

```javascript
import { _converse, api, converse, log, u, constants, i18n, parsers, errors } from '@converse/headless';
import { Model, Collection, EventEmitter } from '@converse/headless';
import { BaseMessage, ModelWithMessages } from '@converse/headless';
```

## State Management

`@converse/headless` uses a custom fork of Backbone.js called `@converse/skeletor` for state management
by means of Models and Collections.

### Key objects

- **`_converse`**: Closured private namespace with internal state, API, plugins, and data structures.
  - `_converse.state` — Instances of Models and Collections (chatboxes, vcards, profile, disco, session).
  - `_converse.exports` — Classes and code exposed for 3rd party plugins.
  - `_converse.constants` — Plugin constants merged at build time.
  - `_converse.pluggable` — Plugin registry (pluggable.js).
  - `_converse.env` — Bundled 3rd party libs (Strophe, sizzle, dayjs, html, css, stx, u).
  - `_converse.labels` — Translated strings.
  - `_converse.promises` — Open promises for async coordination (e.g. `initialized`).
- **`converse`**: Public global. Has `initialize()` and `plugins.add()`.
- **`api`**: Private API endpoint available as `_converse.api` and imported directly.

## Plugins

Plugins are registered via `converse.plugins.add(name, plugin)` and use `pluggable.js`.

```javascript
import { _converse, api, converse } from '@converse/headless';

converse.plugins.add('my-plugin', {
    dependencies: ['other-plugin'],  // Loaded first; throws if missing when strict_plugin_dependencies is true

    initialize() {
        api.settings.extend({ my_setting: 'default' });

        // Export for other plugins
        Object.assign(_converse.exports, { MyClass, myFunction });

        // Extend API
        Object.assign(api, { myMethod: () => {} });

        // Listen to events
        api.listen.on('connected', () => { /* ... */ });
    },
});
```

### Plugin design rules

- `src/headless/shared/` must NOT contain plugin-specific logic.
- Use **hooks** (`api.hook(name, context, data)`) for chainable async pipelines where listeners
  transform data. Each listener receives the previous output and returns modified data.
- Use **events** (`api.trigger(name, data)`) for fire-and-forget notifications.

```javascript
// Hook example — caller needs return value
const { handled } = await api.hook('beforeMessageCreated', this, attrs, { handled: false });
if (handled) return;

// Event example — notification only
api.trigger('messageReceived', message);
```

## Exposing utility functions

To expose utility functions from a headless plugin for use in UI plugins, assign them to
the `u` utilities object or a namespace on that object. Existing namespaces: `u.omemo`,
`u.muc`, `u.reactions`, `u.roster`, `u.bookmarks`, `u.mam`, `u.emojis`.

```javascript
// In src/headless/plugins/reactions/utils.js — expose via u.reactions namespace:
const { u } = converse.env;
Object.assign(u, {
    reactions: {
        ...u.reactions,
        getOwnReactionJID,
    },
});
```

## Utilities (`u` object)

The `u` object from `converse.env` bundles core utilities:

- **`u.jid`** — JID parsing (bare, domain, resource, escape/unescape)
- **`u.stanza`** — Stanza helpers (`toStanza()`, `getStanzaAttrs()`, `isEqualNode()`)
- **`u.html`** — HTML sanitization and parsing
- **`u.promise`** — Promise utilities (`waitUntil()`, `timeout()`)
- **`u.storage`** — localStorage/sessionStorage helpers
- **`u.text`** — Text utilities (debounce, truncate, etc.)
- **`u.array`**, **`u.object`**, **`u.color`**, **`u.url`**, **`u.arraybuffer`**, **`u.session`**
- **`u.getUniqueId()`** — UUID generation
- **`u.isEmptyMessage()`** — Check if a message has no body/attachments
- **`u.shouldCreateMessage()`** — Determine if a stanza should create a message

## Testing

Tests run against `dist/converse-headless.js`. **Always build before testing.**

```bash
npm run dev:headless && npm test -- --single-run   # from workspace root
cd src/headless && npm run dev && npm test -- --single-run  # from workspace dir
```

### Test patterns

```javascript
/* global converse */
import { mock, domain } from '../../tests/mock.js';

describe('My Plugin', function () {
    it('does something',
        mock.initConverse([], {}, async function (_converse) {
            // _converse is the private instance
            // Use u.waitUntil() for async assertions
            const { u } = window.converse.env;
            await u.waitUntil(() => _converse.state.chatboxes.length > 0);
        })
    );
});
```

- `mock.initConverse(skip, settings, fn)` — Initialize converse for a test
- `mock.waitForRoster(_converse, type, length)` — Wait for roster IQ
- `jasmine.toEqualStanza()` — Custom matcher for XML stanza comparison
- `stx` template literal — Preferred way to create XML stanzas in tests
- New test files must be added to `karma.conf.js` `files` array

## Common libraries (via `converse.env`)

```javascript
const { Strophe, $msg, $iq, $pres, $build, stx, Stanza } = converse.env;   // XMPP
const { sizzle } = converse.env;                                           // DOM query
const { dayjs } = converse.env;                                            // Date handling
const { html, css, nothing, render } = converse.env;                       // Lit
const { Model, Collection } = converse.env;                                // Skeletor
const { sprintf } = converse.env;                                          // String formatting
const { filesize } = converse.env;                                         // File size formatting
const { errors, TimeoutError } = converse.env;                             // Error types
```

### XML stanzas

Use `stx` template literal (preferred). `$msg`, `$pres`, `$iq`, `$build` are deprecated.

```javascript
const { stx, Strophe } = converse.env;

const msg = stx`
    <message to="${jid}" type="chat" xmlns="jabber:client">
        <body>Hello</body>
        <active xmlns="${Strophe.NS.CHATSTATES}"/>
    </message>`;
```

When using `stx`, the `xmlns` attribute always needs to be set to `"jabber:client"`.

## Build commands (from this workspace)

```bash
npm run dev           # Dev build with debugger statements
npm run build         # Production build (minified)
npm run watch         # Auto-rebuild on changes
npm test -- --single-run  # Run tests (always use --single-run)
npm run types         # Generate TypeScript definitions
```

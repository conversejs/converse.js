# Converse.js Agent Guidelines

**Converse.js** is a modern, feature-rich XMPP chat client that runs in web browsers.
It's a plugin-based architecture written in JavaScript with TypeScript type definitions,
using the Lit framework for UI components.

## Project Overview

- **Type**: XMPP/Jabber web-based chat client
- **License**: MPL-2.0
- **Build Tool**: Rspack (Webpack-compatible)
- **UI Framework**: Lit (Web Components)
- **Testing**: Karma + Jasmine
- **Styling**: SCSS with Bootstrap 5
- **Language**: JavaScript
- **Type System**: TypeScript via JSDoc annotations (allowJs + checkJs)
- **Package Manager**: npm with workspaces

## Workspace Structure

This is a **monorepo** with npm workspaces:

- **Root** (`/`): Main Converse.js package with UI plugins
- **Headless** (`src/headless/`): Core XMPP logic without UI (separate npm package `@converse/headless`)
- **Log** (`src/log/`): Logging utility (separate npm package `@converse/log`)

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

```bash
# Run tests
npm test                      # Run main tests (Karma)
npm run test:all              # Run both headless and main tests
npm run test:headless         # Run headless tests only
cd src/headless && npm test   # Alternative way to run headless tests

# Single run (for CI)
npm test -- --single-run
npm run test:all              # Already includes --single-run

# Full test suite (as used in CI)
make check                    # Runs lint + types + all tests
```

### Code Quality

```bash
# Linting
npm run lint                  # Run ESLint on all source files

# Type checking
npm run types:check           # TypeScript type checking (no emit)
npm run types                 # Generate type definitions

# Clean
npm run clean                 # Remove node_modules, dist, builds
```

### Make Targets (Alternative)

```bash
make dev                      # Same as npm run dev
make devserver                # Same as npm run devserver
make watch                    # Same as npm run watch
make check                    # Lint + types + tests (full CI suite)
make test                     # Run tests
make test-headless            # Run headless tests
make serve                    # Serve on port 8008
```

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
    dependencies: ['other-plugin-1', 'other-plugin-2'], // Required plugins
    
    initialize () {
        // Configure plugin settings
        api.settings.extend({
            'some_setting': 'default_value',
        });
        
        // Export models/views for other plugins
        const exports = { MyClass, myFunction };
        Object.assign(_converse, exports);        // DEPRECATED pattern
        Object.assign(_converse.exports, exports); // Current pattern
        
        // Extend API
        Object.assign(api, my_api_methods);
        
        // Register event listeners
        api.listen.on('connected', () => { /* ... */ });
    }
});
```

### Directory Structure

```
src/
├── headless/             # Core XMPP logic (separate package)
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

## State Management

Converse.js uses a custom fork of Backbone.js called **@converse/skeletor** for state management
by means of Models and Collections of Models.

### Key Concepts

- **Models**: Represent individual data entities with attributes and methods for manipulating that data
- **Collections**: Ordered sets of models with methods for managing groups of models

### Why Skeletor?

As Converse.js evolved, the team created @converse/skeletor as a fork of Backbone.js to:
- Maintain compatibility with existing code while allowing customization
- Remove unused Backbone features to reduce bundle size
- Enable better TypeScript integration

### Working with Models

```javascript
// Creating a model instance
const chatroom = new _converse.exports.ChatRoom({
    jid: 'room@muc.example.com',
    nick: 'user123'
});

// Accessing model attributes
const jid = chatroom.get('jid');

// Listening to model changes
chatroom.on('change:subject', () => {
    console.log('Room subject changed');
});

// Saving model changes
chatroom.save({'subject': 'New Subject'});
```

### Working with Collections

```javascript
// Accessing the chatboxes collection
const chatboxes = _converse.state.chatboxes;

// Finding a specific model in a collection
const chatbox = chatboxes.get('user@example.com');

// Adding a model to a collection
chatboxes.add(new _converse.ChatBox({...}));

// Listening to collection events
chatboxes.on('add', (chatbox) => {
    console.log('New chatbox added:', chatbox.get('jid'));
});
```

### Integration with Lit Components

While UI components use Lit, they integrate with Skeletor models:

```javascript
class ChatRoomView extends CustomElement {
    async initialize() {
        // Wait for model to be ready
        await this.model.initialized;
        
        // Listen to model changes to trigger re-render
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'add', () => this.requestUpdate());
        
        this.requestUpdate();
    }
    
    render() {
        return html`
            <div class="chatroom">
                <header>${this.model.get('name')}</header>
                <!-- Render messages, participants, etc. -->
            </div>
        `;
    }
}
```

## Code Style and Conventions

### Formatting (Prettier)

```javascript
{
  "singleQuote": true,           // Use single quotes
  "printWidth": 120,             // Max line length 120 chars
  "tabWidth": 4,                 // 4-space indentation
  "useTabs": false,              // Spaces, not tabs
  "spaceBeforeFunctionParen": true  // function () not function()
}
```

### Naming Conventions

- **Files**: `kebab-case.js` (e.g., `chat-content.js`, `message-history.js`)
- **Variables**: `snake_case` (e.g., `muc_jid`)
- **Variables/Functions**: `camelCase` (e.g., `getMessage`, `chatBoxView`)
- **Classes**: `PascalCase` (e.g., `ChatBox`, `CustomElement`)
- **Constants**: `UPPER_CASE` (e.g., `PRIVATE_CHAT_TYPE`, `WINDOW_SIZE`)
- **Private methods**: Prefix with `#` (e.g., `#markScrolled()`)
- **Templates**: Prefix with `tpl` (e.g., `tplPlaceholder`)

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

// Events
api.listen.on('connected', callback);
api.trigger('customEvent', data);

// Promises
await api.waitUntil('connected');

// Disco features
api.disco.own.features.add(Strophe.NS.SPOILER);

// User interaction
const confirmed = await api.confirm('Are you sure?');
await api.alert('Something happened');
```

## TypeScript and Type Definitions

### Configuration

- **Target**: ES2020
- **Module**: ESNext
- **Type Generation**: `allowJs: true`, `checkJs: true`, `declaration: true`
- **Files**: `.js` for implementation, `.d.ts` generated automatically
- **Location**: Generated types go in `src/types/` and `src/headless/types/`

### JSDoc for Types

Add JSDoc comments to document types in `.js` files:

```javascript
/**
 * @typedef {Object} MessageAttributes
 * @property {string} body - Message body text
 * @property {string} from - Sender JID
 * @property {string} type - Message type
 */

/**
 * @param {string} jid - The JID to check
 * @returns {Promise<boolean>}
 */
async function isContact(jid) {
    // ...
}
```

### Type Checking

```bash
npm run types:check  # Check types without generating files
npm run types        # Generate type definitions
```

## Testing

### Test Structure

- **Framework**: Karma + Jasmine
- **Test files**: Located in `tests/` subdirectory of each plugin
- **Naming**: `*.js` (e.g., `chatbox.js`, `actions.js`, `corrections.js`)
- **Mock data**: `src/headless/tests/mock.js` and `src/shared/tests/mock.js`

### Test Patterns

```javascript
/*global mock, converse */

const { api } = converse;
const u = converse.env.utils;
const sizzle = converse.env.sizzle;

describe("My Feature", function () {
    it("does something", mock.initConverse(['chatBoxesFetched'], 
        { view_mode: 'fullscreen' }, 
        async function (_converse) {
            // Setup
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            
            // Test action
            const jid = 'user@example.com';
            await mock.openChatBoxFor(_converse, jid);
            const view = _converse.chatboxviews.get(jid);
            
            // Assertions
            await u.waitUntil(() => sizzle('.chat-msg', view).length === 1);
            expect(view.querySelector('.chat-msg__text').textContent).toBe('hello');
        }
    ));
});
```

### Running Specific Tests

To run a specific test file, add it to the `files` array in `karma.conf.js`:

```javascript
files: [
    // ... existing files
    { pattern: "src/plugins/my-plugin/tests/my-test.js", type: 'module' },
],
```

Or run headless tests:

```bash
cd src/headless
npm test  # Runs karma with src/headless/karma.conf.js
```

## Styling

### SCSS Organization

- **Framework**: Bootstrap 5 (imported from node_modules)
- **Location**: Component-specific styles in plugin directories
- **Shared styles**: `src/shared/styles/` (alerts, badges, buttons, forms, etc.)
- **Import paths**: Rspack configured with `node_modules/` and `src/` as includePaths

### Style Patterns

```scss
// Import Bootstrap utilities
@import "bootstrap/scss/functions";
@import "bootstrap/scss/variables";

// Component styles
.chat-content {
    &__messages {
        overflow-y: auto;
    }
    
    &__notifications {
        padding: 1rem;
    }
}
```

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
- **40+ languages** supported (ar, ca, de, es, fr, ja, ru, zh, etc.)

### Using Translations

```javascript
import { __ } from '@converse/headless';

const message = __('Hello, %1$s!', username);
const plural = __('%1$d messages', count);
```

### Translation Workflow

```bash
# Extract strings from source
npm run nodeps  # Builds converse-no-dependencies.js
make pot        # Generates src/i18n/converse.pot

# Update existing translations
make po         # Merges pot into all locale .po files
```

## Build System (Rspack)

### Configuration Files

- `rspack/rspack.common.js` - Shared config (loaders, plugins)
- `rspack/rspack.build.js` - Main build
- `rspack/rspack.build.cjs.js` - CommonJS build
- `rspack/rspack.build.esm.js` - ESM build
- `rspack/rspack.headless.js` - Headless build
- `rspack/rspack.serve.js` - Dev server config
- `rspack/rspack.nodeps.js` - Build without dependencies

### Important Loaders

- **po-loader**: Converts `.po` translation files to Jed format
- **sass-loader**: Compiles SCSS to CSS
- **style-loader**: Injects CSS into DOM
- **css-loader**: Resolves `@import` and `url()` in CSS
- **postcss-loader**: Autoprefixer for vendor prefixes

### Environment Variables

```bash
DROP_DEBUGGER=true     # Remove debugger statements (production)
ASSET_PATH=/dist/      # Public path for assets (default)
ASSET_PATH=https://cdn.conversejs.org/dist/  # CDN path
```

## Common Patterns and Gotchas

### 1. Async Initialization

Models and collections are initialized asynchronously:

```javascript
await this.model.initialized;        // Wait for model
await this.model.messages.fetched;   // Wait for data fetch
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

// Access global state (use sparingly, prefer api)
_converse.chatboxes.get(jid);

// Access libraries
const { Strophe, $msg, $iq, dayjs, sizzle, u } = converse.env;

// XMPP stanzas
const stanza = $msg({ to: jid, type: 'chat' })
    .c('body').t('Hello').up()
    .c('active', { xmlns: Strophe.NS.CHATSTATES });
```

### 5. Custom Elements

Always define custom elements:

```javascript
class MyElement extends CustomElement { /* ... */ }
customElements.define('my-element', MyElement);
```

Use in HTML:

```javascript
html`<my-element .model="${this.model}"></my-element>`
```

### 6. Lit Property Binding

```javascript
// Set properties with . prefix
.model="${this.model}"

// Set attributes with regular syntax
id="my-id"
class="my-class"

// Boolean attributes with ?
?disabled="${this.isDisabled}"

// Event handlers with @
@click="${this.handleClick}"
```

### 7. Memory Leaks Prevention

- Always use `listenTo` instead of `on` (auto-cleanup on disconnect)
- Call `stopListening()` in `disconnectedCallback()`
- Use `u.debounce()` for frequent operations

### 8. ESLint Rules

- **Unused vars**: Prefix with `_` to ignore (e.g., `_unused`)
- **No console**: Allowed (use `log.debug()`, `log.info()`, `log.error()` instead)
- **Prefer const**: Use `const` by default, `let` when reassignment needed
- **Max line length**: 120 characters (ignores comments, strings, URLs)
- **Unix line endings**: LF not CRLF

## CI/CD

### GitHub Actions

- **Workflow**: `.github/workflows/karma-tests.yml`
- **Node version**: 22.x
- **Command**: `make check ARGS=--single-run`
- **Environment**: Ubuntu with Xvfb (for Chrome headless)

### CI Test Command

```bash
make check  # Runs: eslint + types + tests (headless + main)
```

This command:
1. Runs `npm run lint` (ESLint)
2. Runs `npm run types` (generate types)
3. Checks for uncommitted type changes
4. Runs headless tests: `cd src/headless && npm run test -- --single-run`
5. Runs main tests: `npm run test -- --single-run`

## Debugging

### Development Tools

```javascript
// Access converse object in browser console
window.converse

// API methods
converse.api.user.jid()
converse.api.settings.get('jid')
converse.api.chatboxes.get('user@example.com')

// Internal state
converse._converse
converse._converse.chatboxes.models
```

### Debug Logging

```javascript
import { log } from '@converse/log';

log.debug('Debug message');
log.info('Info message');
log.warn('Warning message');
log.error('Error message');
```

Set log level in settings:

```javascript
converse.initialize({
    loglevel: 'debug', // 'debug', 'info', 'warn', 'error'
});
```

### Common Issues

1. **Import errors**: Check path aliases in `rspack.common.js` resolve section
2. **Style not applying**: Make sure SCSS import is at top of plugin entry file
3. **Component not rendering**: Check `customElements.define()` is called
4. **Tests failing**: Ensure `await mock.waitForRoster()` and other setup completes
5. **Type errors**: Run `npm run types` to regenerate definitions

## Release Process

See `Makefile` and `RELEASE.md` for full details:

```bash
# Update version in all files
make version VERSION=12.1.0

# Create release
make publish BRANCH=master

# Post-release (bump to dev version)
make postrelease VERSION=12.1.0
```

## Documentation

- **Source**: `docs/src/content/docs/` (Markdown)
- **Framework**: Starlight (Astro)
- **Build**: `make doc` or `npm run docs:build`
- **Dev server**: `npm run docs:dev`
- **Output**: `docs/dist/`
- **Online**: https://conversejs.org/docs/

Generate docs:

```bash
make doc           # Build HTML documentation
npm run docs:dev   # Start dev server with live reload
npm run docs:build # Build for production
```

## Key Files to Know

- `package.json` - Main package config, scripts, dependencies
- `src/headless/package.json` - Headless package config
- `karma.conf.js` - Main test configuration
- `src/headless/karma.conf.js` - Headless test configuration
- `eslint.config.mjs` - ESLint rules
- `.prettierrc` - Prettier formatting rules
- `tsconfig.json` - TypeScript configuration
- `Makefile` - Build targets and release automation
- `src/index.js` - Main entry point (imports all plugins)
- `src/headless/index.js` - Headless entry point
- `src/entry.js` - Alternative entry point

## Additional Resources

- **Main docs**: https://conversejs.org/docs/
- **Plugin development**: https://conversejs.org/docs/development/plugin-development/
- **Configuration**: https://conversejs.org/docs/configuration/
- **Chat room**: xmpp:discuss@conference.conversejs.org?join
- **GitHub**: https://github.com/conversejs/converse.js

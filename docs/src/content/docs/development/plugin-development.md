---
title: Writing a Plugin
description: Guide to developing Converse plugins using the pluggable.js architecture.
---

## Introduction

Converse has a plugin architecture based on [pluggable.js](https://github.com/jcbrand/pluggable.js/)
and is itself composed of plugins.

Plugins live in the `src/plugins/` directory (for UI plugins) and
`src/headless/plugins/` directory (for headless/core plugins).

The plugin architecture lets you add new features or modify existing functionality in a
modular, self-contained way, without having to change other files.

To understand how the plugin architecture works more deeply, read the
[pluggable.js documentation](https://jcbrand.github.io/pluggable.js/)
and to understand its inner workings, refer to the [annotated source code](https://jcbrand.github.io/pluggable.js/docs/pluggable.html).

## Why write a plugin?

Writing a plugin is the recommended way to customize or add new features to Converse.

The main benefit of plugins is **isolation of concerns**.
From this benefit flows various secondary advantages:

- **Smaller production builds** — exclude unused plugins to reduce bundle size
- **Easier upgrades** — avoid touching Converse's internals, making updates smoother
- **Proprietary modifications** — the Mozilla Public License version 2 doesn't require you to open source your plugin files

:::caution
The licensing exception for proprietary plugins doesn't apply if you use libsignal for
OMEMO encryption, because libsignal's license is GPLv3 (which applies to the entire app).
:::

Each plugin lives in its own file, and Converse's plugin architecture,
[pluggable.js](https://github.com/jcbrand/pluggable.js/), lets you "hook in" to the core code and other plugins.

Plugins enable you to extend and override existing objects, functions, models, and views.
You can also create entirely new models and views.

:::note[Try it out in JSFiddle]
Because Converse itself consists only of JavaScript, HTML, and CSS (with no backend
code required), it runs fine in JSFiddle.

Here's a Fiddle with a Converse plugin that calls `alert` once it gets
initialized and also when a chat message gets rendered: https://jsfiddle.net/4drfaok0/15/
:::

## Registering a plugin

Plugins need to be registered (and whitelisted) before they can be loaded and
initialized.

You register a Converse plugin by calling `converse.plugins.add`.

The plugin itself is a JavaScript object which usually has at least an
`initialize` method. This method gets called at the end of
`converse.initialize()`, the top-level method that websites call
to configure and initialize Converse.

Here's a basic example:

```javascript
converse.plugins.add('myplugin', {

    initialize () {
        // This method gets called once converse.initialize has been called
        // and the plugin itself has been loaded.

        // Inside this method, you have access to the closured
        // _converse object as an attribute on "this".
        // E.g. this._converse
    },
});
```

:::caution[Order matters!]
It's important that `converse.plugins.add` is called **before**
`converse.initialize`. Otherwise the plugin will never get
registered or called.
:::

## Whitelisting plugins

As of Converse 3.0.0 and higher, plugins need to be whitelisted before they
can be used. This is a security measure because plugins have access to a powerful API.
For example, they can read all messages and send messages on the user's behalf.

To avoid malicious plugins being registered (e.g., by malware-infected
advertising networks), we require whitelisting.

To whitelist a plugin, specify [`whitelisted_plugins`](/configuration/#whitelisted_plugins) when
you call `converse.initialize`:

```javascript
converse.initialize({
    whitelisted_plugins: ['myplugin'],
    // ... other settings
});
```

If you're adding a "core" plugin (one that will be included in the default, open-source
version of Converse), you'll instead whitelist it by adding its name to the `core_plugins` array in
[src/headless/core.js](https://github.com/conversejs/converse.js/blob/master/src/headless/core.js)
or the `WHITELISTED_PLUGINS` array in [src/converse.js](https://github.com/conversejs/converse.js/blob/master/src/converse.js).

Where you add it depends on whether your plugin is part of the headless build
(meaning it doesn't contain any view/UI code) or not.

## Security and access to the inner workings

The globally available `converse` object, which exposes API methods like
`initialize` and `plugins.add`, is a wrapper that encloses and protects
a sensitive inner object named `_converse` (note the underscore prefix).

This inner `_converse` object contains all the models and views,
as well as various other attributes and functions.

Within a plugin, you have access to this internal
["closured"](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
`_converse` object, which is normally not exposed in the global variable scope.

The inner `_converse` object is kept private to safely hide and
encapsulate sensitive information and methods that shouldn't be exposed
to any third-party scripts running on the same page.

### Accessing third-party libraries

Inside your plugin, you can access third-party libraries (such as dayjs) via the `converse.env` object:

```javascript
const { Promise, Strophe, dayjs, sizzle, $build, $iq, $msg, $pres } = converse.env;
```

These dependencies are closured so they don't pollute the global
namespace, that's why you need to access them this way inside your plugin.

## Plugin dependencies

When you register event or promise handlers in your plugin for
events/promises that fire in other plugins, you want those plugins to have
been loaded before your plugin gets loaded.

To handle this, use the `dependencies` array attribute.
This lets you specify which plugins need to be loaded before yours:

```javascript
converse.plugins.add('myplugin', {

    dependencies: ['converse-muc', 'converse-chatview'],

    initialize () {
        // Now you can safely use features from converse-muc and converse-chatview
    },
});
```

In some cases, you might want to depend on another plugin if it's available,
but not require it.

If the [`strict_plugin_dependencies`](/configuration/#strict_plugin_dependencies) setting is set to `false` (which is
the default), then no error will be raised if a dependency plugin is not found.

## Extending Converse's configuration settings

Converse comes with various [configuration settings](/configuration/) that can be used to
modify its functionality and behavior.

All configuration settings have default values which can be overridden when
`converse.initialize` gets called.

Plugins often need their own additional configuration settings. You can add
these with the `api.settings.extend` method:

```javascript
converse.plugins.add('myplugin', {

    initialize () {
        const { api } = this._converse;

        api.settings.extend({
            'my_custom_setting': 'default_value',
            'another_setting': true,
        });

        // Later, read the setting:
        const value = api.settings.get('my_custom_setting');
    },
});
```

## Exposing promises

Converse has a `waitUntil` API method that allows you to wait for various promises
to resolve before executing code.

You can add new promises for your plugin by calling `api.promises.add`:

```javascript
api.promises.add('myPluginReady');
```

Your plugin is then responsible for resolving these promises. You do this by calling
`api.trigger`, which both resolves the promise and emits an event with the same name:

```javascript
api.trigger('myPluginReady');
```

## Dealing with asynchronicity

Due to the asynchronous nature of XMPP, many subroutines in Converse execute
at different times and not necessarily in the same order.

When you want to execute code in a plugin, you often need to make sure that
the supporting data structures your code relies on have been created and populated.

There are two ways to wait for the right time before executing your code:

1. **Listen for events**
2. **Wait for promises to resolve**

### Example: Waiting for connection

If you want to query the message archive between you and a friend, you might call:

```javascript
api.archive.query({ 'with': 'friend@example.org' });
```

However, calling this immediately in your plugin's `initialize` method won't work
because the user isn't logged in yet.

Instead, listen for the `connected` event first:

```javascript
converse.plugins.add('myplugin', {

    initialize () {
        const { api } = this._converse;

        api.listen.on('connected', () => {
            api.archive.query({ 'with': 'friend@example.org' });
        });
    }
});
```

### Example: Waiting for multiple conditions

Sometimes you need to wait for multiple things to be ready. Use `Promise.all` with `api.waitUntil`:

```javascript
converse.plugins.add('myplugin', {

    initialize () {
        const { api } = this._converse;

        Promise.all([
            api.waitUntil('chatBoxesFetched'),
            api.waitUntil('roomsPanelRendered')
        ]).then(() => {
            // Both conditions are now met — safe to proceed
            this.initMyFeature();
        });
    }
});
```

### Example: Responding to events

You can also listen for specific events to trigger your code:

```javascript
api.listen.on('chatBoxOpened', (view) => {
    // A chat box was just opened — add your custom button or behavior
    console.log('Chat opened with:', view.model.get('jid'));
});
```

Finding the right promises and events to listen to can be challenging.
If you need new events or promises,
[please open an issue or make a pull request on GitHub](https://github.com/conversejs/converse.js).

## Hooks

Converse has the concept of `hooks` — special events that let you modify behavior at runtime.

A hook differs from a regular event in two important ways:

1. **Converse waits** for all handlers of a hook to finish before continuing
2. **Handlers can modify the payload** and return updated data

These properties make it possible for plugins to intercept and update data
without resorting to overrides.

### How hooks work

A hook is triggered like this:

```javascript
async function hookTriggerExample () {
    const payload = { foo: 'bar' };
    const updated_payload = await api.hook('hookName', this, payload);
    return updated_payload;
}
```

In a plugin, you register a listener for this hook:

```javascript
api.listen.on('hookName', (context, payload) => {
    // Add to the payload and return it
    return { ...payload, 'baz': 'buzz' };
});
```

The `context` parameter is usually the `this` of the function that triggered the hook
(or sometimes a `Model` instance).

The `payload` parameter is the data passed when the hook was triggered.

After all handlers run, the `updated_payload` returned from the hook trigger looks like:

```javascript
{ foo: 'bar', baz: 'buzz' }
```

Your plugin added data to the payload without any coupling between the code!

### Real-world example

A good example is the
[getMessageActionButtons](https://conversejs.org/docs/html/api/-_converse.html#event:getMessageActionButtons)
hook, which lets you add, modify, or remove the action buttons on chat messages.

The [Actions](https://github.com/conversejs/community-plugins/tree/master/packages/actions)
community plugin uses this hook to add extra actions like `like` or `dislike` to messages.

## Overriding templates

Converse uses [Lit](https://lit.dev/) templates, which are imported as separate files.

You can configure your module bundler (e.g., Webpack or Rspack) to load a different file
when a template is imported, allowing you to substitute your own custom templates.

With Webpack/Rspack, specify an `alias` for the template you want to override:

```javascript
// In your webpack/rspack config
resolve: {
    extensions: ['.js'],
    modules: [
        path.join(__dirname, 'node_modules'),
        path.join(__dirname, 'node_modules/converse.js/src')
    ],
    alias: {
        'plugins/profile/templates/profile.js$': path.resolve(__dirname, 'templates/custom-profile.js')
    }
}
```

This overrides the template at `plugins/profile/templates/profile.js`
with your own template at `templates/custom-profile.js`.

## Overriding custom elements

Converse defines many custom elements derived from the `CustomElement` class
and declared using `api.elements.define`.

You can redefine any custom element by calling `api.elements.define` again in your plugin's `initialize` method.
To extend an existing element, get its class from `api.elements.registry`:

```javascript
converse.plugins.add('myplugin', {

    initialize () {
        const { api } = this._converse;
        const { html } = converse.env;

        const Message = api.elements.registry['converse-chat-message'];

        class MyMessage extends Message {
            render () {
                return html`<div class="my-wrapper">MyPlugin was here! ${super.render()}</div>`;
            }
        }

        api.elements.define('converse-chat-message', MyMessage);
    },
});
```

## A complete example plugin

Here's a documented example of a plugin that demonstrates several concepts:

```javascript
import { converse } from '@converse/headless';

// Access third-party libraries from converse.env
const { Strophe, dayjs, html } = converse.env;

converse.plugins.add('myplugin', {

    // Plugins that must be loaded before this one
    dependencies: [],

    initialize () {
        // Access the internal _converse object and api
        const { _converse, api } = this;

        api.log.info('The "myplugin" plugin is being initialized');

        // Add custom configuration settings
        api.settings.extend({
            'my_plugin_greeting': 'Hello from MyPlugin!'
        });

        // Read a setting
        const greeting = api.settings.get('my_plugin_greeting');
        console.log(greeting);

        // Listen for events
        api.listen.on('connected', () => {
            api.log.info('User connected — MyPlugin is ready!');
        });

        // Use a hook to add a custom toolbar button
        api.listen.on('getToolbarButtons', (toolbar_el, buttons) => {
            buttons.push(html`
                <button class="my-button" @click=${() => alert('Hello from MyPlugin!')}>
                    <converse-icon class="fa fa-star" size="1em"></converse-icon>
                </button>
            `);
            return buttons;
        });
    }
});
```

To use this plugin, make sure to whitelist it when initializing Converse:

```javascript
converse.initialize({
    whitelisted_plugins: ['myplugin'],
    // ... other settings
});
```

That's it! You now have the foundation to build your own Converse plugins.
If you have questions or need help, feel free to join the chat at
[discuss@conference.conversejs.org](xmpp:discuss@conference.conversejs.org?join).

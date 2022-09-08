.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/plugin_development.rst">Edit me on GitHub</a></div>

.. _`writing-a-plugin`:

Writing a plugin
================

Introduction
------------

Converse.js has a plugin architecture based on `pluggable.js <https://github.com/jcbrand/pluggable.js/>`_
and is itself composed out of plugins.

There are only a few files that are included in the default build of Converse
which aren't plugins.

An important one is `core.js <https://github.com/conversejs/.js/blob/master/src/headless/core.js>`_,
which is responsible for bootstrapping the plugin architecture,
setting up and maintaining the connection to the XMPP
server and declaring the public (`window.converse </docs/html/api/converse.html>`_) and protected (`_converse.api </docs/html/api/-_converse.api.html>`_) APIs.

The other non-plugin files all contain utility methods in
`src/utils <https://github.com/conversejs/converse.js/blob/master/src/utils>`_ and
`src/headless/utils <https://github.com/conversejs/converse.js/blob/master/src/headless/utils>`_.

As a general rule, any file in the ``./src`` directory that starts with
``converse-`` is a plugin (with the exception of ``converse-core.js``.

The plugin architecture lets you add new features or modify existing functionality in a
modular and self-contained way, without having to change other files.

This ensures that plugins are fully optional (one of the design goals of
Converse) and can be removed from the main build without breaking the app.
For example, the ``converse-omemo``,
``converse-rosterview``, ``converse-dragresize``, ``converse-minimize``,
``converse-muc`` and ``converse-muc-views`` plugins can all be removed from the
build without breaking the app.

To more deeply understand how the plugin architecture works, read the
`pluggable.js documentation <https://jcbrand.github.io/pluggable.js/>`_
and to understand its inner workings, refer to the `annotated source code
<https://jcbrand.github.io/pluggable.js/docs/pluggable.html>`_.

Advantages of plugins
---------------------

Writing a plugin is the recommended way to customize or add new features to Converse.

The main benefit of plugins is that they allow for **isolation of concerns** (and features).
From this benefit flows various 2nd order advantages, such as the ability to
make smaller production builds (by excluding unused plugins) and an easier
upgrade path by avoiding touching Converse's internals.

Plugins are especially useful if you want to add proprietary modifications, since the
Mozilla Public License version 2 doesn't require you to open source your
plugin files. Be aware that this doesn't apply when you intend to use libsignal for
OMEMO encryption because libsignal's license is GPLv3 (and turns the entire app
into a GPLv3 app).

Each plugin comes in its own file, and Converse's plugin architecture,
`pluggable.js <https://github.com/jcbrand/pluggable.js/>`_, provides you
with the ability to "hook in" to the core code and other plugins.

Plugins enable developers to extend and override existing objects,
functions and the models and views that make up
Converse. You can also create new models and views.

.. note:: **Trying out a plugin in JSFiddle**

    Because Converse consists only of JavaScript, HTML and CSS (with no backend
    code required like PHP, Python or Ruby) it runs fine in JSFiddle.

    Here's a Fiddle with a Converse plugin that calls ``alert`` once it gets
    initialized and also when a chat message gets rendered: https://jsfiddle.net/4drfaok0/15/


.. note:: **Generating a plugin with Yeoman**

    The rest of this document explains how to write a plugin for Converse and
    ends with a documented example of a plugin.

    There is a `Yeoman <http://yeoman.io/>`_ code generator, called
    `generator-conversejs <https://github.com/jcbrand/generator-conversejs>`_, which
    you can use to generate plugin scaffolding/boilerplate that serves as a
    starting point and basis for writing your plugin.

    Please refer to the `generator-conversejs <https://github.com/jcbrand/generator-conversejs>`_
    README for information on how to use it.

Registering a plugin
--------------------

Plugins need to be registered (and whitelisted) before they can be loaded and
initialized.

You register a Converse plugin by calling ``converse.plugins.add``.

The plugin itself is a JavaScript object which usually has at least an
``initialize`` method, which gets called at the end of the
``converse.initialize`` method which is the top-level method that gets called
by the website to configure and initialize Converse itself.

Here's an example code snippet:

.. code-block:: javascript

    converse.plugins.add('myplugin', {

        initialize: function () {
            // This method gets called once converse.initialize has been called
            // and the plugin itself has been loaded.

            // Inside this method, you have access to the closured
            // _converse object as an attribute on "this".
            // E.g. this._converse
        },
    });

.. note:: It's important that `converse.plugins.add` is called **before**
    `converse.initialize` is called. Otherwise the plugin will never get
    registered and never get called.

Whitelisting of plugins
-----------------------

As of Converse 3.0.0 and higher, plugins need to be whitelisted before they
can be used. This is because plugins have access to a powerful API. For
example, they can read all messages and send messages on the user's behalf.

To avoid malicious plugins being registered (i.e. by malware infected
advertising networks) we now require whitelisting.

To whitelist a plugin simply means to specify :ref:`whitelisted_plugins` when
you call ``converse.initialize``.

If you're adding a "core" plugin, which means a plugin that will be
included in the default, open-source version of Converse, then you'll
instead whitelist the plugin by adding its name to the `core_plugins` array in
`./src/headless/converse-core.js <https://github.com/jcbrand/converse.js/blob/master/src/headless/converse-core.js>`_.
or the `WHITELISTED_PLUGINS` array in `./src/converse.js <https://github.com/jcbrand/converse.js/blob/master/src/converse.js>`_.

Where you add it depends on whether your plugin is part of the headless build
(which means it doesn't contain any view code) or not.

Security and access to the inner workings
-----------------------------------------

The globally available ``converse`` object, which exposes the API methods, such
as ``initialize`` and ``plugins.add``, is a wrapper that encloses and protects
a sensitive inner object, named ``_converse`` (not the underscore prefix).

This inner ``_converse`` object contains all the models and views,
as well as various other attributes and functions.

Within a plugin, you will have access to this internal
`"closured" <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures>`_
``_converse`` object, which is normally not exposed in the global variable scope.

The inner ``_converse`` object is made private in order to safely hide and
encapsulate sensitive information and methods which should not be exposed
to any 3rd-party scripts that might be running in the same page.


Accessing 3rd party libraries
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Immediately inside the module shown above you can access 3rd party libraries (such
dayjs) via the ``converse.env`` map.

The code for it could look something like this:

.. code-block:: javascript

    // Commonly used utilities and variables can be found under the "env"
    // namespace of the "converse" global.
    const { Promise, Strophe, dayjs, sizzle, $build, $iq, $msg, $pres } = converse.env;

These dependencies are closured so that they don't pollute the global
namespace, that's why you need to access them in such a way inside the module.

Overriding templates
--------------------

Converse uses `lit-html <https://lit-html.polymer-project.org/guide>`_
templates and templates are imported as separate files.

It's possible to configure your module bundler (e.g. Webpack) in such as way that a
different file is loaded when a template is imported.

This allows you to create your own templates that are used instead of the ones
that would have originally been imported.

With Webpack (which Converse uses internally), you can specify an
``alias`` for the template you want to override. This alias then points to your
own custom template.

For example, in your webpack config file, you could add the following to the
``config`` object that gets exported:

.. code-block:: javascript

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

This will override the template that gets imported at the path ``plugins/profile/templates/profile.js``
with your own template at the path ``templates/custom-profile.js`` (relative to your webpack config file).


Object and class Overrides
--------------------------

.. note:: Using the `overrides` feature from pluggable.js is discouraged. It's
    much better to use events, promises and `hooks`_ to modify the behaviour of
    Converse.

    The pluggable.js `overrides` will only work on objects and classes that are
    set as attributes on the `_converse` object, which doesn't apply to many
    newer classes and objects, such as the web components. For these clasess,
    overrides won't work at all.

    This section is left here for completeness, because in some special cases
    overrides are still used.

Plugins can override core code or code from other plugins. You can specify
overrides in the object passed to ``converse.plugins.add``.

In an override you can still call the overridden function, by calling
``this.__super__.methodName.apply(this, arguments);`` where ``methodName`` is
the name of the function or method you're overriding.

The following code snippet provides an example of two different overrides:

.. code-block:: javascript

    overrides: {
        /* The *_converse* object has a method "onConnected".
         * You can override that method as follows:
         */
        onConnected: function () {
            // Overrides the onConnected method in Converse

            // Top-level functions in "overrides" are bound to the
            // inner "_converse" object.
            const _converse = this;

            // Your custom code can come here ...

            // You can access the original function being overridden
            // via the __super__ attribute.
            // Make sure to pass on the arguments supplied to this
            // function and also to apply the proper "this" object.
            _converse.__super__.onConnected.apply(this, arguments);

            // Your custom code can come here ...
        },

        /* On the XMPPStatus model is a method sendPresence.
         * We can override is as follows:
         */
        XMPPStatus: {
            sendPresence: function (type, status_message, jid) {
                // The "_converse" object is available via the __super__
                // attribute.
                const _converse = this.__super__._converse;

                // Custom code can come here ...

                // You can call the original overridden method, by
                // accessing it via the __super__ attribute.
                // When calling it, you need to apply the proper
                // context as reference by the "this" variable.
                this.__super__.sendPresence.apply(this, arguments);
            }
        }
    }


Use the ``overrides`` feature with caution. It basically resorts to
monkey patching which pollutes the call stack and can make your code fragile
and prone to bugs when Converse gets updated. Too much use of ``overrides``
is therefore a "code smell" which should ideally be avoided.

A better approach is to use the events and `hooks`_ emitted by Converse, and to add
your code in event handlers. This is however not always possible, in which case
the overrides are a powerful tool.

Also, while it's possible to add new methods to classes via the ``overrides``
feature, it's better and more explicit to use composition with
``Object.assign``.

For example:

.. code-block:: javascript

        function doSomething () {
            // Your code comes here
        }
        Object.assign(_converse.ChatBoxView.prototype, { doSomething });



.. _`dependencies`:

Plugin dependencies
-------------------

When using ``overrides``, the code that you want to override (which is either
in ``converse-core`` or in other plugins), needs to be parsed already by the
time your ``overrides`` are being parsed.

Additionally, when you register event or promise handlers in your plugin for
events/promises that fire in other plugins, then you want those plugins to have
been loaded before your plugin gets loaded.

To resolve this problem we have the ``dependencies`` Array attribute.
With this you can specify those dependencies which need to be loaded before
your plugin is loaded.

In some cases, you might want to depend on another plugin if it's available,
but don't care when it's not available.
An example is the `converse-dragresize <https://github.com/jcbrand/converse.js/blob/master/src/converse-dragresize.js>`_
plugin, which will add drag-resize handles to the headlines box (which shows
messages of type ``headline``) but doesn't care when that particular plugin is
not available.

If the :ref:`strict_plugin_dependencies` setting is set to ``false`` (which is
its default value), then no error will be raised if the plugin is not found.

In this case, you can't specify the plugin as a dependency in the ``define``
statement at the top of the plugin, since it might not always be available,
which would cause ``require.js`` to throw an error.

Extending Converse's configuration settings
----------------------------------------------

Converse comes with various :ref:`configuration-settings` that can be used to
modify its functionality and behavior.

All configuration settings have default values which can be overridden when
`converse.initialize` (see `converse.initialize </docs/html/api/converse.html#.initialize>`_)
gets called.

Plugins often need their own additional configuration settings and you can add
these settings with the `_converse.api.settings.update </docs/html/api/-_converse.api.settings.html#.update>`_
method.

Exposing promises
-----------------

Converse has a `waitUntil </docs/html/api/-_converse.api.html#.waitUntil>`_ API method
which allows you to wait for various promises to resolve before executing a
piece of code.

You can add new promises for your plugin by calling
`_converse.api.promises.add </docs/html/api/-_converse.api.promises.html#.add>`_.

Generally, your plugin will then also be responsible for making sure these
promises are resolved. You do this by calling
`_converse.api.trigger </docs/html/api/-_converse.api.html#.trigger>`_, which not
only resolves the plugin but will also emit an event with the same name.

Dealing with asynchronicity
---------------------------

Due to the asynchronous nature of XMPP, many subroutines in Converse execute
at different times and not necessarily in the same order.

In many cases, when you want to execute a piece of code in a plugin, you first
want to make sure that the supporting data-structures that your code might rely
on have been created and populated with data.

There are two ways of waiting for the right time before executing your code.
You can either listen for certain events, or you can wait for promises to
resolve.

For example, when you want to query the message archive between you and a
friend, you would call ``this._converse.api.archive.query({'with': 'friend@example.org'});``

However, simply calling this immediately in the ``initialize`` method of your plugin will
not work, since the user is not logged in yet.

In this case, you should first listen for the ``connection`` event, and then do your query, like so:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {
            const _converse = this._converse;

            _converse.api.listen.on('connected', function () {
                _converse.api.archive.query({'with': 'admin2@localhost'});
            });
        }
    });

Another example is in the ``Bookmarks`` plugin (in
`src/converse-bookmarks.js <https://github.com/jcbrand/converse.js/blob/6c3aa34c23d97d679823a64376418cd0f40a8b94/src/converse-bookmarks.js#L528>`_).
Before bookmarks can be fetched and shown to the user, we first have to wait until
the `"Rooms"` panel of the ``ControlBox`` has been rendered and inserted into
the DOM. Otherwise we have no place to show the bookmarks yet.

Therefore, there are the following lines of code in the ``initialize`` method of
`converse-bookmarks.js <https://github.com/jcbrand/converse.js/blob/6c3aa34c23d97d679823a64376418cd0f40a8b94/src/converse-bookmarks.js#L528>`_:

.. code-block:: javascript

    Promise.all([
        _converse.api.waitUntil('chatBoxesFetched'),
        _converse.api.waitUntil('roomsPanelRendered')
    ]).then(initBookmarks);

What this means, is that the plugin will wait until the ``chatBoxesFetched``
and ``roomsPanelRendered`` promises have been resolved before it calls the
``initBookmarks`` method (which is defined inside the plugin).

This way, we know that we have everything in place and set up correctly before
fetching the bookmarks.

As yet another example, there is also the following code in the ``initialize``
method of the plugin:

.. code-block:: javascript

    _converse.api.listen.on('chatBoxOpened', function renderMinimizeButton (view) {
        // Inserts a "minimize" button in the chatview's header

        // Implementation code removed for brevity
        // ...
    });

In this case, the plugin waits for the ``chatBoxOpened`` event, before it then
calls ``renderMinimizeButton``, which adds a new button to the chatbox (which
enables you to minimize it).

Finding the right promises and/or events to listen to, can be a bit
challenging, and sometimes it might be necessary to create new events or
promises.

Please refer to the `API documentation </docs/html/api/http://localhost:8008/docs/html/api/>`_
for an overview of what's available to you. If you need new events or promises, then
`please open an issue or make a pull request on Github <https://github.com/jcbrand/converse.js>`_


Hooks
-----

Converse has the concept of ``hooks``, which are special events that allow you
to modify it's behaviour at runtime.

A hook is similar to an event, but it differs in two meaningful ways:

1. Converse will wait for all handlers of a hook to finish before continuing inside the function from where the hook was triggered.
2. Each hook contains a payload, which the handlers can modify or extend, before returning it (either to the function that triggered the hook or to subsequent handlers).

These two properties of hooks makes it possible for 3rd party plugins to
intercept and update data, allowing them to modify Converse without the need of
resorting to `overrides`_.

A hook is triggered in the following way:

.. code-block:: javascript

    async function hookTriggerExample () {
        const payload = { foo: 'bar' };
        const updated_payload = await api.hook('hookName', this, payload);
        return updated_payload;
    }

The above could be shortened:

.. code-block:: javascript

    async function hookTriggerExample () {
        return await api.hook('hookName', this, { foo: 'bar' });
    }

The ``async/await`` syntax could also be removed, but then it's less clear to
the reader that this function returns a promise.

Let's assume that in a plugin somewhere a listener is registered for this hook:

.. code-block:: javascript

    function hookListenerExample () {

        api.listen.on('hookname', (context, payload) => {
            return {...payload, 'baz': 'buzz'};
        });
    }

The ``context`` parameter in our listener is usually the ``this`` of the function
that triggered the hook (as is the case in ``hookTriggerExample``),
but could also be a ``Model`` instance.

The ``payload`` parameter is the same payload that was passed in in
``hookTriggerExample``.

The ``hookListenerExample`` function accepts the payload and returns a new one
which contains the original payload together with a new key and value.

The ``updated_payload`` that is now returned from ``hookTriggerExample`` looks
as follows:

::

    { foo: 'bar', bazz: 'buzz' }

Our plugin was able to add data to the payload without requiring any kind of
knowledge from ``hookTriggerExample`` about ``hookListenerExample`` and
without any kind of coupling betwee the code.

A good example of a real-world hook in Converse, is the
`getMessageActionButtons <https://conversejs.org/docs/html/api/-_converse.html#event:getMessageActionButtons>`_
which allows you to add, modify or delete the actions you can take on a message
in a chat.

The `Actions <https://github.com/conversejs/community-plugins/tree/master/packages/actions>`_
3rd party community plugin makes use of this hook to add extra actions such as
``like`` or ``dislike`` to chat messages.


An example plugin
-----------------

Below follows a documented example of a plugin. This is the same code that gets
generated by `generator-conversejs <https://github.com/jcbrand/generator-conversejs>`_.

.. code-block:: javascript

    import converse from "@converse/headless/converse-core";

    // Commonly used utilities and variables can be found under the "env"
    // namespace of the "converse" global.
    const { Promise, Strophe, dayjs, sizzle, _, $build, $iq, $msg, $pres } = converse.env;

    // The following line registers your plugin.
    converse.plugins.add("myplugin", {

        /* Dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin. They are "optional" because they might not be
         * available, in which case any overrides applicable to them will be
         * ignored.
         *
         * NB: These plugins need to have already been imported or loaded,
         * either in your plugin or somewhere else.
         *
         * It's possible to make these dependencies "non-optional".
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found.
         */
        dependencies: [],

        /* Converse's plugin mechanism will call the initialize
         * method on any plugin (if it exists) as soon as the plugin has
         * been loaded.
         */
        initialize: function () {
            /* Inside this method, you have access to the private
             * `_converse` object.
             */
            const _converse = this._converse;
            _converse.log("The \"myplugin\" plugin is being initialized");

            /* From the `_converse` object you can get any configuration
             * options that the user might have passed in via
             * `converse.initialize`.
             *
             * You can also specify new configuration settings for this
             * plugin, or override the default values of existing
             * configuration settings. This is done like so:
            */
            _converse.api.settings.update({
                'initialize_message': 'Initializing myplugin!'
            });

            /* The user can then pass in values for the configuration
             * settings when `converse.initialize` gets called.
             * For example:
             *
             *      converse.initialize({
             *           "initialize_message": "My plugin has been initialized"
             *      });
             */
            alert(this._converse.initialize_message);

            /* Besides `_converse.api.settings.update`, there is also a
             * `_converse.api.promises.add` method, which allows you to
             * add new promises that your plugin is obligated to fulfill.
             *
             * This method takes a string or a list of strings which
             * represent the promise names:
             *
             *      _converse.api.promises.add('myPromise');
             *
             * Your plugin should then, when appropriate, resolve the
             * promise by calling `_converse.api.trigger`, which will also
             * trigger an event with the same name as the promise.
             * For example:
             *
             *      _converse.api.trigger('operationCompleted');
             *
             * Other plugins can then either listen for the event
             * `operationCompleted` like so:
             *
             *      _converse.api.listen.on('operationCompleted', function { ... });
             *
             * or they can wait for the promise to be fulfilled like so:
             *
             *      _converse.api.waitUntil('operationCompleted', function { ... });
             */


            /* In your plugin, you can also listen for hooks.
             * Hooks allow you to add or modify data and properties used by
             * Converse.
             *
             * For example, the getToolbarButtons hook allows you to add new buttons to the chat toolbar.
             * https://conversejs.org/docs/html/api/-_converse.html#event:getToolbarButtons
             */
             api.listen.on('getToolbarButtons', (toolbar_el, buttons) => {
                buttons.push(html`
                    <button class="my-button" @click=${alert('hello world!')}>
                        <converse-icon class="fa fa-eye" size="1em" color="blue"></converse-icon>
                    </button>
                `);
                return buttons;
            });
        }
    });

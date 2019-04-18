.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _`writing-a-plugin`:

Writing a plugin
================

Introduction
------------

Converse.js exposes a plugin architecture through which developers can modify
and extend its functionality.

Using plugins is good engineering practice, and using them is the *only* recommended
way of changing converse.js or adding new features to it.

In particular, plugins have the following advantages:

The main benefit of plugins is their *isolation of concerns* (and features).
From this benefit flows various 2nd degree advantages, such as the ability to
make smaller production builds (by excluding unused plugins) and an easier
upgrade path by avoiding touching converse.js's internals.

Each plugin comes in its own file, and converse.js's plugin architecture,
called `pluggable.js <https://github.com/jcbrand/pluggable.js/>`_, provides you
with the ability to "hook in" to the core code and other plugins.

Converse.js itself is composed out of plugins and uses pluggable.js. Take a look at the
`src <https://github.com/jcbrand/converse.js/tree/master/src>`_ directory. All
the files that follow the pattern `converse-*.js` are plugins.

Plugins (by way of Pluggable.js) enable developers to extend and override existing objects,
functions and the `Backbone <http://backbonejs.org/>`_ models and views that make up
Converse.js.

Besides that, in plugins you can also write new Backbone (or other) models and views,
in order to add a new functionality.

To more deeply understand how this plugin architecture works, please read the
`pluggable.js documentation <https://jcbrand.github.io/pluggable.js/>`_
and to understand its inner workings, please refer to the `annotated source code
<https://jcbrand.github.io/pluggable.js/docs/pluggable.html>`_.

.. note:: **Trying out a plugin in JSFiddle**

    Because Converse.js consists only of JavaScript, HTML and CSS (with no backend
    code required like PHP, Python or Ruby) it runs fine in JSFiddle.

    Here's a Fiddle with a Converse.js plugin that calls ``alert`` once it gets
    initialized and also when a chat message gets rendered: https://jsfiddle.net/4drfaok0/15/


.. note:: **Generating a plugin with Yeoman**

    The rest of this document explains how to write a plugin for Converse.js and
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

You register a converse.js plugin by calling ``converse.plugins.add``.

The plugin itself is a JavaScript object which usually has at least an
``initialize`` method, which gets called at the end of the
``converse.initialize`` method which is the top-level method that gets called
by the website to configure and initialize Converse.js itself.

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

As of converse.js 3.0.0 and higher, plugins need to be whitelisted before they
can be used. This is because plugins have access to a powerful API. For
example, they can read all messages and send messages on the user's behalf.

To avoid malicious plugins being registered (i.e. by malware infected
advertising networks) we now require whitelisting.

To whitelist a plugin simply means to specify :ref:`whitelisted_plugins` when
you call ``converse.initialize``.

If you're adding a "core" plugin, which means a plugin that will be
included in the default, open-source version of converse.js, then you'll
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

This inner ``_converse`` object contains all the Backbone models and views,
as well as various other attributes and functions.

Within a plugin, you will have access to this internal
`"closured" <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures>`_
``_converse`` object, which is normally not exposed in the global variable scope.

The inner ``_converse`` object is made private in order to safely hide and
encapsulate sensitive information and methods which should not be exposed
to any 3rd-party scripts that might be running in the same page.

Loading a plugin module
-----------------------

Converse.js uses the UMD (Universal Modules Definition) as its module syntax.
This makes modules loadable via `require.js`, `webpack` or other module
loaders, but also includable as old-school `<script>` tags in your HTML.

Here's an example of the plugin shown above wrapped inside a UMD module:

.. code-block:: javascript

    (function (root, factory) {
        if (typeof define === 'function' && define.amd) {
            // AMD. Register as a module called "myplugin"
            define(["converse"], factory);
        } else {
            // Browser globals. If you're not using a module loader such as require.js,
            // then this line below executes. Make sure that your plugin's <script> tag
            // appears after the one from converse.js.
            factory(converse);
        }
    }(this, function (converse) {

        converse.plugins.add('myplugin', {

            initialize: function () {
                // This method gets called once converse.initialize has been called
                // and the plugin itself has been loaded.

                // Inside this method, you have access to the closured
                // _converse object as an attribute on "this".
                // E.g. this._converse
            },
        });

    });


Accessing 3rd party libraries
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Immediately inside the module shown above you can access 3rd party libraries (such
moment and lodash) via the ``converse.env`` map.

The code for it would look something like this:


.. code-block:: javascript

    // Commonly used utilities and variables can be found under the "env"
    // namespace of the "converse" global.
    var Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        $msg = converse.env.$msg,
        $pres = converse.env.$pres,
        $build = converse.env.$build,
        b64_sha1 = converse.env.b64_sha1,
        _ = converse.env._,
        moment = converse.env.moment;

These dependencies are closured so that they don't pollute the global
namespace, that's why you need to access them in such a way inside the module.

Overrides
---------

Plugins can override core code or code from other plugins. Refer to the full
example at the bottom for code details.

Use the ``overrides`` functionality with caution. It basically resorts to
monkey patching which pollutes the call stack and can make your code fragile
and prone to bugs when Converse.js gets updated. Too much use of ``overrides``
is therefore a "code smell" which should ideally be avoided.

A better approach is to listen to the events emitted by Converse.js, and to add
your code in event handlers. This is however not always possible, in which case
the overrides are a powerful tool.

.. _`dependencies`:

Plugin dependencies
~~~~~~~~~~~~~~~~~~~

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

Extending converse.js's configuration settings
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Converse.js comes with various :ref:`configuration-settings` that can be used to
modify its functionality and behavior.

All configuration settings have default values which can be overridden when
`converse.initialize` (see :ref:`initialize`) gets called.

Plugins often need their own additional configuration settings and you can add
these settings with the `_converse.api.settings.update` method (see
:ref:`settings-update`).

Exposing promises
~~~~~~~~~~~~~~~~~

Converse.js has a ``waitUntil`` API method (see :ref:`waituntil-grouping`)
which allows you to wait for various promises to resolve before executing a
piece of code.

You can add new promises for your plugin by calling
``_converse.api.promises.add`` (see :ref:`promises-grouping`).

Generally, your plugin will then also be responsible for making sure these
promises are resolved. You do this by calling ``_converse.api.emit``, which not
only resolves the plugin but will also emit an event with the same name.

Dealing with asynchronicity
---------------------------

Due to the asynchronous nature of XMPP, many subroutines in Converse.js execute
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
            var _converse = this._converse;

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

Please refer to the :ref:`events-API` section of the documentation for an
overview of what's available to you. If you need new events or promises, then
`please open an issue or make a pull request on Github <https://github.com/jcbrand/converse.js>`_

A full example plugin
---------------------

Below follows a documented example of a plugin. This is the same code that gets
generated by `generator-conversejs <https://github.com/jcbrand/generator-conversejs>`_.

.. code-block:: javascript

    (function (root, factory) {
        if (typeof define === 'function' && define.amd) {
            // AMD. Register as a module called "myplugin"
            define(["converse"], factory);
        } else {
            // Browser globals. If you're not using a module loader such as require.js,
            // then this line below executes. Make sure that your plugin's <script> tag
            // appears after the one from converse.js.
            factory(converse);
        }
    }(this, function (converse) {

        // Commonly used utilities and variables can be found under the "env"
        // namespace of the "converse" global.
        var Strophe = converse.env.Strophe,
            $iq = converse.env.$iq,
            $msg = converse.env.$msg,
            $pres = converse.env.$pres,
            $build = converse.env.$build,
            b64_sha1 = converse.env.b64_sha1,
            _ = converse.env._,
            moment = converse.env.moment;

        // The following line registers your plugin.
        converse.plugins.add("myplugin", {

            /* Dependencies are other plugins which might be
             * overridden or relied upon, and therefore need to be loaded before
             * this plugin. They are "optional" because they might not be
             * available, in which case any overrides applicable to them will be
             * ignored.
             *
             * NB: These plugins need to have already been loaded via require.js.
             *
             * It's possible to make these dependencies "non-optional".
             * If the setting "strict_plugin_dependencies" is set to true,
             * an error will be raised if the plugin is not found.
             */
            'dependencies': [],

            /* Converse.js's plugin mechanism will call the initialize
             * method on any plugin (if it exists) as soon as the plugin has
             * been loaded.
             */
            'initialize': function () {
                /* Inside this method, you have access to the private
                 * `_converse` object.
                 */
                var _converse = this._converse;
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
                 * promise by calling `_converse.api.emit`, which will also
                 * emit an event with the same name as the promise.
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
            },

            /* If you want to override some function or a Backbone model or
             * view defined elsewhere in converse.js, then you do that under
             * the "overrides" namespace.
             */
            'overrides': {
                /* For example, the private *_converse* object has a
                 * method "onConnected". You can override that method as follows:
                 */
                'onConnected': function () {
                    // Overrides the onConnected method in converse.js

                    // Top-level functions in "overrides" are bound to the
                    // inner "_converse" object.
                    var _converse = this;

                    // Your custom code can come here ...

                    // You can access the original function being overridden
                    // via the __super__ attribute.
                    // Make sure to pass on the arguments supplied to this
                    // function and also to apply the proper "this" object.
                    _converse.__super__.onConnected.apply(this, arguments);

                    // Your custom code can come here ...
                },

                /* Override converse.js's XMPPStatus Backbone model so that we can override the
                 * function that sends out the presence stanza.
                 */
                'XMPPStatus': {
                    'sendPresence': function (type, status_message, jid) {
                        // The "_converse" object is available via the __super__
                        // attribute.
                        var _converse = this.__super__._converse;

                        // Custom code can come here ...

                        // You can call the original overridden method, by
                        // accessing it via the __super__ attribute.
                        // When calling it, you need to apply the proper
                        // context as reference by the "this" variable.
                        this.__super__.sendPresence.apply(this, arguments);

                        // Custom code can come here ...
                    }
                }
            }
        });
    }));

.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _`writing-a-plugin`:

Writing a plugin
================

.. contents:: Table of Contents
   :depth: 2
   :local:

Introduction
------------

Developers are able to extend and override the objects, functions and the
Backbone models and views that make up converse.js by means of writing plugins.

Converse.js uses `pluggable.js <https://github.com/jcbrand/pluggable.js/>`_ as
its plugin architecture.

To understand how this plugin architecture works, please read the
`pluggable.js documentation <https://jcbrand.github.io/pluggable.js/>`_
and to understand its inner workins, please refer to the `annotated source code
<https://jcbrand.github.io/pluggable.js/docs/pluggable.html>`_.

Below you'll find an example plugin. Because convers.js is only Javascript,
HTML and CSS (with no backend code required like PHP, Python or Ruby) it runs
fine in JSFiddle.

Here's an Fiddle with a plugin that calls `alert` when the plugin gets
initialized and when a message gets rendered: https://jsfiddle.net/4drfaok0/15/


Registering a plugin
--------------------

You register a converse.js plugin as follows:

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
            define("myplugin", ["converse"], factory);
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
moment, underscore and jQuery) via the ``converse.env`` map.

The code for it would look something like this:


.. code-block:: javascript

    // Commonly used utilities and variables can be found under the "env"
    // namespace of the "converse" global.
    var Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        $msg = converse.env.$msg,
        $pres = converse.env.$pres,
        $build = converse.env.$build,
        b64_sha1 = converse.env.b64_sha1;
        $ = converse.env.jQuery,
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

.. _`optional_dependencies`:

Optional plugin dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When using ``overrides``, the code that you want to override (which is either
in ``converse-core`` or in other plugins), needs to be loaded already by the
type the ``overrides`` object is being parsed.

So it's important to include overridden plugins in the AMD ``define`` statement
at the top of the plugin module.

However, sometimes you want to override parts of another plugin if it exists, but you
don't want anything to break if it doesn't exist (for example when using a
custom build which excludes that plugin). An example is the
`converse-dragresize <https://github.com/jcbrand/converse.js/blob/master/src/converse-dragresize.js>`_
plugin, which will add drag-resize handles to the headlines box (which shows
messages of type ``headline``) but doesn't care if that particular plugin isn't
actually loaded.

In this case, you can't specify the plugin as a dependency in the ``define``
statement at the top of the plugin, since it might not always be available,
which would cause ``require.js`` to throw an error.

To resolve this problem we have the ``optional_dependencies`` Array attribute.
With this you can specify those dependencies which need to be loaded before
your plugin, if they exist. If they don't exist, they won't be ignored.

If the setting :ref:`strict_plugin_dependencies` is set to true,
an error will be raised if the plugin is not found, thereby making them
non-optional.

Extending converse.js's configuration settings
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Converse.js comes with various :ref:`configuration-settings`_ that can be used to
modify its functionality and behavior.

All configuration settings have default values which can be overridden when
`converse.initialize` (see :ref:`initialize`_) gets called.

Plugins often need their own additional configuration settings and you can add
these settings with the `_converse.api.settings.update` method (see
:ref:`settings-update`_).

Exposing promises
~~~~~~~~~~~~~~~~~

Converse.js has a ``waitUntil`` API method (see :ref:`waituntil-grouping`_)
which allows you to wait for various promises to resolve before executing a
piece of code.

You can add new promises for your plugin by calling
``_converse.api.promises.add`` (see :ref:`promises-grouping`_).

Generally, your plugin will then also be responsible for making sure these
promises are resolved. You do this by calling ``_converse.api.emit``, which not
only resolves the plugin but will also emit an event with the same name.

A full example plugin
---------------------

.. code-block:: javascript

    (function (root, factory) {
        if (typeof define === 'function' && define.amd) {
            // AMD. Register as a module called "myplugin"
            define("myplugin", ["converse"], factory);
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
            b64_sha1 = converse.env.b64_sha1;
            $ = converse.env.jQuery,
            _ = converse.env._,
            moment = converse.env.moment;

        // The following line registers your plugin.
        converse.plugins.add('myplugin', {

            initialize: function () {
                // Converse.js's plugin mechanism will call the initialize
                // method on any plugin (if it exists) as soon as the plugin has
                // been loaded.

                var _converse = this._converse;

                // Inside this method, you have access to the closured
                // _converse object, from which you can get any configuration
                // options that the user might have passed in via
                // converse.initialize. These values are stored in the
                // "user_settings" attribute.

                // We can also specify new configuration settings for this
                // plugin, or override the default values of existing
                // configuration settings. This is done like so:

                _converse.api.settings.update({
                    'initialize_message': 'Initialized', // New configuration setting
                    'auto_subscribe': true, // New default value for an
                                            // existing "core" configuration setting
                });

                // The user can then pass in values for the configuration
                // settings when `converse.initialize` gets called.
                // For example:
                //
                // converse.initialize({
                //      "initialize_message": "My plugin has been initialized"
                // });
                //
                // And the configuration setting is then available via the
                // `user_settings` attribute:

                // alert(this._converse.user_settings.initialize_message);

                // Besides `_converse.api.settings.update`, there is also a
                // `_converse.api.promises.add` method, which allows you to
                // add new promises that your plugin is obligated to fulfill.

                // This method takes a string or a list of strings which
                // represent the promise names.

                _converse.api.promises.add('operationCompleted');

                // Your plugin should then, when appropriate, resolve the
                // promise by calling `_converse.api.emit`, which will also
                // emit an event with the same name as the promise.
                // For example:
                // _converse.api.emit('operationCompleted');
                //
                // Other plugins can then either listen for the event
                // `operationCompleted` like so:
                // `_converse.api.listen.on('operationCompleted', function { ... });`
                //
                // or they can wait for the promise to be fulfilled like so:
                // `_converse.api.waitUntil('operationCompleted', function { ... });`
            },

            // Optional dependencies are other plugins which might be
            // overridden or relied upon, and therefore need to be loaded before
            // this plugin. They are called "optional" because they might not be
            // available, in which case any overrides applicable to them will be
            // ignored.

            // It's possible however to make optional dependencies non-optional.
            // If the setting "strict_plugin_dependencies" is set to true,
            // an error will be raised if the plugin is not found.
            //
            // NB: These plugins need to have already been loaded via require.js.

            optional_dependencies: [],

            overrides: {
                // If you want to override some function or a Backbone model or
                // view defined elsewhere in converse.js, then you do that under
                // this "overrides" namespace.

                // For example, the inner protected *_converse* object has a
                // method "onConnected". You can override that method as follows:
                onConnected: function () {
                    // Overrides the onConnected method in converse.js

                    // Top-level functions in "overrides" are bound to the
                    // inner "_converse" object.
                    var _converse = this;

                    // Your custom code comes here.
                    // ...

                    // You can access the original function being overridden
                    // via the __super__ attribute.
                    // Make sure to pass on the arguments supplied to this
                    // function and also to apply the proper "this" object.
                    _converse.__super__.onConnected.apply(this, arguments);
                },

                XMPPStatus: {
                    // Override converse.js's XMPPStatus Backbone model so that we can override the
                    // function that sends out the presence stanza.
                    sendPresence: function (type, status_message, jid) {
                        // The "_converse" object is available via the __super__
                        // attribute.
                        var _converse = this.__super__._converse;

                        // Custom code can come here
                        // ...

                        // You can call the original overridden method, by
                        // accessing it via the __super__ attribute.
                        // When calling it, you need to apply the proper
                        // context as reference by the "this" variable.
                        this.__super__.sendPresence.apply(this, arguments);
                    }
                }
            }
        });
    }));

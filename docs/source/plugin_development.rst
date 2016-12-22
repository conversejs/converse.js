.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _`writing-a-plugin`:

Writing a converse.js plugin
============================

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

An example plugin
-----------------

In the example below, you can see how to access 3rd party libraries (such
moment, underscore and jQuery) via the ``converse.env`` map.

There is an ``initialize`` method as you've seen in the example above, and then
also an ``overrides`` map, which can be used to override functions, objects or
Backbone views and models of Converse.js.

Use the ``overrides`` functionality with caution. It basically resorts to
monkey patching which pollutes the call stack and can make your code fragile
and prone to bugs when Converse.js gets updated. Too much use of ``overrides``
is therefore a "code smell" which should ideally be avoided.

A better approach is to listen to the events emitted by Converse.js, and to add
your code in event handlers. This is however not always possible, in which case
the overrides are a powerful tool.

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

                // Inside this method, you have access to the closured
                // _converse object, from which you can get any configuration
                // options that the user might have passed in via
                // converse.initialize. These values are stored in the
                // "user_settings" attribute.

                // Let's assume the user might pass in a custom setting, like so:
                //
                // converse.initialize({
                //      "initialize_message": "My plugin has been initialized"
                // });
                //
                // Then we can alert that message, like so:
                alert(this._converse.user_settings.initialize_message);
            },

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

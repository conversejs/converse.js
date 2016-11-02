.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

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
and to grok its inner workins, please refer to the `annotated source code
<https://jcbrand.github.io/pluggable.js/docs/pluggable.html>`_.

You register a converse.js plugin as follows:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        // Your plugin code goes in here
    });

Security and access to the inner workings
-----------------------------------------

The globally available ``converse`` object, which exposes the API methods, such
as ``initialize`` and ``plugins.add``, is a wrapper that encloses and protects
a sensitive inner object.

This inner object contains all the Backbone models and views, as well as
various other attributes and functions.

Within a plugin, you will have access to this internal
`"closured" <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures>`_
converse object, which is normally not exposed in the global variable scope. The
hiding of this inner object is due to the fact that it contains sensitive information,
such as the user's JID and password (if they logged in manually). You should
therefore make sure NOT to expose this object globally.

An example plugin
-----------------

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
    }(this, function (converse_api) {

        // Commonly used utilities and variables can be found under the "env"
        // namespace of converse_api

        // Strophe methods for building stanzas
        var Strophe = converse_api.env.Strophe,
            $iq = converse_api.env.$iq,
            $msg = converse_api.env.$msg,
            $pres = converse_api.env.$pres,
            $build = converse_api.env.$build,
            b64_sha1 = converse_api.env.b64_sha1;

        // Other frequently used utilities
        var $ = converse_api.env.jQuery,
            _ = converse_api.env._,
            moment = converse_api.env.moment;


        // The following line registers your plugin.
        converse_api.plugins.add('myplugin', {

            initialize: function () {
                // Converse.js's plugin mechanism will call the initialize
                // method on any plugin (if it exists) as soon as the plugin has
                // been loaded.

                // Inside this method, you have access to the protected "inner"
                // converse object, from which you can get any configuration
                // options that the user might have passed in via
                // converse.initialize. These values are stored in the
                // "user_settings" attribute.

                // Let's assume the user might in a custom setting, like so:
                // converse.initialize({
                //      "initialize_message": "My plugin has been initialized"
                // });
                //
                // Then we can alert that message, like so:
                alert(this.converse.user_settings.initialize_message);
            },

            myFunction: function () {
                // This is a function which does not override anything in
                // converse.js itself, but in which you still have access to
                // the protected "inner" converse object.
                var converse = this.converse;
                // Custom code comes here
                // ...
            },

            overrides: {
                // If you want to override some function or a Backbone model or
                // view defined inside converse, then you do that under this
                // "overrides" namespace.

                // For example, the inner protected *converse* object has a
                // method "onConnected". You can override that method as follows:
                onConnected: function () {
                    // Overrides the onConnected method in converse.js

                    // Top-level functions in "overrides" are bound to the
                    // inner "converse" object.
                    var converse = this;

                    // Your custom code comes here.
                    // ...

                    // You can access the original function being overridden
                    // via the __super__ attribute.
                    // Make sure to pass on the arguments supplied to this
                    // function and also to apply the proper "this" object.
                    this.__super__.onConnected.apply(this, arguments);
                },

                XMPPStatus: {
                    // Override converse.js's XMPPStatus Backbone model so that we can override the
                    // function that sends out the presence stanza.
                    sendPresence: function (type, status_message, jid) {
                        // The "converse" object is available via the __super__
                        // attribute.
                        var converse = this.__super__.converse;

                        // Custom code can come here
                        // ...

                        // You can call the original overridden method, by
                        // accessing it via the __super__ attribute.
                        // When calling it, you need to apply the proper
                        // context as reference by the "this" variable.
                        this.__super__.sendPresence.apply(this, arguments);
                    }
                },
            }
        });
    }));

(function (root, factory) {
    define(["converse-core", "strophe.vcard"], factory);
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
    converse.plugins.add("converse-spoilers", {

        /* Optional dependencies are other plugins which might be
           * overridden or relied upon, and therefore need to be loaded before
           * this plugin. They are called "optional" because they might not be
           * available, in which case any overrides applicable to them will be
           * ignored.
           *
           * NB: These plugins need to have already been loaded via require.js.
           *
           * It's possible to make optional dependencies non-optional.
           * If the setting "strict_plugin_dependencies" is set to true,
           * an error will be raised if the plugin is not found.
           */
        'optional_dependencies': [],

        /* Converse.js's plugin mechanism will call the initialize
         * method on any plugin (if it exists) as soon as the plugin has
         * been loaded.
         */
        'initialize': function () {
            /* Inside this method, you have access to the private
             * `_converse` object.
             */
            var _converse = this._converse;
            _converse.log("The converse-spoilers plugin is being initialized");

            /* From the `_converse` object you can get any configuration
             * options that the user might have passed in via
             * `converse.initialize`.
             *
             * You can also specify new configuration settings for this
             * plugin, or override the default values of existing
             * configuration settings. This is done like so:
            */
            _converse.api.settings.update({
                'initialize_message': 'Initializing converse-spoilers!'
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
             *      _converse.api.emit('operationCompleted');
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
            const initSpoilers = function () {
                var spoiler_button = document.createElement('li');
                spoiler_button.classList.add("toggle-spoiler");
                spoiler_button.setAttribute("active", "false");
                spoiler_button.onclick = toggleEditSpoilerMessage;
                spoiler_button.innerHTML = '<a class="icon-eye" title="' + _('Click here to write a message as a spoiler') + '"></a>';
                document.querySelector('.chat-toolbar').appendChild(spoiler_button);
            };
            
            function toggleEditSpoilerMessage() {
                let form = document.querySelector('.sendXMPPMessage');
                let textArea = document.querySelector('.chat-textarea');
                let hintTextArea = null;
                let spoiler_button = document.querySelector('.toggle-spoiler');
                
                if (!isEditSpoilerMessage()) {
                    textArea.style['background-color'] = '#D5FFD2';
                    textArea.setAttribute('placeholder', _('Write your spoiler\'s content here'));
                    spoiler_button.setAttribute("active", "true");
                    spoiler_button.innerHTML = '<a class="icon-eye-blocked" title="' + _('Cancel writing spoiler message') + '"></a>'; // better get the element <a></a> and change the class?
                    hintTextArea = createHintTextArea();
                    form.insertBefore(hintTextArea, textArea);
//                     <textarea type="text" class="chat-textarea-hint " placeholder="Hint (optional)" style="background-color: rgb(188, 203, 209); height:30px;"></textarea>

                } else {
                    textArea.style['background-color'] = '';
                    textArea.setAttribute('placeholder', _('Personal message'));
                    spoiler_button.setAttribute("active", "false");
                    spoiler_button.innerHTML = '<a class="icon-eye" title="' + _('Click here to write a message as a spoiler') + '"></a>'; // better get the element <a></a> and change the class?
                    hintTextArea = document.querySelector('.chat-textarea-hint');
                    if ( hintTextArea ) {
                        hintTextArea.remove();
                        
                    }
                }
                
            }
            
            function isEditSpoilerMessage() {
                return document.querySelector('.toggle-spoiler').getAttribute('active') === 'true';
            }
            
            function createHintTextArea(){
                let hintTextArea = document.createElement('input');
                hintTextArea.setAttribute('type', 'text');
                hintTextArea.setAttribute('placeholder', _('Hint (optional)'));
                hintTextArea.classList.add('chat-textarea-hint');
                hintTextArea.style['height'] = '30px';
                return hintTextArea;
            }
            _converse.on('chatBoxFocused', function (chatbox) { initSpoilers(); });

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

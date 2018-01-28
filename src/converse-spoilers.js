(function (root, factory) {
    define(["converse-core", "strophe.vcard", "converse-chatview"], factory);
}(this, function (converse, tpl_message) {

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

    function isEditSpoilerMessage() {
        return document.querySelector('.toggle-spoiler-edit').getAttribute('active') === 'true';
    }

    function hasHint() {
        return document.querySelector('.chat-textarea-hint').value.length > 0;
    }

    function getHint() {
        return document.querySelector('.chat-textarea-hint').value;
    }

    function toggleEditSpoilerMessage() {
        let form = document.querySelector('.sendXMPPMessage');
        let textArea = document.querySelector('.chat-textarea');
        let hintTextArea = null;
        let spoiler_button = document.querySelector('.toggle-spoiler-edit');

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

    const initSpoilers = function () {
        var spoiler_button = document.createElement('li');
        spoiler_button.classList.add("toggle-spoiler-edit");
        spoiler_button.setAttribute("active", "false");
        spoiler_button.innerHTML = '<a class="icon-eye" title="' + _('Click here to write a message as a spoiler') + '"></a>';
        document.querySelector('.chat-toolbar').appendChild(spoiler_button);
    };

    function createHintTextArea(){
        let hintTextArea = document.createElement('input');
        hintTextArea.setAttribute('type', 'text');
        hintTextArea.setAttribute('placeholder', _('Hint (optional)'));
        hintTextArea.classList.add('chat-textarea-hint');
        hintTextArea.style['height'] = '30px';
        return hintTextArea;
    }

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

            _converse.on('chatBoxFocused', function (chatbox) { initSpoilers(); });

        },

        /* If you want to override some function or a Backbone model or
         * view defined elsewhere in converse.js, then you do that under
         * the "overrides" namespace.
         */
        'overrides': {
            'ChatBoxView': {
                'events': {
                    'click .toggle-spoiler-edit': toggleEditSpoilerMessage
                },

                'createMessageStanza': function () {
                    let messageStanza = this.__super__.createMessageStanza.apply(this, arguments);
                    if (isEditSpoilerMessage()) {
                        if (hasHint()){
                            messageStanza.c('spoiler',{'xmlns': 'urn:xmpp:spoiler:0'}, getHint());
                        } else {
                            messageStanza.c('spoiler',{'xmlns': 'urn:xmpp:spoiler:0'});
                        }
                    }
                    return messageStanza;
                },

                'renderMessage': function (attrs) {
                    /* Renders a chat message based on the passed in attributes.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     *
                     *  Returns:
                     *      The DOM element representing the message.
                     */
                    console.log('These are the attrs and the msg object\n');
                    console.log(attrs);
                    let msg = this.__super__.renderMessage.apply(this, arguments);
                    console.log(msg);

                    //Spoiler logic
                    if ('spoiler' in attrs) {
                        console.log('Spoiler in attrs \n');
                        let button = document.createElement("button");
                        let container = document.createElement("div"); 
                        let content = document.createElement( "div" );
                        let hint = document.createElement("div");
                        let contentHidden = document.createElement("div");

                        attrs.spoiler = attrs.spoiler == true ? _('Spoiler') : attrs.spoiler; //Check if attrs.spoiler can be true
                        hint.appendChild(document.createTextNode(attrs.spoiler));

                        contentHidden.appendChild(document.createTextNode(msg.message));
                        contentHidden.classList.add("hidden");
//                         contentHidden.addHyperlinks();
//                         contentHidden.addEmoticons(_converse.visible_toolbar_buttons.emoticons);

                        container.style.backgroundColor = "Lavender";
                        container.style.textAlign = "center";

                        //Spoiler's content
                        content.classList.add("spoiler-content");
                        content.appendChild(hint);
                        content.appendChild(contentHidden);
                        //Spoiler's button
                        button.classList.add("spoiler-button");
                        button.classList.add("icon-eye");
                        button.setAttribute("type", "button");
                        button.appendChild(document.createTextNode(_('Show ')));
                        button.style.width = "100%";
                        button.setAttribute("closed", "true");

                        container.appendChild(button);
                        container.appendChild(content);

                        console.log('And this is the container:\n');
                        console.log(container);
                        msg.append(container);
                    }

                    return msg;
                }
            },
            'ChatBox': {
                'getMessageAttributes': function (message, delay, original_stanza) {
                    let messageAttributes = this.__super__.getMessageAttributes.apply(this, arguments);
                    console.log(arguments);
                    //Check if message is spoiler
                    let spoiler = null, i = 0, found = false;

                    while (i < message.childNodes.length && !found) {
                        if (message.childNodes[i].nodeName == "spoiler") {
                            spoiler = message.childNodes[i];
                            found = true;
                        }

                        i++;
                    }
                    if (spoiler) {
                        messageAttributes['spoiler'] = spoiler.textContent.length > 0 ? spoiler.textContent : _('Spoiler');
                    }

                    return messageAttributes;
                }
            }

        }
    });
}));

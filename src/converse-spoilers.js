(function (root, factory) {
    define([
        "converse-core",
        "tpl!spoiler_button",
        "converse-chatview"
    ], factory);
}(this, function (converse, tpl_spoiler_button) {

    const { _ } = converse.env;
    const u = converse.env.utils;

    function isEditSpoilerMessage () {
        return document.querySelector('.toggle-spoiler-edit').getAttribute('active') === 'true';
    }

    function hasHint () {
        return document.querySelector('.chat-textarea-hint').value.length > 0;
    }

    function getHint () {
        return document.querySelector('.chat-textarea-hint').value;
    }


    // The following line registers your plugin.
    converse.plugins.add("converse-spoilers", {
        /* Optional dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin. They are called "optional" because they might not be
         * available, in which case any overrides applicable to them will be
         * ignored.
         *
         * It's possible however to make optional dependencies non-optional.
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        dependencies: ["converse-chatview"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.


            'ChatBoxView': {

                'events': {
                    'click .toggle-spoiler-edit': 'toggleEditSpoilerMessage',
                    'click .toggle-spoiler-display': 'toggleSpoilerMessage'
                },

                'renderToolbar': function (toolbar, options) {
                    const { _converse } = this.__super__;

                    const result = this.__super__.renderToolbar.apply(this, arguments);
                    if (!_converse.show_toolbar) { return result; }

                    const html = tpl_spoiler_button({
                        'title': _converse.__('Click here to write a message as a spoiler')
                    });
                    const toolbar_el = this.el.querySelector('.chat-toolbar');
                    if (!_.isNull(toolbar_el)) {
                        toolbar_el.appendChild(u.stringToElement(html));
                    }
                    return result;
                },

                'toggleSpoilerMessage': function (event) {
                    const { _converse } = this.__super__,
                          { __ } = _converse;

                    const button = event.target;
                    const textarea = button.nextElementSibling;
                    const hint = textarea.children[0];
                    const contentHidden = textarea.children[1];
                    const container = button.parentElement;

                    if (button.getAttribute("closed") == "true") {
                        //Show spoiler's content
                        button.classList.remove("icon-eye");
                        button.classList.add("toggle-spoiler-display");
                        button.classList.add("icon-eye-blocked");
                        button.setAttribute("closed", "false");
                        button.textContent = __('Hide ');
                        container.style.backgroundColor="#D5FFD2";

                        hint.classList.add("hidden");
                        contentHidden.classList.remove("hidden");
                    } else { //Hide spoiler's content
                        button.classList.remove("icon-eye-blocked");
                        button.classList.add("icon-eye");
                        button.setAttribute("closed", "true");
                        button.textContent = __('Show ');
                        container.style.backgroundColor="Lavender";
                        hint.classList.remove("hidden");
                        contentHidden.classList.add("hidden");
                    }
                },

                'createHintTextArea': function () {
                    const { _converse } = this.__super__,
                          { __ } = _converse;

                    const hintTextArea = document.createElement('input');
                    hintTextArea.setAttribute('type', 'text');
                    hintTextArea.setAttribute('placeholder', __('Hint (optional)'));
                    hintTextArea.classList.add('chat-textarea-hint');
                    hintTextArea.style.height = '30px';
                    return hintTextArea;
                },

                'toggleEditSpoilerMessage': function () {
                    const { _converse } = this.__super__,
                          { __ } = _converse;

                    const form = this.el.querySelector('.sendXMPPMessage');
                    const textArea = this.el.querySelector('.chat-textarea');
                    const spoiler_button = this.el.querySelector('.toggle-spoiler-edit');

                    if (!isEditSpoilerMessage()) {
                        textArea.style['background-color'] = '#D5FFD2';
                        textArea.setAttribute('placeholder', __('Write your spoiler\'s content here'));
                        spoiler_button.setAttribute("active", "true");
                        // TODO template
                        spoiler_button.innerHTML = '<a class="icon-eye-blocked" title="' + __('Cancel writing spoiler message') + '"></a>';
                        // better get the element <a></a> and change the class?
                        form.insertBefore(this.createHintTextArea(), textArea);
                        // <textarea type="text" class="chat-textarea-hint " placeholder="Hint (optional)" style="background-color: rgb(188, 203, 209); height:30px;"></textarea>
                    } else {
                        textArea.style['background-color'] = '';
                        textArea.setAttribute('placeholder', __('Personal message'));
                        spoiler_button.setAttribute("active", "false");
                        spoiler_button.innerHTML = '<a class="icon-eye" title="' + __('Click here to write a message as a spoiler') + '"></a>'; // better get the element <a></a> and change the class?
                        const hintTextArea = document.querySelector('.chat-textarea-hint');
                        if ( hintTextArea ) {
                            hintTextArea.remove();
                        }
                    }
                },

                'createMessageStanza': function () {
                    const messageStanza = this.__super__.createMessageStanza.apply(this, arguments);
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
                    const { _converse } = this.__super__,
                          { __ } = _converse;

                    console.log('These are the attrs and the msg object\n');
                    console.log(attrs);
                    const msg = this.__super__.renderMessage.apply(this, arguments);
                    console.log(msg);

                    //Spoiler logic
                    //The value of the "spoiler" attribute, corresponds to the spoiler's hint.
                    if ("spoiler" in attrs) {
                        console.log('Spoiler in attrs \n');
                        const button = document.createElement("button");
                        const container = document.createElement("div"); 
                        const content = document.createElement( "div" );
                        const hint = document.createElement("div");
                        const contentHidden = document.createElement("div");
                        const messageContent = msg.querySelector(".chat-msg-content");

                        hint.appendChild(document.createTextNode(attrs.spoiler));

                        for (var i = 0; i < messageContent.childNodes.length; i++){
                            contentHidden.append(messageContent.childNodes[i]);
                        }
                        contentHidden.classList.add("hidden");
                        // contentHidden.addHyperlinks();
                        // contentHidden.addEmoticons(_converse.visible_toolbar_buttons.emoticons);

                        container.style.backgroundColor = "Lavender";
                        container.style.textAlign = "center";

                        //Spoiler's content
                        content.classList.add("spoiler-content");
                        content.appendChild(hint);
                        content.appendChild(contentHidden);
                        //Spoiler's button
                        button.classList.add("toggle-spoiler-display");
                        button.classList.add("icon-eye");
                        button.setAttribute("type", "button");
                        button.appendChild(document.createTextNode(__('Show ')));
                        button.style.width = "100%";
                        button.setAttribute("closed", "true");

                        container.appendChild(button);
                        container.appendChild(content);

                        console.log('And this is the container:\n');
                        console.log(container);

                        messageContent.textContent = "";
                        messageContent.append(document.createElement("br"));
                        messageContent.append(container);
                    }

                    return msg;
                }
            },
            'ChatBox': {
                'getMessageAttributes': function (message, delay, original_stanza) {
                    const { _converse } = this.__super__,
                          { __ } = _converse;
                    const messageAttributes = this.__super__.getMessageAttributes.apply(this, arguments);
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
                        messageAttributes.spoiler = spoiler.textContent.length > 0 ? spoiler.textContent : __('Spoiler');
                    }
                    return messageAttributes;
                }
            }
        },

        /* Converse.js's plugin mechanism will call the initialize
         * method on any plugin (if it exists) as soon as the plugin has
         * been loaded.
         */
        initialize () {
            /* Inside this method, you have access to the private
             * `_converse` object.
             */
            const { _converse } = this;

            function initSpoilers (chatbox) {
                chatbox.renderToolbar();
            }
            _converse.on('chatBoxFocused', initSpoilers);
        }
    });
}));

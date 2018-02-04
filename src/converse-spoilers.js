(function (root, factory) {
    define([
        "converse-core",
        "tpl!spoiler_button",
        "converse-chatview"
    ], factory);
}(this, function (converse, tpl_spoiler_button) {

    const { _, Strophe } = converse.env;
    const u = converse.env.utils;

    Strophe.addNamespace('SPOILER', 'urn:xmpp:spoiler:0');


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

                addSpoilerToolbarButton () {
                    const toolbar_el = this.el.querySelector('.chat-toolbar');
                    if (!_.isNull(toolbar_el)) {
                        toolbar_el.insertAdjacentHTML(
                            'beforeend',
                            tpl_spoiler_button(_.extend(
                                this.model.toJSON(), {
                                'title': this.__super__._converse.__('Click here to write a message as a spoiler')
                            }))
                        );
                    }
                },

                renderToolbar (toolbar, options) {
                    const result = this.__super__.renderToolbar.apply(this, arguments);
                    this.addSpoilerToolbarButton();
                    return result;
                },

                getOutgoingMessageAttributes (text) {
                    const { __ } = this.__super__._converse,
                          attrs = this.__super__.getOutgoingMessageAttributes.apply(this, arguments);

                    if (this.model.get('sending_spoiler')) {
                        const spoiler = this.el.querySelector('.chat-textarea-hint')
                        attrs.is_spoiler = true;
                        attrs.spoiler_hint = spoiler.textContent.length > 0 ? spoiler.textContent : __('Spoiler');
                    }
                    return attrs;
                },

                toggleSpoilerMessage (event) {
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

                toggleEditSpoilerMessage () {
                    const { _converse } = this.__super__,
                          { __ } = _converse,
                          text_area = this.el.querySelector('.chat-textarea'),
                          spoiler_button = this.el.querySelector('.toggle-spoiler-edit');
                    let spoiler_title;

                    if (this.model.get('sending_spoiler')) {
                        this.model.set('sending_spoiler', false);
                        spoiler_title = __('Click to write your message as a spoiler');
                    } else {
                        this.model.set('sending_spoiler', true);
                        spoiler_title = __('Click to write as a normal (non-spoiler) message');
                    }
                    spoiler_button.outerHTML = tpl_spoiler_button(_.extend(
                        this.model.toJSON(), {'title': spoiler_title})
                    )
                    this.renderMessageForm();
                },

                addSpoilerElement (stanza) {
                    if (this.model.get('sending_spoiler')) {
                        const has_hint = this.el.querySelector('.chat-textarea-hint').value.length > 0;
                        if (has_hint) {
                            const hint = document.querySelector('.chat-textarea-hint').value;
                            stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER }, hint);
                        } else {
                            stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER });
                        }
                    }
                },

                createMessageStanza () {
                    const stanza = this.__super__.createMessageStanza.apply(this, arguments);
                    this.addSpoilerElement(stanza);
                    return stanza;
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

                    // Spoiler logic
                    // The value of the "spoiler" attribute, corresponds to the spoiler's hint.
                    if (attrs.is_spoiler) {
                        console.log('Spoiler in attrs \n');
                        const button = document.createElement("button");
                        const container = document.createElement("div");
                        const content = document.createElement( "div" );
                        const hint = document.createElement("div");
                        const contentHidden = document.createElement("div");
                        const messageContent = msg.querySelector(".chat-msg-content");

                        hint.appendChild(document.createTextNode(attrs.spoiler_hint));

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

                getMessageAttributes (message, delay, original_stanza) {
                    const attrs = this.__super__.getMessageAttributes.apply(this, arguments);
                    const spoiler = message.querySelector(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`)
                    if (spoiler) {
                        const { __ } = this.__super__._converse;
                        attrs.is_spoiler = true;
                        attrs.spoiler_hint = spoiler.textContent.length > 0 ? spoiler.textContent : __('Spoiler');
                    }
                    return attrs;
                }
            }
        }
    });
}));

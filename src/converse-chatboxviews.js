// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define([
        "converse-core",
        "templates/chatboxes.html",
        "converse-chatboxes",
        "backbone.overview"
    ], factory);
}(this, function (converse, tpl_chatboxes) {
    "use strict";

    const { Backbone, _ } = converse.env;

    const AvatarMixin = {
        renderAvatar () {
            const canvas_el = this.el.querySelector('canvas');
            if (_.isNull(canvas_el)) {
                return;
            }
            const image_type = this.model.vcard.get('image_type'),
                    image = this.model.vcard.get('image'),
                    img_src = "data:" + image_type + ";base64," + image,
                    img = new Image();

            img.onload = () => {
                const ctx = canvas_el.getContext('2d'),
                        ratio = img.width / img.height;
                ctx.clearRect(0, 0, canvas_el.width, canvas_el.height);
                if (ratio < 1) {
                    const scaled_img_with = canvas_el.width*ratio,
                            x = Math.floor((canvas_el.width-scaled_img_with)/2);
                    ctx.drawImage(img, x, 0, scaled_img_with, canvas_el.height);
                } else {
                    ctx.drawImage(img, 0, 0, canvas_el.width, canvas_el.height*ratio);
                }
            };
            img.src = img_src;
        },
    };


    converse.plugins.add('converse-chatboxviews', {

        dependencies: ["converse-chatboxes"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.

            initStatus: function (reconnecting) {
                const { _converse } = this.__super__;
                if (!reconnecting) {
                    _converse.chatboxviews.closeAllChatBoxes();
                }
                return this.__super__.initStatus.apply(this, arguments);
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __ } = _converse;

            _converse.api.promises.add([
                'chatBoxViewsInitialized'
            ]);

            _converse.ViewWithAvatar = Backbone.NativeView.extend(AvatarMixin);
            _converse.VDOMViewWithAvatar = Backbone.VDOMView.extend(AvatarMixin);


            _converse.ChatBoxViews = Backbone.Overview.extend({

                _ensureElement () {
                    /* Override method from backbone.js
                     * If the #conversejs element doesn't exist, create it.
                     */
                    if (!this.el) {
                        let el = _converse.root.querySelector('#conversejs');
                        if (_.isNull(el)) {
                            el = document.createElement('div');
                            el.setAttribute('id', 'conversejs');
                            const body = _converse.root.querySelector('body');
                            if (body) {
                                body.appendChild(el);
                            } else {
                                // Perhaps inside a web component?
                                _converse.root.appendChild(el);
                            }
                        }
                        el.innerHTML = '';
                        this.setElement(el, false);
                    } else {
                        this.setElement(_.result(this, 'el'), false);
                    }
                },

                initialize () {
                    this.model.on("destroy", this.removeChat, this);
                    this.el.classList.add(`converse-${_converse.view_mode}`);
                    this.render();
                },

                render () {
                    try {
                        this.el.innerHTML = tpl_chatboxes();
                    } catch (e) {
                        this._ensureElement();
                        this.el.innerHTML = tpl_chatboxes();
                    }
                    this.row_el = this.el.querySelector('.row');
                },

                insertRowColumn (el) {
                    /* Add a new DOM element (likely a chat box) into the
                     * the row managed by this overview.
                     */
                    this.row_el.insertAdjacentElement('afterBegin', el);
                },

                removeChat (item) {
                    this.remove(item.get('id'));
                },

                closeAllChatBoxes () {
                    /* This method gets overridden in src/converse-controlbox.js if
                     * the controlbox plugin is active.
                     */
                    this.each(function (view) { view.close(); });
                    return this;
                },

                chatBoxMayBeShown (chatbox) {
                    return this.model.chatBoxMayBeShown(chatbox);
                }
            });


            /************************ BEGIN Event Handlers ************************/
            _converse.api.waitUntil('rosterContactsFetched').then(() => {
                _converse.roster.on('add', (contact) => {
                    /* When a new contact is added, check if we already have a
                     * chatbox open for it, and if so attach it to the chatbox.
                     */
                    const chatbox = _converse.chatboxes.findWhere({'jid': contact.get('jid')});
                    if (chatbox) {
                        chatbox.addRelatedContact(contact);
                    }
                });
            });


            _converse.api.listen.on('chatBoxesInitialized', () => {
                _converse.chatboxviews = new _converse.ChatBoxViews({
                    'model': _converse.chatboxes
                });
                _converse.emit('chatBoxViewsInitialized');
            });

            _converse.api.listen.on('clearSession', () => _converse.chatboxviews.closeAllChatBoxes());
            /************************ END Event Handlers ************************/
        }
    });
    return converse;
}));

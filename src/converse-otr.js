// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window, crypto, CryptoJS */

/* This is a Converse.js plugin which add support Off-the-record (OTR)
 * encryption of one-on-one chat messages.
 */
(function (root, factory) {
    define([
        "converse-chatview",
        "bootstrap",
        "tpl!toolbar_otr",
        'otr'
    ], factory);
}(this, function (converse, bootstrap, tpl_toolbar_otr, otr) {
    "use strict";

    const { Strophe, utils, _ } = converse.env;

    const HAS_CSPRNG = _.isUndefined(window.crypto) ? false : (
        _.isFunction(window.crypto.randomBytes) ||
        _.isFunction(window.crypto.getRandomValues)
    );

    const HAS_CRYPTO = HAS_CSPRNG && (
        (!_.isUndefined(otr.OTR)) &&
        (!_.isUndefined(otr.DSA))
    );

    const UNENCRYPTED = 0;
    const UNVERIFIED= 1;
    const VERIFIED= 2;
    const FINISHED = 3;

    const OTR_TRANSLATED_MAPPING  = {}; // Populated in initialize
    const OTR_CLASS_MAPPING = {};
    OTR_CLASS_MAPPING[UNENCRYPTED] = 'unencrypted';
    OTR_CLASS_MAPPING[UNVERIFIED] = 'unverified';
    OTR_CLASS_MAPPING[VERIFIED] = 'verified';
    OTR_CLASS_MAPPING[FINISHED] = 'finished';


    converse.plugins.add('converse-otr', {
        /* Plugin dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin.
         *
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found. By default it's
         * false, which means these plugins are only loaded opportunistically.
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

            ChatBox: {
                initialize () {
                    this.__super__.initialize.apply(this, arguments);
                    if (this.get('box_id') !== 'controlbox') {
                        this.save({'otr_status': this.get('otr_status') || UNENCRYPTED});
                    }
                },

                createMessageStanza () {
                    const stanza = this.__super__.createMessageStanza.apply(this, arguments);
                    if (this.get('otr_status') !== UNENCRYPTED || utils.isOTRMessage(stanza.nodeTree)) {
                        // OTR messages aren't carbon copied
                        stanza.c('private', {'xmlns': Strophe.NS.CARBONS}).up()
                              .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                              .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS}).up()
                              .c('no-copy', {'xmlns': Strophe.NS.HINTS});
                    }
                    return stanza;
                },

                shouldPlayNotification ($message) {
                    /* Don't play a notification if this is an OTR message but
                     * encryption is not yet set up. That would mean that the
                     * OTR session is still being established, so there are no
                     * "visible" OTR messages being exchanged.
                     */
                    return this.__super__.shouldPlayNotification.apply(this, arguments) &&
                        !(utils.isOTRMessage($message[0]) && !_.includes([UNVERIFIED, VERIFIED], this.get('otr_status')));
                },

                createMessage (message, delay, original_stanza) {
                    const { _converse } = this.__super__,
                        text = _.propertyOf(message.querySelector('body'))('textContent');

                    if ((!text) || (!_converse.allow_otr)) {
                        return this.__super__.createMessage.apply(this, arguments);
                    }

                    if (utils.isNewMessage(original_stanza)) {
                        if (text.match(/^\?OTRv23?/)) {
                            return this.initiateOTR(text);
                        } else if (_.includes([UNVERIFIED, VERIFIED], this.get('otr_status'))) {
                            return this.otr.receiveMsg(text);
                        } else if (text.match(/^\?OTR/)) {
                            if (!this.otr) {
                                return this.initiateOTR(text);
                            } else {
                                return this.otr.receiveMsg(text);
                            }
                        }
                    }
                    // Normal unencrypted message (or archived message)
                    return this.__super__.createMessage.apply(this, arguments);
                },

                generatePrivateKey (instance_tag) {
                    const { _converse } = this.__super__;
                    const key = new otr.DSA();
                    const { jid } = _converse.connection;
                    if (_converse.cache_otr_key) {
                        this.save({
                            'otr_priv_key': key.packPrivate(),
                            'otr_instance_tag': instance_tag
                        });
                    }
                    return key;
                },

                getSession (callback) {
                    const { _converse } = this.__super__,
                        { __ } = _converse;
                    let instance_tag, saved_key, encrypted_key;
                    if (_converse.cache_otr_key) {
                        encrypted_key = this.get('otr_priv_key');
                        if (_.isString(encrypted_key)) {
                            instance_tag = this.get('otr_instance_tag');
                            saved_key = otr.DSA.parsePrivate(encrypted_key);
                            if (saved_key && instance_tag) {
                                this.trigger('showHelpMessages', [__('Re-establishing encrypted session')]);
                                callback({
                                    'key': saved_key,
                                    'instance_tag': instance_tag
                                });
                                return; // Our work is done here
                            }
                        }
                    }
                    // We need to generate a new key and instance tag
                    this.trigger('showHelpMessages', [
                        __('Generating private key.'),
                        __('Your browser might become unresponsive.')],
                        null,
                        true // show spinner
                    );
                    const that = this;
                    window.setTimeout(function () {
                        callback({
                            'key': that.generatePrivateKey(instance_tag),
                            'instance_tag': otr.OTR.makeInstanceTag()
                        });
                    }, 500);
                },

                updateOTRStatus (state) {
                    switch (state) {
                        case otr.OTR.CONST.STATUS_AKE_SUCCESS:
                            if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_ENCRYPTED) {
                                this.save({'otr_status': UNVERIFIED});
                            }
                            break;
                        case otr.OTR.CONST.STATUS_END_OTR:
                            if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_FINISHED) {
                                this.save({'otr_status': FINISHED});
                            } else if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_PLAINTEXT) {
                                this.save({'otr_status': UNENCRYPTED});
                            }
                            break;
                    }
                },

                onSMP (type, data) {
                    // Event handler for SMP (Socialist's Millionaire Protocol)
                    // used by OTR (off-the-record).
                    const { _converse } = this.__super__,
                        { __ } = _converse;
                    switch (type) {
                        case 'question':
                            this.otr.smpSecret(prompt(__(
                                'Authentication request from %1$s\n\nYour chat contact is attempting to verify your identity, by asking you the question below.\n\n%2$s',
                                [this.get('fullname'), data])));
                            break;
                        case 'trust':
                            if (data === true) {
                                this.save({'otr_status': VERIFIED});
                            } else {
                                this.trigger(
                                    'showHelpMessages',
                                    [__("Could not verify this user's identify.")],
                                    'error');
                                this.save({'otr_status': UNVERIFIED});
                            }
                            break;
                        default:
                            throw new TypeError('ChatBox.onSMP: Unknown type for SMP');
                    }
                },

                initiateOTR (query_msg) {
                    // Sets up an OTR object through which we can send and receive
                    // encrypted messages.
                    //
                    // If 'query_msg' is passed in, it means there is an alread incoming
                    // query message from our contact. Otherwise, it is us who will
                    // send the query message to them.
                    const { _converse } = this.__super__,
                        { __ } = _converse;
                    this.save({'otr_status': UNENCRYPTED});
                    this.getSession((session) => {
                        const { _converse } = this.__super__;
                        this.otr = new otr.OTR({
                            fragment_size: 140,
                            send_interval: 200,
                            priv: session.key,
                            instance_tag: session.instance_tag,
                            debug: this.debug
                        });
                        this.otr.on('status', this.updateOTRStatus.bind(this));
                        this.otr.on('smp', this.onSMP.bind(this));

                        this.otr.on('ui', (msg) => {
                            this.trigger('showReceivedOTRMessage', msg);
                        });
                        this.otr.on('io', (msg) => {
                            this.sendMessage({'message':msg});
                        });
                        this.otr.on('error', (msg) => {
                            this.trigger('showOTRError', msg);
                        });

                        this.trigger('showHelpMessages', [__('Exchanging private key with contact.')]);
                        if (query_msg) {
                            this.otr.receiveMsg(query_msg);
                        } else {
                            this.otr.sendQueryMsg();
                        }
                    });
                },

                endOTR () {
                    if (this.otr) {
                        this.otr.endOtr();
                    }
                    this.save({'otr_status': UNENCRYPTED});
                }
            },

            ChatBoxView:  {
                events: {
                    'click .toggle-otr': 'toggleOTRMenu',
                    'click .start-otr': 'startOTRFromToolbar',
                    'click .end-otr': 'endOTR',
                    'click .auth-otr': 'authOTR'
                },

                initialize () {
                    const { _converse } = this.__super__;
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:otr_status', this.onOTRStatusChanged, this);
                    this.model.on('showOTRError', this.showOTRError, this);
                    this.model.on('showSentOTRMessage', function (text) {
                        this.showMessage({'message': text, 'sender': 'me'});
                    }, this);
                    this.model.on('showReceivedOTRMessage', function (text) {
                        this.showMessage({'message': text, 'sender': 'them'});
                    }, this);
                    if ((_.includes([UNVERIFIED, VERIFIED], this.model.get('otr_status'))) || _converse.use_otr_by_default) {
                        this.model.initiateOTR();
                    }
                },

                parseMessageForCommands (text) {
                    const { _converse } = this.__super__;
                    const match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/);
                    if (match) {
                        if ((_converse.allow_otr) && (match[1] === "endotr")) {
                            this.endOTR();
                            return true;
                        } else if ((_converse.allow_otr) && (match[1] === "otr")) {
                            this.model.initiateOTR();
                            return true;
                        }
                    }
                    return this.__super__.parseMessageForCommands.apply(this, arguments);
                },

                isOTREncryptedSession () {
                    return _.includes([UNVERIFIED, VERIFIED], this.model.get('otr_status'));
                },

                onMessageSubmitted (text, spoiler_hint) {
                    const { _converse } = this.__super__;
                    if (!_converse.connection.authenticated) {
                        this.__super__.onMessageSubmitted.apply(this, arguments);
                    }
                    if (this.parseMessageForCommands(text)) {
                        return;
                    }
                    if (this.isOTREncryptedSession()) {
                        this.model.otr.sendMsg(text);
                        this.model.trigger('showSentOTRMessage', text);
                    } else {
                        this.__super__.onMessageSubmitted.apply(this, arguments);
                    }
                },

                onOTRStatusChanged () {
                    this.renderToolbar().informOTRChange();
                },

                informOTRChange () {
                    const { _converse } = this.__super__,
                        { __ } = _converse,
                        data = this.model.toJSON(),
                        msgs = [];
                    if (data.otr_status === UNENCRYPTED) {
                        msgs.push(__("Your messages are not encrypted anymore"));
                    } else if (data.otr_status === UNVERIFIED) {
                        msgs.push(__("Your messages are now encrypted but your contact's identity has not been verified."));
                    } else if (data.otr_status === VERIFIED) {
                        msgs.push(__("Your contact's identify has been verified."));
                    } else if (data.otr_status === FINISHED) {
                        msgs.push(__("Your contact has ended encryption on their end, you should do the same."));
                    }
                    return this.showHelpMessages(msgs, 'info', false);
                },

                showOTRError (msg) {
                    const { _converse } = this.__super__,
                        { __ } = _converse;
                    if (msg === 'Message cannot be sent at this time.') {
                        this.showHelpMessages(
                            [__('Your message could not be sent')], 'error');
                    } else if (msg === 'Received an unencrypted message.') {
                        this.showHelpMessages(
                            [__('We received an unencrypted message')], 'error');
                    } else if (msg === 'Received an unreadable encrypted message.') {
                        this.showHelpMessages(
                            [__('We received an unreadable encrypted message')],
                            'error');
                    } else {
                        this.showHelpMessages([`Encryption error occured: ${msg}`], 'error');
                    }
                    _converse.log(`OTR ERROR:${msg}`, Strophe.LogLevel.ERROR);
                },

                startOTRFromToolbar (ev) {
                    ev.stopPropagation();
                    this.model.initiateOTR();
                },

                endOTR (ev) {
                    if (!_.isUndefined(ev)) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    this.model.endOTR();
                },

                authOTR (ev) {
                    const { _converse } = this.__super__,
                        { __ } = _converse,
                        scheme = ev.target.getAttribute('data-scheme');
                    let result, question, answer;
                    if (scheme === 'fingerprint') {
                        result = confirm(__('Here are the fingerprints, please confirm them with %1$s, outside of this chat.\n\nFingerprint for you, %2$s: %3$s\n\nFingerprint for %1$s: %4$s\n\nIf you have confirmed that the fingerprints match, click OK, otherwise click Cancel.', [
                                this.model.get('fullname'),
                                _converse.xmppstatus.get('fullname')||_converse.bare_jid,
                                this.model.otr.priv.fingerprint(),
                                this.model.otr.their_priv_pk.fingerprint()
                            ]
                        ));
                        if (result === true) {
                            this.model.save({'otr_status': VERIFIED});
                        } else {
                            this.model.save({'otr_status': UNVERIFIED});
                        }
                    } else if (scheme === 'smp') {
                        alert(__('You will be prompted to provide a security question and then an answer to that question.\n\nYour contact will then be prompted the same question and if they type the exact same answer (case sensitive), their identity will be verified.'));
                        question = prompt(__('What is your security question?'));
                        if (question) {
                            answer = prompt(__('What is the answer to the security question?'));
                            this.model.otr.smpSecret(answer, question);
                        }
                    } else {
                        this.showHelpMessages([__('Invalid authentication scheme provided')], 'error');
                    }
                },

                toggleOTRMenu (ev) {
                    if (_.isUndefined(this.otr_dropdown)) {
                        ev.stopPropagation();
                        const dropdown_el = this.el.querySelector('.toggle-otr');
                        this.otr_dropdown = new bootstrap.Dropdown(dropdown_el, true);
                        this.otr_dropdown.toggle();
                    }
                },

                getOTRTooltip () {
                    const { _converse } = this.__super__,
                        { __ } = _converse,
                        data = this.model.toJSON();
                    if (data.otr_status === UNENCRYPTED) {
                        return __('Your messages are not encrypted. Click here to enable OTR encryption.');
                    } else if (data.otr_status === UNVERIFIED) {
                        return __('Your messages are encrypted, but your contact has not been verified.');
                    } else if (data.otr_status === VERIFIED) {
                        return __('Your messages are encrypted and your contact verified.');
                    } else if (data.otr_status === FINISHED) {
                        return __('Your contact has closed their end of the private session, you should do the same');
                    }
                },

                addOTRToolbarButton (options) {
                    const { _converse } = this.__super__,
                          { __ } = _converse,
                          data = this.model.toJSON();
                    options = _.extend(options || {}, {
                        FINISHED,
                        UNENCRYPTED,
                        UNVERIFIED,
                        VERIFIED,
                        // FIXME: Leaky abstraction MUC
                        allow_otr: _converse.allow_otr && !this.is_chatroom,
                        label_end_encrypted_conversation: __('End encrypted conversation'),
                        label_refresh_encrypted_conversation: __('Refresh encrypted conversation'),
                        label_start_encrypted_conversation: __('Start encrypted conversation'),
                        label_verify_with_fingerprints: __('Verify with fingerprints'),
                        label_verify_with_smp: __('Verify with SMP'),
                        label_whats_this: __("What\'s this?"),
                        otr_status_class: OTR_CLASS_MAPPING[data.otr_status],
                        otr_tooltip: this.getOTRTooltip(),
                        otr_translated_status: OTR_TRANSLATED_MAPPING[data.otr_status],
                    });
                    this.el.querySelector('.chat-toolbar').insertAdjacentHTML(
                        'beforeend',
                        tpl_toolbar_otr(_.extend(data, options || {})));
                },

                getToolbarOptions (options) {
                    options = this.__super__.getToolbarOptions();
                    if (this.isOTREncryptedSession()) {
                        options.show_spoiler_button = false;
                    }
                    return options;
                },

                renderToolbar (toolbar, options) {
                    const result = this.__super__.renderToolbar.apply(this, arguments);
                    this.addOTRToolbarButton(options);
                    return result;
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __ } = _converse;

            _converse.api.settings.update({
                allow_otr: true,
                cache_otr_key: false,
                use_otr_by_default: false
            });

            // Translation aware constants
            // ---------------------------
            // We can only call the __ translation method *after* converse.js
            // has been initialized and with it the i18n machinery. That's why
            // we do it here in the "initialize" method and not at the top of
            // the module.
            OTR_TRANSLATED_MAPPING[UNENCRYPTED] = __('unencrypted');
            OTR_TRANSLATED_MAPPING[UNVERIFIED] = __('unverified');
            OTR_TRANSLATED_MAPPING[VERIFIED] = __('verified');
            OTR_TRANSLATED_MAPPING[FINISHED] = __('finished');

            // Only allow OTR if we have the capability
            _converse.allow_otr = _converse.allow_otr && HAS_CRYPTO;
            // Only use OTR by default if allow OTR is enabled to begin with
            _converse.use_otr_by_default = _converse.use_otr_by_default && _converse.allow_otr;
        }
    });
}));

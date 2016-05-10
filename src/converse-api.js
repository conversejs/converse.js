// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define("converse-api", [
            "jquery",
            "underscore",
            "moment_with_locales",
            "strophe",
            "utils",
            "converse-core"
        ],
        factory);
}(this, function ($, _, moment, strophe, utils, converse) {
    var Strophe = strophe.Strophe;
    return {
        'initialize': function (settings, callback) {
            converse.initialize(settings, callback);
        },
        'connection': {
            'connected': function () {
                return converse.connection && converse.connection.connected || false;
            },
            'disconnect': function () {
                converse.connection.disconnect();
            },
        },
        'user': {
            'jid': function () {
                return converse.connection.jid;
            },
            'login': function (credentials) {
                converse.initConnection();
                converse.logIn(credentials);
            },
            'logout': function () {
                converse.logOut();
            },
            'status': {
                'get': function () {
                    return converse.xmppstatus.get('status');
                },
                'set': function (value, message) {
                    var data = {'status': value};
                    if (!_.contains(_.keys(converse.STATUS_WEIGHTS), value)) {
                        throw new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1');
                    }
                    if (typeof message === "string") {
                        data.status_message = message;
                    }
                    converse.xmppstatus.sendPresence(value);
                    converse.xmppstatus.save(data);
                },
                'message': {
                    'get': function () {
                        return converse.xmppstatus.get('status_message');
                    },
                    'set': function (stat) {
                        converse.xmppstatus.save({'status_message': stat});
                    }
                }
            },
        },
        'settings': {
            'get': function (key) {
                if (_.contains(Object.keys(converse.default_settings), key)) {
                    return converse[key];
                }
            },
            'set': function (key, val) {
                var o = {};
                if (typeof key === "object") {
                    _.extend(converse, _.pick(key, Object.keys(converse.default_settings)));
                } else if (typeof key === "string") {
                    o[key] = val;
                    _.extend(converse, _.pick(o, Object.keys(converse.default_settings)));
                }
            }
        },
        'contacts': {
            'get': function (jids) {
                var _transform = function (jid) {
                    var contact = converse.roster.get(Strophe.getBareJidFromJid(jid));
                    if (contact) {
                        return contact.attributes;
                    }
                    return null;
                };
                if (typeof jids === "undefined") {
                    jids = converse.roster.pluck('jid');
                } else if (typeof jids === "string") {
                    return _transform(jids);
                }
                return _.map(jids, _transform);
            },
            'add': function (jid, name) {
                if (typeof jid !== "string" || jid.indexOf('@') < 0) {
                    throw new TypeError('contacts.add: invalid jid');
                }
                converse.roster.addAndSubscribe(jid, _.isEmpty(name)? jid: name);
            }
        },
        'chats': {
            'open': function (jids) {
                var chatbox;
                if (typeof jids === "undefined") {
                    converse.log("chats.open: You need to provide at least one JID", "error");
                    return null;
                } else if (typeof jids === "string") {
                    chatbox = converse.wrappedChatBox(converse.chatboxes.getChatBox(jids, true));
                    chatbox.open();
                    return chatbox;
                }
                return _.map(jids, function (jid) {
                    chatbox = converse.wrappedChatBox(converse.chatboxes.getChatBox(jid, true));
                    chatbox.open();
                    return chatbox;
                });
            },
            'get': function (jids) {
                if (typeof jids === "undefined") {
                    converse.log("chats.get: You need to provide at least one JID", "error");
                    return null;
                } else if (typeof jids === "string") {
                    return converse.wrappedChatBox(converse.chatboxes.getChatBox(jids, true));
                }
                return _.map(jids, _.partial(_.compose(converse.wrappedChatBox, converse.chatboxes.getChatBox.bind(converse.chatboxes)), _, true));
            }
        },
        'tokens': {
            'get': function (id) {
                if (!converse.expose_rid_and_sid || typeof converse.connection === "undefined") {
                    return null;
                }
                if (id.toLowerCase() === 'rid') {
                    return converse.connection.rid || converse.connection._proto.rid;
                } else if (id.toLowerCase() === 'sid') {
                    return converse.connection.sid || converse.connection._proto.sid;
                }
            }
        },
        'listen': {
            'once': function (evt, handler) {
                converse.once(evt, handler);
            },
            'on': function (evt, handler) {
                converse.on(evt, handler);
            },
            'not': function (evt, handler) {
                converse.off(evt, handler);
            },
            'stanza': function (name, options, handler) {
                if (typeof options === 'function') {
                    handler = options;
                    options = {};
                } else {
                    options = options || {};
                }
                converse.connection.addHandler(
                    handler,
                    options.ns,
                    name,
                    options.type,
                    options.id,
                    options.from,
                    options
                );
            },
        },
        'send': function (stanza) {
            converse.connection.send(stanza);
        },
        'plugins': {
            'add': function (name, plugin) {
                converse.plugins[name] = plugin;
            },
            'remove': function (name) {
                delete converse.plugins[name];
            },
            'override': function (name, value) {
                /* Helper method for overriding methods and attributes directly on the
                 * converse object. For Backbone objects, use instead the 'extend'
                 * method.
                 *
                 * If a method is overridden, then the original method will still be
                 * available via the _super attribute.
                 *
                 * name: The attribute being overridden.
                 * value: The value of the attribute being overridden.
                 */
                converse._overrideAttribute(name, value);
            },
            'extend': function (obj, attributes) {
                /* Helper method for overriding or extending Converse's Backbone Views or Models
                 *
                 * When a method is overriden, the original will still be available
                 * on the _super attribute of the object being overridden.
                 *
                 * obj: The Backbone View or Model
                 * attributes: A hash of attributes, such as you would pass to Backbone.Model.extend or Backbone.View.extend
                 */
                converse._extendObject(obj, attributes);
            }
        },
        'env': {
            '$build': strophe.$build,
            '$iq': strophe.$iq,
            '$msg': strophe.$msg,
            '$pres': strophe.$pres,
            'Strophe': strophe.Strophe,
            'b64_sha1':  strophe.SHA1.b64_sha1,
            '_': _,
            'jQuery': $,
            'moment': moment,
            'utils': utils
        }
    };
}));

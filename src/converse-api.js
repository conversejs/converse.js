// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */
(function (root, factory) {
    define("converse-api", [
            "jquery",
            "lodash",
            "moment_with_locales",
            "strophe",
            "utils",
            "converse-core"
        ],
        factory);
}(this, function ($, _, moment, strophe, utils, converse) {
    var Strophe = strophe.Strophe;

    // API methods only available to plugins
    converse.api = {
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
                    if (!_.includes(_.keys(converse.STATUS_WEIGHTS), value)) {
                        throw new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1');
                    }
                    if (_.isString(message)) {
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
                if (_.includes(_.keys(converse.default_settings), key)) {
                    return converse[key];
                }
            },
            'set': function (key, val) {
                var o = {};
                if (_.isObject(key)) {
                    _.assignIn(converse, _.pick(key, _.keys(converse.default_settings)));
                } else if (_.isString("string")) {
                    o[key] = val;
                    _.assignIn(converse, _.pick(o, _.keys(converse.default_settings)));
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
                if (_.isUndefined(jids)) {
                    jids = converse.roster.pluck('jid');
                } else if (_.isString(jids)) {
                    return _transform(jids);
                }
                return _.map(jids, _transform);
            },
            'add': function (jid, name) {
                if (!_.isString(jid) || !_.includes(jid, '@')) {
                    throw new TypeError('contacts.add: invalid jid');
                }
                converse.roster.addAndSubscribe(jid, _.isEmpty(name)? jid: name);
            }
        },
        'chats': {
            'open': function (jids) {
                var chatbox;
                if (_.isUndefined(jids)) {
                    converse.log("chats.open: You need to provide at least one JID", "error");
                    return null;
                } else if (_.isString(jids)) {
                    chatbox = converse.wrappedChatBox(
                        converse.chatboxes.getChatBox(jids, true).trigger('show')
                    );
                    return chatbox;
                }
                return _.map(jids, function (jid) {
                    chatbox = converse.wrappedChatBox(
                        converse.chatboxes.getChatBox(jid, true).trigger('show')
                    );
                    return chatbox;
                });
            },
            'get': function (jids) {
                if (_.isUndefined(jids)) {
                    var result = [];
                    converse.chatboxes.each(function (chatbox) {
                        // FIXME: Leaky abstraction from MUC. We need to add a
                        // base type for chat boxes, and check for that.
                        if (chatbox.get('type') !== 'chatroom') {
                            result.push(converse.wrappedChatBox(chatbox));
                        }
                    });
                    return result;
                } else if (_.isString(jids)) {
                    return converse.wrappedChatBox(converse.chatboxes.getChatBox(jids));
                }
                return _.map(jids,
                    _.partial(
                        _.flow(
                            converse.chatboxes.getChatBox.bind(converse.chatboxes),
                            converse.wrappedChatBox.bind(converse)
                        ), _, true
                    )
                );
            }
        },
        'tokens': {
            'get': function (id) {
                if (!converse.expose_rid_and_sid || _.isUndefined(converse.connection)) {
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
            'once': converse.once,
            'on': converse.on,
            'not': converse.off,
            'stanza': function (name, options, handler) {
                if (_.isFunction(options)) {
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
    };

    // The public API
    return {
        'initialize': function (settings, callback) {
            return converse.initialize(settings, callback);
        },
        'plugins': {
            'add': function (name, plugin) {
                plugin.__name__ = name;
                converse.pluggable.plugins[name] = plugin;
            },
            'remove': function (name) {
                delete converse.pluggable.plugins[name];
            },
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

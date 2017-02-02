// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
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
}(this, function ($, _, moment, strophe, utils, _converse) {
    var Strophe = strophe.Strophe;

    // API methods only available to plugins
    _converse.api = {
        'connection': {
            'connected': function () {
                return _converse.connection && _converse.connection.connected || false;
            },
            'disconnect': function () {
                _converse.connection.disconnect();
            },
        },
        'user': {
            'jid': function () {
                return _converse.connection.jid;
            },
            'login': function (credentials) {
                _converse.initConnection();
                _converse.logIn(credentials);
            },
            'logout': function () {
                _converse.logOut();
            },
            'status': {
                'get': function () {
                    return _converse.xmppstatus.get('status');
                },
                'set': function (value, message) {
                    var data = {'status': value};
                    if (!_.includes(_.keys(_converse.STATUS_WEIGHTS), value)) {
                        throw new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1');
                    }
                    if (_.isString(message)) {
                        data.status_message = message;
                    }
                    _converse.xmppstatus.sendPresence(value);
                    _converse.xmppstatus.save(data);
                },
                'message': {
                    'get': function () {
                        return _converse.xmppstatus.get('status_message');
                    },
                    'set': function (stat) {
                        _converse.xmppstatus.save({'status_message': stat});
                    }
                }
            },
        },
        'settings': {
            'get': function (key) {
                if (_.includes(_.keys(_converse.default_settings), key)) {
                    return _converse[key];
                }
            },
            'set': function (key, val) {
                var o = {};
                if (_.isObject(key)) {
                    _.assignIn(_converse, _.pick(key, _.keys(_converse.default_settings)));
                } else if (_.isString("string")) {
                    o[key] = val;
                    _.assignIn(_converse, _.pick(o, _.keys(_converse.default_settings)));
                }
            }
        },
        'contacts': {
            'get': function (jids) {
                var _transform = function (jid) {
                    var contact = _converse.roster.get(Strophe.getBareJidFromJid(jid));
                    if (contact) {
                        return contact.attributes;
                    }
                    return null;
                };
                if (_.isUndefined(jids)) {
                    jids = _converse.roster.pluck('jid');
                } else if (_.isString(jids)) {
                    return _transform(jids);
                }
                return _.map(jids, _transform);
            },
            'add': function (jid, name) {
                if (!_.isString(jid) || !_.includes(jid, '@')) {
                    throw new TypeError('contacts.add: invalid jid');
                }
                _converse.roster.addAndSubscribe(jid, _.isEmpty(name)? jid: name);
            }
        },
        'chats': {
            'open': function (jids) {
                var chatbox;
                if (_.isUndefined(jids)) {
                    _converse.log("chats.open: You need to provide at least one JID", "error");
                    return null;
                } else if (_.isString(jids)) {
                    chatbox = _converse.wrappedChatBox(
                        _converse.chatboxes.getChatBox(jids, true).trigger('show')
                    );
                    return chatbox;
                }
                return _.map(jids, function (jid) {
                    chatbox = _converse.wrappedChatBox(
                        _converse.chatboxes.getChatBox(jid, true).trigger('show')
                    );
                    return chatbox;
                });
            },
            'get': function (jids) {
                if (_.isUndefined(jids)) {
                    var result = [];
                    _converse.chatboxes.each(function (chatbox) {
                        // FIXME: Leaky abstraction from MUC. We need to add a
                        // base type for chat boxes, and check for that.
                        if (chatbox.get('type') !== 'chatroom') {
                            result.push(_converse.wrappedChatBox(chatbox));
                        }
                    });
                    return result;
                } else if (_.isString(jids)) {
                    return _converse.wrappedChatBox(_converse.chatboxes.getChatBox(jids));
                }
                return _.map(jids,
                    _.partial(
                        _.flow(
                            _converse.chatboxes.getChatBox.bind(_converse.chatboxes),
                            _converse.wrappedChatBox.bind(_converse)
                        ), _, true
                    )
                );
            }
        },
        'tokens': {
            'get': function (id) {
                if (!_converse.expose_rid_and_sid || _.isUndefined(_converse.connection)) {
                    return null;
                }
                if (id.toLowerCase() === 'rid') {
                    return _converse.connection.rid || _converse.connection._proto.rid;
                } else if (id.toLowerCase() === 'sid') {
                    return _converse.connection.sid || _converse.connection._proto.sid;
                }
            }
        },
        'listen': {
            'once': _converse.once,
            'on': _converse.on,
            'not': _converse.off,
            'stanza': function (name, options, handler) {
                if (_.isFunction(options)) {
                    handler = options;
                    options = {};
                } else {
                    options = options || {};
                }
                _converse.connection.addHandler(
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
            _converse.connection.send(stanza);
        },
    };

    // The public API
    return {
        'initialize': function (settings, callback) {
            return _converse.initialize(settings, callback);
        },
        'plugins': {
            'add': function (name, plugin) {
                plugin.__name__ = name;
                if (!_.isUndefined(_converse.pluggable.plugins[name])) {
                    throw new TypeError(
                        'Error: plugin with name "'+name+'" has already been '+
                        'registered!');
                } else {
                    _converse.pluggable.plugins[name] = plugin;
                }
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

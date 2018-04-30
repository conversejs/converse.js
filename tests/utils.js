(function (root, factory) {
    define(['converse', 'es6-promise',  'mock', 'wait-until-promise'], factory);
}(this, function (converse_api, Promise, mock, waitUntilPromise) {
    var _ = converse_api.env._;
    var $msg = converse_api.env.$msg;
    var $pres = converse_api.env.$pres;
    var $iq = converse_api.env.$iq;
    var Strophe = converse_api.env.Strophe;
    var u = converse_api.env.utils;
    var utils = {};

    if (typeof window.Promise === 'undefined') {
        waitUntilPromise.setPromiseImplementation(Promise);
    }
    utils.waitUntil = waitUntilPromise.default;

    utils.waitUntilDiscoConfirmed = function (_converse, entity_jid, identities, features, items, type) {
        if (_.isNil(type)) {
            type = 'info';
        }
        var IQ_disco, stanza;
        return utils.waitUntil(function () {
            IQ_disco = _.filter(_converse.connection.IQ_stanzas, function (iq) {
                return iq.nodeTree.querySelector('query[xmlns="http://jabber.org/protocol/disco#'+type+'"]') &&
                    iq.nodeTree.getAttribute('to') === entity_jid;
            }).pop();
            return !_.isUndefined(IQ_disco);
        }, 300).then(function () {
            var info_IQ_id = IQ_disco.nodeTree.getAttribute('id');
            var stanza = $iq({
                'type': 'result',
                'from': entity_jid,
                'to': 'dummy@localhost/resource',
                'id': info_IQ_id
            }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#'+type});

            _.forEach(identities, function (identity) {
                stanza.c('identity', {'category': identity.category, 'type': identity.type}).up()
            });
            _.forEach(features, function (feature) {
                stanza.c('feature', {'var': feature}).up();
            });
            _.forEach(items, function (item) {
                stanza.c('item', {'jid': item}).up();
            });
            _converse.connection._dataRecv(utils.createRequest(stanza));
        });
    }

    utils.createRequest = function (iq) {
        iq = typeof iq.tree == "function" ? iq.tree() : iq;
        var req = new Strophe.Request(iq, function() {});
        req.getResponse = function () {
            var env = new Strophe.Builder('env', {type: 'mock'}).tree();
            env.appendChild(iq);
            return env;
        };
        return req;
    };

    utils.closeAllChatBoxes = function (converse) {
        var i, chatbox;
        for (i=converse.chatboxes.models.length-1; i>-1; i--) {
            chatbox = converse.chatboxes.models[i];
            converse.chatboxviews.get(chatbox.get('id')).close();
        }
        return this;
    };

    utils.openControlBox = function () {
        var toggle = document.querySelector(".toggle-controlbox");
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) {
                u.removeClass('hidden', toggle);
            }
            toggle.click();
        }
        return this;
    };

    utils.closeControlBox = function () {
        var controlbox = document.querySelector("#controlbox");
        if (u.isVisible(controlbox)) {
            var button = controlbox.querySelector(".close-chatbox-button");
            if (!_.isNull(button)) {
                button.click();
            }
        }
        return this;
    };

    utils.openChatBoxes = function (converse, amount) {
        var i = 0, jid, views = [];
        for (i; i<amount; i++) {
            jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
            views[i] = converse.roster.get(jid).trigger("open");
        }
        return views;
    };

    utils.openChatBoxFor = function (converse, jid) {
        return converse.roster.get(jid).trigger("open");
    };

    utils.openChatRoomViaModal = function (_converse, jid, nick) {
        // Opens a new chatroom
        return new Promise(function (resolve, reject) {
            utils.openControlBox(_converse);
            var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
            roomspanel.el.querySelector('.trigger-add-chatrooms-modal').click();
            utils.closeControlBox(_converse);
            const modal = roomspanel.add_room_modal;
            utils.waitUntil(function () {
                return u.isVisible(modal.el);
            }, 1000).then(function () {
                modal.el.querySelector('input[name="chatroom"]').value = jid;
                modal.el.querySelector('form input[type="submit"]').click();
                resolve();
            }).catch(_.partial(console.error, _));
        }).catch(_.partial(console.error, _));
    };

    utils.openChatRoom = function (_converse, room, server, nick) {
        _converse.api.rooms.open(`${room}@${server}`);
    };

    utils.openAndEnterChatRoom = function (_converse, room, server, nick) {
        let last_stanza;

        return new Promise(function (resolve, reject) {
            _converse.api.rooms.open(`${room}@${server}`);
            const view = _converse.chatboxviews.get((room+'@'+server).toLowerCase());
            // We pretend this is a new room, so no disco info is returned.
            last_stanza = _.last(_converse.connection.IQ_stanzas).nodeTree;
            const IQ_id = last_stanza.getAttribute('id');
            const features_stanza = $iq({
                    'from': room+'@'+server,
                    'id': IQ_id,
                    'to': nick+'@'+server,
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(utils.createRequest(features_stanza));

            utils.waitUntil(() => {
                return _.filter(
                    _converse.connection.IQ_stanzas, (node) => node.nodeTree.querySelector('query').getAttribute('node') === 'x-roomuser-item'
                ).length
            }).then(function () {
                const last_stanza = _.filter(
                    _converse.connection.IQ_stanzas, (node) => node.nodeTree.querySelector('query').getAttribute('node') === 'x-roomuser-item'
                ).pop().nodeTree;

                // The XMPP server returns the reserved nick for this user.
                const IQ_id = last_stanza.getAttribute('id');
                const stanza = $iq({
                    'type': 'result',
                    'id': IQ_id,
                    'from': view.model.get('jid'),
                    'to': _converse.connection.jid 
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
                    .c('identity', {'category': 'conference', 'name': nick, 'type': 'text'});
                _converse.connection._dataRecv(utils.createRequest(stanza));
                // The user has just entered the room (because join was called)
                // and receives their own presence from the server.
                // See example 24: http://xmpp.org/extensions/xep-0045.html#enter-pres
                var presence = $pres({
                        to: _converse.connection.jid,
                        from: room+'@'+server+'/'+nick,
                        id: 'DC352437-C019-40EC-B590-AF29E879AF97'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: _converse.bare_jid,
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'110'});
                _converse.connection._dataRecv(utils.createRequest(presence));
                resolve();
            });
        });
    };

    utils.clearBrowserStorage = function () {
        window.localStorage.clear();
        window.sessionStorage.clear();
        return this;
    };

    utils.clearChatBoxMessages = function (converse, jid) {
        var view = converse.chatboxviews.get(jid);
        view.el.querySelector('.chat-content').innerHTML = '';
        view.model.messages.reset();
        view.model.messages.browserStorage._clear();
    };

    utils.createContacts = function (converse, type, length) {
        /* Create current (as opposed to requesting or pending) contacts
         * for the user's roster.
         *
         * These contacts are not grouped. See below.
         */
        var names, jid, subscription, requesting, ask;
        if (type === 'requesting') {
            names = mock.req_names;
            subscription = 'none';
            requesting = true;
            ask = null;
        } else if (type === 'pending') {
            names = mock.pend_names;
            subscription = 'none';
            requesting = false;
            ask = 'subscribe';
        } else if (type === 'current') {
            names = mock.cur_names;
            subscription = 'both';
            requesting = false;
            ask = null;
        } else if (type === 'all') {
            this.createContacts(converse, 'current')
                .createContacts(converse, 'requesting')
                .createContacts(converse, 'pending');
            return this;
        } else {
            throw Error("Need to specify the type of contact to create");
        }

        if (typeof length === 'undefined') {
            length = names.length;
        }
        for (var i=0; i<length; i++) {
            jid = names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
            if (!converse.roster.get(jid)) {
                converse.roster.create({
                    'ask': ask,
                    'fullname': names[i],
                    'jid': jid, 
                    'requesting': requesting,
                    'subscription': subscription
                });
            }
        }
        return this;
    };

    utils.createGroupedContacts = function (converse) {
        /* Create grouped contacts
         */
        var i=0, j=0;
        _.each(_.keys(mock.groups), function (name) {
            j = i;
            for (i=j; i<j+mock.groups[name]; i++) {
                converse.roster.create({
                    jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'both',
                    ask: null,
                    groups: name === 'ungrouped'? [] : [name],
                    fullname: mock.cur_names[i]
                });
            }
        });
    };

    utils.createChatMessage = function (_converse, sender_jid, message) {
        return $msg({
                   from: sender_jid,
                   to: _converse.connection.jid,
                   type: 'chat',
                   id: (new Date()).getTime()
               })
               .c('body').t(message).up()
               .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
    }

    utils.sendMessage = function (chatboxview, message) {
        chatboxview.el.querySelector('.chat-textarea').value = message;
        chatboxview.keyPressed({
            target: chatboxview.el.querySelector('textarea.chat-textarea'),
            preventDefault: _.noop,
            keyCode: 13
        });
    };
    return utils;
}));

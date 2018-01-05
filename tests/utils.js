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

    utils.waitUntilFeatureSupportConfirmed = function (_converse, feature_name) {
        var IQ_disco, stanza;
        return utils.waitUntil(function () {
            IQ_disco = _.filter(_converse.connection.IQ_stanzas, function (iq) {
                return iq.nodeTree.querySelector('query[xmlns="http://jabber.org/protocol/disco#info"]');
            }).pop();
            return !_.isUndefined(IQ_disco);
        }, 300).then(function () {
            var info_IQ_id = IQ_disco.nodeTree.getAttribute('id');
            stanza = $iq({
                'type': 'result',
                'from': 'localhost',
                'to': 'dummy@localhost/resource',
                'id': info_IQ_id
            }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                .c('feature', {'var': feature_name});
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
            controlbox.querySelector(".close-chatbox-button").click();
        }
        return this;
    };

    utils.openContactsPanel = function (converse) {
        this.openControlBox(converse);
        var cbview = converse.chatboxviews.get('controlbox');
        cbview.el.querySelector('#controlbox-tabs li:first-child a').click();
    };

    utils.openRoomsPanel = function (converse) {
        utils.openControlBox();
        var cbview = converse.chatboxviews.get('controlbox');
        cbview.el.querySelector('#controlbox-tabs li:last-child a').click();
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

    utils.openChatRoom = function (_converse, room, server, nick) {
        // Opens a new chatroom
        this.openControlBox(_converse);
        this.openRoomsPanel(_converse);
        var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
        roomspanel.el.querySelector('input.new-chatroom-name').value = room;
        roomspanel.el.querySelector('input.new-chatroom-server').value = server;
        roomspanel.el.querySelector('form input[type="submit"]').click();
        this.closeControlBox(_converse);
    };

    utils.openAndEnterChatRoom = function (converse, room, server, nick) {
        return new Promise(function (resolve, reject) {
            sinon.spy(converse.connection, 'sendIQ');
            utils.openChatRoom(converse, room, server);
            var view = converse.chatboxviews.get((room+'@'+server).toLowerCase());

            // We pretend this is a new room, so no disco info is returned.
            var IQ_id = converse.connection.sendIQ.firstCall.returnValue;
            var features_stanza = $iq({
                    'from': room+'@'+server,
                    'id': IQ_id,
                    'to': nick+'@'+server+'/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            converse.connection._dataRecv(utils.createRequest(features_stanza));

            utils.waitUntil(function () {
                return converse.connection.sendIQ.secondCall;
            }).then(function () {
                // The XMPP server returns the reserved nick for this user.
                IQ_id = converse.connection.sendIQ.secondCall.returnValue;
                var stanza = $iq({
                    'type': 'result',
                    'id': IQ_id,
                    'from': view.model.get('jid'),
                    'to': converse.connection.jid 
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
                    .c('identity', {'category': 'conference', 'name': nick, 'type': 'text'});
                converse.connection._dataRecv(utils.createRequest(stanza));
                // The user has just entered the room (because join was called)
                // and receives their own presence from the server.
                // See example 24: http://xmpp.org/extensions/xep-0045.html#enter-pres
                var presence = $pres({
                        to: converse.connection.jid,
                        from: room+'@'+server+'/'+nick,
                        id: 'DC352437-C019-40EC-B590-AF29E879AF97'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: converse.bare_jid,
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'110'});
                converse.connection._dataRecv(utils.createRequest(presence));
                converse.connection.sendIQ.restore();
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

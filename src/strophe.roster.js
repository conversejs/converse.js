/*
  Copyright 2010, François de Metz <francois@2metz.fr>
*/
/**
 * Roster Plugin
 * Allow easily roster management
 *
 *  Features
 *  * Get roster from server
 *  * handle presence
 *  * handle roster iq
 *  * subscribe/unsubscribe
 *  * authorize/unauthorize
 *  * roster versioning (xep 237)
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([
            "strophe"
        ], function (Strophe) {
            factory(
                Strophe.Strophe,
                Strophe.$build,
                Strophe.$iq ,
                Strophe.$msg,
                Strophe.$pres
            );
            return Strophe;
        });
    } else {
        // Browser globals
        factory(
            root.Strophe,
            root.$build,
            root.$iq ,
            root.$msg,
            root.$pres
        );
    }
}(this, function (Strophe, $build, $iq, $msg, $pres) {

    Strophe.addConnectionPlugin('roster', {
        /** Function: init
        * Plugin init
        *
        * Parameters:
        *   (Strophe.Connection) conn - Strophe connection
        */
        init: function(conn) {
            this._connection = conn;
            this._callbacks = [];
            /** Property: items
            *  Roster items
            *  [
            *    {
            *        name         : "",
            *        jid          : "",
            *        subscription : "",
            *        ask          : "",
            *        groups       : ["", ""],
            *        resources    : {
            *            myresource : {
            *                show   : "",
            *                status : "",
            *                priority : ""
            *            }
            *        }
            *    }
            * ]
            */
            this.items = [];
            /** Property: ver
            * current roster revision
            * always null if server doesn't support xep 237
            */
            this.ver = null;
            // Override the connect and attach methods to always add presence and roster handlers.
            // They are removed when the connection disconnects, so must be added on connection.
            var oldCallback, roster = this, _connect = conn.connect, _attach = conn.attach;
            var newCallback = function(status) {
                if (status == Strophe.Status.ATTACHED || status == Strophe.Status.CONNECTED) {
                    try {
                        // Presence subscription
                        conn.addHandler(roster._onReceivePresence.bind(roster), null, 'presence', null, null, null);
                        conn.addHandler(roster._onReceiveIQ.bind(roster), Strophe.NS.ROSTER, 'iq', "set", null, null);
                    }
                    catch (e) {
                        Strophe.error(e);
                    }
                }
                if (typeof oldCallback === "function") {
                    oldCallback.apply(this, arguments);
                }
            };

            conn.connect = function(jid, pass, callback, wait, hold, route) {
                oldCallback = callback;
                if (typeof jid  == "undefined")
                    jid  = null;
                if (typeof pass == "undefined")
                    pass = null;
                callback = newCallback;
                _connect.apply(conn, [jid, pass, callback, wait, hold, route]);
            };

            conn.attach = function(jid, sid, rid, callback, wait, hold, wind) {
                oldCallback = callback;
                if (typeof jid == "undefined")
                    jid = null;
                if (typeof sid == "undefined")
                    sid = null;
                if (typeof rid == "undefined")
                    rid = null;
                callback = newCallback;
                _attach.apply(conn, [jid, sid, rid, callback, wait, hold, wind]);
            };

            Strophe.addNamespace('ROSTER_VER', 'urn:xmpp:features:rosterver');
            Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
        },

        /** Function: supportVersioning
        * return true if roster versioning is enabled on server
        */
        supportVersioning: function() {
            return (this._connection.features && this._connection.features.getElementsByTagName('ver').length > 0);
        },

        /** Function: get
        * Get Roster on server
        *
        * Parameters:
        *   (Function) userCallback - callback on roster result
        *   (String) ver - current rev of roster
        *      (only used if roster versioning is enabled)
        *   (Array) items - initial items of ver
        *      (only used if roster versioning is enabled)
        *     In browser context you can use sessionStorage
        *     to store your roster in json (JSON.stringify())
        */
        get: function(userCallback, ver, items) {
            var attrs = {xmlns: Strophe.NS.ROSTER};
            if (this.supportVersioning()) {
                // empty rev because i want an rev attribute in the result
                attrs.ver = ver || '';
                this.items = items || [];
            }
            var iq = $iq({type: 'get',  'id' : this._connection.getUniqueId('roster')}).c('query', attrs);
            return this._connection.sendIQ(iq,
                                    this._onReceiveRosterSuccess.bind(this, userCallback),
                                    this._onReceiveRosterError.bind(this, userCallback));
        },

        /** Function: registerCallback
        * register callback on roster (presence and iq)
        *
        * Parameters:
        *   (Function) call_back
        */
        registerCallback: function(call_back) {
            this._callbacks.push(call_back);
        },

        /** Function: findItem
        * Find item by JID
        *
        * Parameters:
        *     (String) jid
        */
        findItem : function(jid) {
            try {
                for (var i = 0; i < this.items.length; i++) {
                    if (this.items[i] && this.items[i].jid == jid) {
                        return this.items[i];
                    }
                }
            } catch (e) {
                Strophe.error(e);
            }
            return false;
        },

        /** Function: removeItem
        * Remove item by JID
        *
        * Parameters:
        *     (String) jid
        */
        removeItem : function(jid) {
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i] && this.items[i].jid == jid) {
                    this.items.splice(i, 1);
                    return true;
                }
            }
            return false;
        },

        /** Function: subscribe
        * Subscribe presence
        *
        * Parameters:
        *     (String) jid
        *     (String) message (optional)
        *     (String) nick  (optional)
        */
        subscribe: function(jid, message, nick) {
            var pres = $pres({to: jid, type: "subscribe"});
            if (message && message !== "") {
                pres.c("status").t(message).up();
            }
            if (nick && nick !== "") {
                pres.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();
            }
            this._connection.send(pres);
        },

        /** Function: unsubscribe
        * Unsubscribe presence
        *
        * Parameters:
        *     (String) jid
        *     (String) message
        */
        unsubscribe: function(jid, message) {
            var pres = $pres({to: jid, type: "unsubscribe"});
            if (message && message !== "")
                pres.c("status").t(message);
            this._connection.send(pres);
        },

        /** Function: authorize
        * Authorize presence subscription
        *
        * Parameters:
        *     (String) jid
        *     (String) message
        */
        authorize: function(jid, message) {
            var pres = $pres({to: jid, type: "subscribed"});
            if (message && message !== "")
                pres.c("status").t(message);
            this._connection.send(pres);
        },

        /** Function: unauthorize
        * Unauthorize presence subscription
        *
        * Parameters:
        *     (String) jid
        *     (String) message
        */
        unauthorize: function(jid, message) {
            var pres = $pres({to: jid, type: "unsubscribed"});
            if (message && message !== "")
                pres.c("status").t(message);
            this._connection.send(pres);
        },

        /** Function: add
        * Add roster item
        *
        * Parameters:
        *   (String) jid - item jid
        *   (String) name - name
        *   (Array) groups
        *   (Function) call_back
        */
        add: function(jid, name, groups, call_back) {
            var iq = $iq({type: 'set'}).c('query', {xmlns: Strophe.NS.ROSTER}).c('item', {jid: jid,
                                                                                        name: name});
            for (var i = 0; i < groups.length; i++) {
                iq.c('group').t(groups[i]).up();
            }
            this._connection.sendIQ(iq, call_back, call_back);
        },

        /** Function: update
        * Update roster item
        *
        * Parameters:
        *   (String) jid - item jid
        *   (String) name - name
        *   (Array) groups
        *   (Function) call_back
        */
        update: function(jid, name, groups, call_back) {
            var item = this.findItem(jid);
            if (!item) {
                throw "item not found";
            }
            var newName = name || item.name;
            var newGroups = groups || item.groups;
            var iq = $iq({type: 'set'}).c('query', {xmlns: Strophe.NS.ROSTER}).c('item', {jid: item.jid,
                                                                                        name: newName});
            for (var i = 0; i < newGroups.length; i++) {
                iq.c('group').t(newGroups[i]).up();
            }
            return this._connection.sendIQ(iq, call_back, call_back);
        },

        /** Function: remove
        * Remove roster item
        *
        * Parameters:
        *   (String) jid - item jid
        *   (Function) call_back
        */
        remove: function(jid, call_back) {
            var item = this.findItem(jid);
            if (!item) {
                throw "item not found";
            }
            var iq = $iq({type: 'set'}).c('query', {xmlns: Strophe.NS.ROSTER}).c('item', {jid: item.jid,
                                                                                        subscription: "remove"});
            this._connection.sendIQ(iq, call_back, call_back);
        },

        /** PrivateFunction: _onReceiveRosterSuccess
        *
        */
        _onReceiveRosterSuccess: function(userCallback, stanza) {
            this._updateItems(stanza);
            if (typeof userCallback === "function") {
                userCallback(this.items);
            }
        },

        /** PrivateFunction: _onReceiveRosterError
        *
        */
        _onReceiveRosterError: function(userCallback, stanza) {
            userCallback(this.items);
        },

        /** PrivateFunction: _onReceivePresence
        * Handle presence
        */
        _onReceivePresence : function(presence) {
            // TODO: from is optional
            var jid = presence.getAttribute('from');
            var from = Strophe.getBareJidFromJid(jid);
            var item = this.findItem(from);
            // not in roster
            if (!item) {
                return true;
            }
            var type = presence.getAttribute('type');
            if (type == 'unavailable') {
                delete item.resources[Strophe.getResourceFromJid(jid)];
            } else if (!type) {
                // TODO: add timestamp
                item.resources[Strophe.getResourceFromJid(jid)] = {
                    show     : (presence.getElementsByTagName('show').length !== 0) ? Strophe.getText(presence.getElementsByTagName('show')[0]) : "",
                    status   : (presence.getElementsByTagName('status').length !== 0) ? Strophe.getText(presence.getElementsByTagName('status')[0]) : "",
                    priority : (presence.getElementsByTagName('priority').length !== 0) ? Strophe.getText(presence.getElementsByTagName('priority')[0]) : ""
                };
            } else {
                // Stanza is not a presence notification. (It's probably a subscription type stanza.)
                return true;
            }
            this._call_backs(this.items, item);
            return true;
        },

        /** PrivateFunction: _call_backs
        *
        */
        _call_backs : function(items, item) {
            for (var i = 0; i < this._callbacks.length; i++) {
                this._callbacks[i](items, item);
            }
        },

        /** PrivateFunction: _onReceiveIQ
        * Handle roster push.
        */
        _onReceiveIQ : function(iq) {
            var id = iq.getAttribute('id');
            var from = iq.getAttribute('from');
            // Receiving client MUST ignore stanza unless it has no from or from = user's JID.
            if (from && from !== "" && from != this._connection.jid && from != Strophe.getBareJidFromJid(this._connection.jid))
                return true;
            var iqresult = $iq({type: 'result', id: id, from: this._connection.jid});
            this._connection.send(iqresult);
            this._updateItems(iq);
            return true;
        },
        /** PrivateFunction: _updateItems
        * Update items from iq
        */
        _updateItems : function(iq) {
            var query = iq.getElementsByTagName('query');
            if (query.length !== 0) {
                this.ver = query.item(0).getAttribute('ver');
                var self = this;
                Strophe.forEachChild(query.item(0), 'item',
                    function (item) {
                        self._updateItem(item);
                    }
            );
            }
            this._call_backs(this.items);
        },

        /** PrivateFunction: _updateItem
        * Update internal representation of roster item
        */
        _updateItem : function(item) {
            var jid           = item.getAttribute("jid");
            var name          = item.getAttribute("name");
            var subscription  = item.getAttribute("subscription");
            var ask           = item.getAttribute("ask");
            var groups        = [];
            Strophe.forEachChild(item, 'group',
                function(group) {
                    groups.push(Strophe.getText(group));
                }
            );

            if (subscription == "remove") {
                this.removeItem(jid);
                return;
            }

            item = this.findItem(jid);
            if (!item) { this.items.push({
                    name         : name,
                    jid          : jid,
                    subscription : subscription,
                    ask          : ask,
                    groups       : groups,
                    resources    : {}
                });
            } else {
                item.name = name;
                item.subscription = subscription;
                item.ask = ask;
                item.groups = groups;
            }
        }
    });
}));

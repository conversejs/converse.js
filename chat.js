var helpers = (function (helpers) {
    helpers.oc = function (a) {
        // Thanks to Jonathan Snook: http://snook.ca
        var o = {};
        for(var i=0; i<a.length; i++) {
            o[a[i]]='';
        }
        return o;
    };

    helpers.hash = function (str) {
        // FIXME
        if (str == 'online-users-container') {
            return str;
        }
        var shaobj = new jsSHA(str);
        return shaobj.getHash("HEX");
    };

    helpers.size = function (obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                size++;
            }
        }
        return size;
    };

    return helpers;
})(helpers || {});

var xmppchat = (function (jarnxmpp, $, console) {
    var ob = jarnxmpp;
    /* FIXME: XEP-0136 specifies 'urn:xmpp:archive' but the mod_archive_odbc 
    *  add-on for ejabberd wants the URL below. This might break for other
    *  Jabber servers.
    */
    ob.Collections = {
        'URI': 'http://www.xmpp.org/extensions/xep-0136.html#ns'
    };
    ob.Messages = jarnxmpp.Messages || {};
    ob.Presence = jarnxmpp.Presence || {};

    ob.isOwnUser = function (jid) {
        return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(xmppchat.connection.jid));
    };

    ob.ChatPartners = (function () {
        /* A mapping of bare JIDs to resources, to keep track of 
        *  how many resources we have per chat partner.
        */
        var storage = {};
        var methods = {};
        
        methods.add = function (bare_jid, resource) {
            if (Object.prototype.hasOwnProperty.call(storage, bare_jid)) {
                if (!(resource in helpers.oc(storage[bare_jid]))) {
                    storage[bare_jid].push(resource);
                }
            } else  {
                storage[bare_jid] = [resource];
            }
        };

        methods.remove = function (bare_jid, resource) {
            // Removes the resource for a user and returns the number of 
            // resources left over.
            if (Object.prototype.hasOwnProperty.call(storage, bare_jid)) {
                if (resource in helpers.oc(storage[bare_jid])) {
                    var idx = storage[bare_jid].indexOf(resource);
                    if (idx !== undefined) {
                        storage[bare_jid].splice(idx, 1);
                        if (storage[bare_jid].length === 0) {
                            delete storage[bare_jid];
                            return 0;
                        }
                        else {
                            return storage[bare_jid].length;
                        }
                    }
                }
            }
            return 0;
        };

        methods.removeAll = function (bare_jid) {
            if (Object.prototype.hasOwnProperty.call(storage, bare_jid)) {
                delete storage[bare_jid];
            }
        };

        methods.getTotal = function () {
            return helpers.size(storage);
        };

        return methods;
    })();

    ob.Messages.ClientStorage = (function () {
        methods = {};

        methods.addMessage = function (jid, msg, direction) {
            var bare_jid = Strophe.getBareJidFromJid(jid),
                now = new Date().toISOString(),
                msgs = store.get(bare_jid) || [];
            if (msgs.length >= 30) {
                msgs.shift();
            }
            msgs.push(now+' '+direction+' '+msg);
            store.set(bare_jid, msgs);
        };

        methods.getMessages = function (jid) {
            return store.get(jid) || [];
        };
        return methods;
    })();

    ob.Messages.getMessages = function (jid, callback) {
        var bare_jid = Strophe.getBareJidFromJid(jid),
            msgs = this.ClientStorage.getMessages(bare_jid);
        callback(msgs);
    };

    ob.Messages.sendMessage = function (jid, text, callback) {
        // TODO: Look in ChatPartners to see what resources we have for the recipient.
        // if we have one resource, we sent to only that resources, if we have multiple
        // we send to the bare jid.
        // FIXME: see if @@content-transform is required
        var message, 
            that = this;
        $.getJSON(portal_url + '/content-transform?', {text: text}, function (data) {
            message = $msg({to: jid, type: 'chat'})
                        .c('body').t(data.text).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'});
            xmppchat.connection.send(message);
            that.ClientStorage.addMessage(jid, data.text, 'to');
            callback();
        });
    };

    ob.Messages.messageReceived = function (message) {
        var jid = $(message).attr('from'),
            bare_jid = Strophe.getBareJidFromJid(jid),
            resource = Strophe.getResourceFromJid(jid),
            delayed = $(message).find('delay').length > 0,
            body = $(message).children('body').text(),
            event = jQuery.Event('jarnxmpp.message');

        if (body !== "") {
            var xhtml_body = $(message).find('html > body').contents();
            if (xhtml_body.length > 0) {
                event.mtype = 'xhtml';
                event.body = xhtml_body.html();
            } else {
                event.body = body;
                event.mtype = 'text';
            }
        }
        event.from = jid;
        event.delayed = delayed;
        event.message = message;
        ob.ChatPartners.add(bare_jid, resource);
        if (event.body) {
            ob.Messages.ClientStorage.addMessage(jid, event.body, 'from');
        }
        if ((xmppchat.Storage.get(xmppchat.username+'-xmpp-status') || 'online') !== 'offline') {
            // Only trigger the UI event if the user is not offline.
            $(document).trigger(event);
        }
        return true;
    };

    ob.Collections.getLastCollection = function (jid, callback) {
        var bare_jid = Strophe.getBareJidFromJid(jid),
            iq = $iq({'type':'get'})
                    .c('list', {'xmlns': this.URI,
                                'with': bare_jid
                                })
                    .c('set', {'xmlns': 'http://jabber.org/protocol/rsm'})
                    .c('before').up()
                    .c('max')
                    .t('1');

        xmppchat.connection.sendIQ(iq, 
                    callback,
                    function () { 
                        console.log('Error while retrieving collections'); 
                    });
    };

    ob.Collections.getLastMessages = function (jid, callback) {
        var that = this;
        this.getLastCollection(jid, function (result) {
            // Retrieve the last page of a collection (max 30 elements). 
            var $collection = $(result).find('chat'),
                jid = $collection.attr('with'),
                start = $collection.attr('start'),
                iq = $iq({'type':'get'})
                        .c('retrieve', {'start': start,
                                    'xmlns': that.URI,
                                    'with': jid
                                    })
                        .c('set', {'xmlns': 'http://jabber.org/protocol/rsm'})
                        .c('max')
                        .t('30');
            xmppchat.connection.sendIQ(iq, callback);
        });
    };

    ob.Presence.getOwnStatus = function () {
        return xmppchat.Storage.get(xmppchat.username+'-xmpp-status');
    };

    ob.Presence.onlineCount = function () {
        return xmppchat.ChatPartners.getTotal();
    };

    ob.Presence.sendPresence = function (type) {
        if (type === undefined) {
            type = this.getOwnStatus() || 'online';
        }
        xmppchat.connection.send($pres({'type':type}));
    };

    ob.Presence.presenceReceived = function (presence) {
        var jid = $(presence).attr('from'),
            bare_jid = Strophe.getBareJidFromJid(jid),
            resource = Strophe.getResourceFromJid(jid),
            ptype = $(presence).attr('type'),
            status = '';

        if (ptype === 'subscribe') {
            // User wants to subscribe to us. Always approve and
            // ask to subscribe to him
            xmppchat.Roster.authorize(bare_jid);
            xmppchat.Roster.subscribe(bare_jid);

        } else if (ptype === 'unsubscribe') {
            if (_.indexOf(xmppchat.Roster.getCachedJids(), bare_jid) != -1) {
                xmppchat.Roster.unauthorize(bare_jid);
                xmppchat.Roster.unsubscribe(bare_jid);
                $(document).trigger('jarnxmpp.presence', [jid, 'unsubscribe', presence]);
            }

        } else if (ptype === 'unsubscribed') {
            return;

        } else if (ptype !== 'error') { // Presence has changed
            if (ptype === 'unavailable') {
                status = 'unavailable';
            } else if (ptype === 'offline') {
                status = 'offline';
            } else if (ptype === 'busy') {
                status = 'busy';
            } else if (ptype === 'away') {
                status = 'away';
            } else {
                status = ($(presence).find('show').text() === '') ? 'online' : 'away';
            }

            if ((status !== 'offline')&&(status !== 'unavailable')) {
                xmppchat.ChatPartners.add(bare_jid, resource);
                $(document).trigger('jarnxmpp.presence', [jid, status, presence]);
            } else {
                if (xmppchat.ChatPartners.remove(bare_jid, resource) === 0) {
                    // Only notify offline/unavailable if there aren't any other resources for that user
                    $(document).trigger('jarnxmpp.presence', [jid, status, presence]);
                }
            }
        }
        return true;
    };

    ob.Taskbuffer = (function ($) {
        // Executes tasks one after another (i.e next task is started only when
        // the previous one has been completed).
        buffer = {};
        // Tasks must be objects with keys: 'that', 'method' and 'parameters'
        // 'that' the context for the method, while 'parameters' is the list of arguments 
        // passed to it.
        buffer.tasks = [];
        buffer.deferred = $.when();
        buffer.handleTasks = function () {
            var task;
            // If the current deferred task is resolved and there are more tasks
            if (buffer.deferred.isResolved() && buffer.tasks.length > 0) {
                // Get the next task in the queue and set the new deferred.
                task = buffer.tasks.shift();

                buffer.deferred = $.when(task.method.apply(task.that, task.parameters));

                if (buffer.tasks.length > 0) {
                    buffer.deferred.done(buffer.handleTasks);
                }
            }
        };
        return buffer;
    })(jQuery);

    return ob;
})(jarnxmpp || {}, jQuery, console || {log: function(){}});

xmppchat.Roster = (function (roster, jquery, console) {
    var contacts = {},
        ob = roster;

    _updateCache = function () {
        if (this.subscription === 'none') {
            delete contacts[this.jid];
        } else {
            contacts[this.jid] = this;
        }
    };

    _triggerEvent = function () {
        $(document).trigger('xmppchat.roster_updated');
    };

    ob._connection = xmppchat.connection;

    ob.update = function (items, item) {
        old_cache = ob.getCached();
        for (var i=0; i<items.length; i++) {
            if (items[i].subscription === 'none') {
                delete contacts[items[i].jid];
            } else {
                contacts[items[i].jid] = items[i];
            }
        }        
        console.log('update, size is: '+ _.size(contacts));
        if (!_.isEqual(old_cache, ob.getCached())) {
            console.log('triggering event');
            $(document).trigger('xmppchat.roster_updated');
        }
        
    };

    ob.getCached = function () {
        return _.values(contacts);
    };

    ob.getCachedJids = function () {
        return _.keys(contacts);
    };
    return ob;
});


// Event handlers
// --------------
$(document).ready(function () {
    $(document).unbind('jarnxmpp.connected');
    $(document).bind('jarnxmpp.connected', function () {
        // Logging
        xmppchat.connection.rawInput = xmppchat.rawInput;
        xmppchat.connection.rawOutput = xmppchat.rawOutput;
        // Messages
        xmppchat.connection.addHandler(xmppchat.Messages.messageReceived, null, 'message', 'chat');
        //Roster
        xmppchat.connection.addHandler(xmppchat.Roster.rosterResult, Strophe.NS.ROSTER, 'iq', 'result');
        xmppchat.connection.addHandler(xmppchat.Roster.rosterSuggestedItem, 'http://jabber.org/protocol/rosterx', 'message', null);
        // Presence
        xmppchat.connection.addHandler(xmppchat.Presence.presenceReceived, null, 'presence', null);

        xmppchat.UI.restoreOpenChats();

        xmppchat.Roster = xmppchat.Roster(Strophe._connectionPlugins.roster, $, console);
        xmppchat.Roster.registerCallback(xmppchat.Roster.update);
        xmppchat.Roster.get();
        xmppchat.Presence.sendPresence();
    });
});

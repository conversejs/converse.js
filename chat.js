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
    ob.Collections = {};
    ob.Messages = jarnxmpp.Messages || {};
    ob.Presence = jarnxmpp.Presence || {};

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
            if (Object.prototype.hasOwnProperty.call(storage, bare_jid)) {
                if (!(resource in helpers.oc(storage[bare_jid]))) {
                    var idx = storage[bare_jid].indexOf(resource);
                    if (idx !== undefined) {
                        storage[bare_jid].splice(idx, 1);
                    }
                }
            }
        };

        methods.getTotal = function () {
            return helpers.size(storage);
        };
        return methods;
    })();

    ob.Messages.sendMessage = function (recipient, text, callback) {
        // TODO: Look in ChatPartners to see what resources we have for the recipient.
        // if we have one resource, we sent to only that resources, if we have multiple
        // we send to the bare jid.
        var message;
        $.getJSON(portal_url + '/content-transform?', {text: text}, function (data) {
            message = $msg({to: recipient, type: 'chat'}).c('body').t(data.text);
            xmppchat.connection.send(message);
            callback();
        });
    };

    ob.Messages.messageReceived = function (message) {
        var jid = $(message).attr('from'),
            bare_jid = Strophe.getBareJidFromJid(jid),
            resource = Strophe.getResourceFromJid(jid),
            delayed = $(message).find('delay').length > 0;

        ob.ChatPartners.add(bare_jid, resource);

        var body = $(message).children('body').text();
        if (body === "") {
            // TODO:
            return true; // This is a typing notification, we do not handle it here...
        }
        var xhtml_body = $(message).find('html > body').contents(),
            event = jQuery.Event('jarnxmpp.message');

        event.from = jid;
        event.delayed = delayed;
        if (xhtml_body.length > 0) {
            event.mtype = 'xhtml';
            event.body = xhtml_body.html();
        } else {
            event.body = body;
            event.mtype = 'text';
        }
        $(document).trigger(event);
        return true;
    };

    ob.Collections.handleError = function (response) {
        console.log(response);
    };

    ob.Collections.handleCollectionRetrieval = function (response) {
        // Get the last collection.
        return false; 
    };

    ob.Collections.retrieveCollections = function () {
        /*
        * FIXME: XEP-0136 specifies 'urn:xmpp:archive' but the mod_archive_odbc 
        * add-on for ejabberd wants the URL below. This might break for other
        * Jabber servers.
        */
        var uri = 'http://www.xmpp.org/extensions/xep-0136.html#ns';
        var iq = $iq({'type':'get'})
                    .c('list', {'start': '1469-07-21T02:00:00Z',
                                'xmlns': uri
                                })
                    .c('set', {'xmlns': 'http://jabber.org/protocol/rsm'})
                    .c('max')
                    .t('30');
        xmppchat.connection.sendIQ(iq, this.handleCollectionRetrieval, this.handleError);
    };

    ob.Presence.onlineCount = function () {
        return xmppchat.ChatPartners.getTotal();
    };

    ob.Presence.sendPresence = function (type) {
        if (type === undefined) {
            type = xmppchat.Storage.get(xmppchat.username+'-xmpp-status') || 'online';
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
            jarnxmpp.connection.send($pres({to: jid, type: 'subscribed'}));
            jarnxmpp.connection.send($pres({to: jid, type: 'subscribe'}));
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

            if ((status !== 'offline')&&(status !== 'unavilable')) {
                xmppchat.ChatPartners.add(bare_jid, resource);
            } else {
                xmppchat.ChatPartners.remove(bare_jid, resource);
            }
            $(document).trigger('jarnxmpp.presence', [jid, status, presence]);
        }
        return true;
    };

    ob.Taskbuffer = (function ($) {
        buffer = {};
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



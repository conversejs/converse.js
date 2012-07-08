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
                if (_.indexOf(storage[bare_jid], resource) == -1) {
                    storage[bare_jid].push(resource);
                }
            } else  {
                storage[bare_jid] = [resource];
            }
        };

        methods.remove = function (bare_jid, resource) {
            // Removes the resource for a user and returns the number of 
            // resources left over.
            if (_.has(storage, bare_jid)) {
                var idx = _.indexOf(storage[bare_jid], resource);
                if (idx !== -1) {
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
            return 0;
        };

        methods.removeAll = function (bare_jid) {
            if (Object.prototype.hasOwnProperty.call(storage, bare_jid)) {
                delete storage[bare_jid];
            }
        };

        methods.getTotal = function () {
            return _.size(storage);
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

        if (ob.isOwnUser(bare_jid)) {
            return true;
        }

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


xmppchat.RosterItem = Backbone.Model.extend({
    /*
     *  RosterItem: {
     *      'status': String, 
     *      'subscription': String, 
     *      'resources': Array,
     *      'fullname': String 
     *   }
     */
    initialize: function (jid, subscription) {
        this.id = jid;
        this.subscription = subscription;

        this.fullname = '';
        this.resources = [];
        this.status = 'offline';
    }
});

xmppchat.RosterClass = (function (stropheRoster, _, $, console) {
    var contacts = {},
        ob = _.clone(stropheRoster);

    var Collection = Backbone.Collection.extend({
        model: xmppchat.RosterItem
    });
    var collection = new Collection();
    _.extend(ob, collection);
    _.extend(ob, Backbone.Events);
    stropheRoster._connection = xmppchat.connection;

    ob.comparator = function (rosteritem) {
        var status = rosteritem.get('status'),
            rank = 4;
        switch(status) {
            case 'offline': 
                rank = 4;
                break;
            case 'unavailable':
                rank = 3;
                break;
            case 'away':
                rank = 2;
                break;
            case 'busy':
                rank = 1;
                break;
            case 'online':
                rank = 0;
                break;
        }
        return rank;
    };

    ob.getRoster = function () {
        return stropheRoster.get();
    };

    ob.getItem = function (id) {
        return Backbone.Collection.prototype.get.call(this, id);
    };

    ob.addRosterItem = function (item) {
        var user_id = Strophe.getNodeFromJid(item.jid),
            model = new xmppchat.RosterItem(item.jid, item.subscription);
        ob.add(model);
        /*
        if (!item.name) {
            // TODO: I think after a user has been added to the roster,
            // his nickname needs to be calculated. This is only
            // feasible if the nickname is persisted. We cannot do this
            // if we have to redo this upon every page load.
            xmppchat.Presence.getUserInfo(user_id, function (data) {
                ob.update(item.jid, data.fullname, [], function () {
                    // TODO Store in the model item.
                    model.fullname = data.fullname;
                    ob.add(model);
                });
            });
        } else {
            ob.add(model);
        }*/
    };

    ob.updateHandler = function (items) {
        var model;
        for (var i=0; i<items.length; i++) {
            if (items[i].subscription === 'none') {
                model = ob.getItem(jid);
                ob.remove(model);
            } else {
                if (ob.getItem(items[i].jid)) {
                    // Update the model
                    model = ob.getItem(jid);
                    model.subscription = item.subscription;
                } else {
                    ob.addRosterItem(items[i]);
                }
            }
        }
    };
    /* 
    addResource: function (bare_jid, resource) {
    },

    removeResource: function (bare_jid, resource) {
    },

    removeAll: function (bare_jid) {
        // Remove all resources for bare_jid
    },

    getNumContacts: function () {
    },

    getJids: function () {
        return _.keys(storage);
    }*/
    return ob;
});


xmppchat.RosterItemView = Backbone.View.extend({
    tagName: 'li',
    render: function () {
        var item = this.model,
            jid = item.id,
            bare_jid = Strophe.getBareJidFromJid(jid),
            user_id = Strophe.getNodeFromJid(jid),
            fullname = (item.fullname) ? item.fullname : user_id;

        // FIXME: Here comes underscore templating
        this.el  = $('<li></li>').addClass(item.status).attr('id', 'online-users-'+user_id).attr('data-recipient', bare_jid);
        this.el.append($('<a title="Click to chat with this contact"></a>').addClass('user-details-toggle').text(fullname));
        this.el.append($('<a title="Click to remove this contact" href="#"></a>').addClass('remove-xmpp-contact'));
        return this;
    }
});


xmppchat.RosterViewClass = (function (roster, _, $, console) {
    ob = {};
    var View = Backbone.View.extend({
        tagName: 'ul',
        el: $('#xmpp-contacts'),
        model: roster,

        // XXX: See if you can use the "events:" thingy here instead of
        // manually registering the event subscribers below.

        render: function () {
            this.el.html($el.html());
            return this;
        }
    });
    var view = new View();
    _.extend(ob, view);

    // Event handlers
    roster.on("add", function (item) {
        console.log('roster add handler called');
        var view = new xmppchat.RosterItemView({
            model: item
        });
        $(ob.el).append(view.render().el);
    });

    roster.on("remove", function (msg) {
        console.log('roster remove handler called!!!!!');
        ob.render();
    });

    return ob;
});

// FIXME: Need to get some convention going for naming classes and instances of
// models and views.

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

        xmppchat.Roster = xmppchat.RosterClass(Strophe._connectionPlugins.roster, _, $, console);
        xmppchat.RosterView = Backbone.View.extend(xmppchat.RosterViewClass(xmppchat.Roster, _, $, console));
        
        xmppchat.Roster.registerCallback(xmppchat.Roster.updateHandler);
        xmppchat.Roster.getRoster();
        xmppchat.Presence.sendPresence();
    });
});

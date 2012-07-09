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


xmppchat.ChatBox = Backbone.Model.extend({

    hash: function (str) {
        var shaobj = new jsSHA(str);
        return shaobj.getHash("HEX");
    },

    initialize: function () {
        this.set({
            'user_id' : Strophe.getNodeFromJid(this.get('jid')),
            'chat_id' : this.hash(this.get('jid'))
        });
    }

});

xmppchat.ChatBoxView = Backbone.View.extend({

    tagName: 'div',
    className: 'chatbox',

    events: {
        'click .close-chatbox-button': 'closeChatBox'
    },

    closeChatBox: function () {
        var that = this;
        $('#'+this.model.get('chat_id')).hide('fast', function () {
            // TODO: that.removeChatFromCookie(jid);
            xmppchat.chatboxesview.reorderChatBoxes();
        });
    },

    initialize: function (){
        $('body').append($(this.el).hide());
    },

    template:   _.template('<div class="chat-head chat-head-chatbox">' +
                    '<div class="chat-title"> <%= user_id %> </div>' +
                    '<a href="javascript:void(0)" class="chatbox-button close-chatbox-button">X</a>' +
                    '<br clear="all"/>' +
                '</div>' +
                '<div class="chat-content"></div>' + 
                '<form class="sendXMPPMessage" action="" method="post">' +
                '<textarea ' +
                    'type="text" ' +
                    'class="chat-textarea" ' +
                    'placeholder="Personal message"/>'),

    render: function () {
        $(this.el).attr('id', this.model.get('chat_id'));
        $(this.el).html(this.template(this.model.toJSON()));
        return this;
    },

    isVisible: function () {
        return $(this.el).is(':visible');
    },

    focus: function () {
        $(this.el).find('.chat-textarea').focus();
        return this;
    },

    show: function (callback) {
        var that = this;
        $(this.el).show('fast', function () {
            that.focus();
        });
        return this;
    }
});

xmppchat.ChatBoxes = Backbone.Collection.extend({
});

xmppchat.ChatBoxesView = Backbone.View.extend({
    
    chatbox_width: 205,

    positionNewChatBox: function (view) {
        var open_chats = 0,
            offset;
        if ($('#online-users-container').is(':visible')) {
            open_chats++;
        }
        for (var i=0; i<this.model.models.length; i++) {
            if ($("#"+this.model.models[i].get('chat_id')).is(':visible')) {
                open_chats++;
            }
        }
        offset = (open_chats)*(this.chatbox_width+7)+15;
        $(view.el).css({'right': (offset+'px')});
    },

    reorderChatBoxes: function () {
        var index = 0,
            offset,
            $chat;

        if ($('#online-users-container').is(':visible')) {
            index = 1;
        }
        for (var i=0; i<this.model.models.length; i++) {
            $chat = $("#"+this.model.models[i].get('chat_id'));
            if ($chat.is(':visible')) {
                if (index === 0) {
                    $chat.animate({'right': '15px'});
                } 
                else {
                    offset = (index)*(this.chatbox_width+7)+15;
                    $chat.animate({'right': offset +'px'});
                }
                index++;
            }
        }
    },

    initialize: function () {
        this.views = {};

        this.options.model.on("add", function (item, x, y) {
            var view = new xmppchat.ChatBoxView({
                model: item
            });
            this.positionNewChatBox(view.render());
            this.views[item.get('jid')] = view.show();
        }, this);
    }
});


xmppchat.RosterItem = Backbone.Model.extend({

    initialize: function (jid, subscription) {
        // FIXME: the fullname is set to user_id for now...
        var user_id = Strophe.getNodeFromJid(jid);

        this.set({
            'id': jid,
            'jid': jid,
            'bare_jid': Strophe.getBareJidFromJid(jid),
            'user_id': user_id,
            'subscription': subscription,
            'fullname': user_id, 
            'resources': [],
            'status': 'offline'
        }, {'silent': true});
    }
});


xmppchat.RosterItemView = Backbone.View.extend({

    tagName: 'li',
    events: {
        'click': 'toggleChatBox'
    },

    toggleChatBox: function (e) {
        e.preventDefault();
        var jid = this.model.get('jid');
        if (!xmppchat.chatboxes.get(jid)) {
            chatbox = new xmppchat.ChatBox({'id': jid, 'jid': jid});
            xmppchat.chatboxes.add(chatbox);
        } else {
            var view = xmppchat.chatboxesview.views[jid];
            if (view) {
                if (view.isVisible()) {
                    view.focus();
                } else {
                    view.show();
                    xmppchat.chatboxesview.reorderChatBoxes();
                }
            }
        }
    },

    initialize: function () {
        var that = this;
        this.options.model.on('change', function (item, changed) {
            if (_.has(changed.changes, 'status')) {
                $(this.el).attr('class', item.changed.status);
            }
        }, this);
    },

    template:   _.template(
                    '<a title="Click to chat with this contact"><%= fullname %></a>' +
                    '<a title="Click to remove this contact" class="remove-xmpp-contact" href="#"></a>'),

    render: function () {
        var item = this.model;
        $(this.el).addClass(item.get('status')).attr('id', 'online-users-'+item.get('user_id'));
        $(this.el).html(this.template(item.toJSON()));
        return this;
    }
});


xmppchat.RosterClass = (function (stropheRoster, _, $, console) {
    var ob = _.clone(stropheRoster),
        Collection = Backbone.Collection.extend({
            model: xmppchat.RosterItem,
            stropheRoster: stropheRoster,

            initialize: function () {
                this.stropheRoster._connection = xmppchat.connection;
            },

            comparator : function (rosteritem) {
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
            },

            isSelf: function (jid) {
                return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(xmppchat.connection.jid));
            },

            getRoster: function () {
                return stropheRoster.get();
            },

            getItem: function (id) {
                return Backbone.Collection.prototype.get.call(this, id);
            },

            addRosterItem: function (jid, subscription) {
                var model = new xmppchat.RosterItem(jid, subscription);
                this.add(model);
            },
                
            addResource: function (bare_jid, resource) {
                var item = this.getItem(bare_jid);
                    resources;
                if (item) {
                    resources = item.get('resources');
                    if (_.indexOf(resources, resource) == -1) {
                        resources.push(resource);
                        item.set({'resources': resources});
                    }
                } else  {
                    item.set({'resources': [resource]});
                }
            },

            removeResource: function (bare_jid, resource) {
                var item = this.getItem(bare_jid),
                    resources,
                    idx;
                if (item) {
                    resources = item.get('resources');
                    idx = _.indexOf(resources, resource);
                    if (idx !== -1) {
                        resources.splice(idx, 1);
                        item.set({'resources': resources});
                        return resources.length;
                    }
                }
                return 0;
            },

            clearResources: function (bare_jid) {
                var item = this.getItem(bare_jid);
                if (item) {
                    item.set({'resources': []});
                }
            },

            getTotalResources: function (bare_jid) {
                var item = this.getItem(bare_jid);
                if (item) {
                    return _.size(item.get('resources'));
                }
            }
        });

    var collection = new Collection();
    _.extend(ob, collection);
    _.extend(ob, Backbone.Events);

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
                    ob.addRosterItem(items[i].jid, items[i].subscription);
                }
            }
        }
    };

    ob.presenceHandler = function (presence) {
        var jid = $(presence).attr('from'),
            bare_jid = Strophe.getBareJidFromJid(jid),
            resource = Strophe.getResourceFromJid(jid),
            ptype = $(presence).attr('type'),
            status = '';

        if (ob.isSelf(bare_jid)) { return true; }

        if (ptype === 'subscribe') {
            // FIXME: User wants to subscribe to us. Always approve and
            // ask to subscribe to him
            stropheRoster.authorize(bare_jid);
            stropheRoster.subscribe(bare_jid);

        } else if (ptype === 'unsubscribe') {
            if (_.indexOf(xmppchat.Roster.getCachedJids(), bare_jid) != -1) {
                stropheRoster.unauthorize(bare_jid);
                stropheRoster.unsubscribe(bare_jid);
            }

        } else if (ptype === 'unsubscribed') {
            return;

        } else if (ptype !== 'error') { // Presence has changed
            if (_.indexOf(['unavailable', 'offline', 'busy', 'away'], ptype) != -1) {
                status = ptype;
            } else {
                status = ($(presence).find('show').text() === '') ? 'online' : 'away';
            }
            if ((status !== 'offline')&&(status !== 'unavailable')) {
                ob.addResource(bare_jid, resource);
                model = ob.getItem(bare_jid);
                model.set({'status': status});
            } else {
                if (ob.removeResource(bare_jid, resource) === 0) {
                    model = ob.getItem(bare_jid);
                    model.set({'status': status});
                }
            }
        }
        return true;
    };
    return ob;
});


xmppchat.RosterView= (function (roster, _, $, console) {
    var View = Backbone.View.extend({
        el: $('#xmpp-contacts'),
        model: roster,
        rosteritemviews: [],

        initialize: function () {
            this.model.on("add", function (item) {
                $(this.el).append((new xmppchat.RosterItemView({model: item})).render().el);
            }, this);

            this.model.on('change', function (item) {
                this.render();
            }, this);

            this.model.on("remove", function (msg) {
                console.log('roster remove handler called!!!!!');
            });
        },

        render: function () {
            var models = this.model.sort().models,
                children = $(this.el).children(),
                that = this;

            $(models).each(function (idx, model) {
                var user_id = Strophe.getNodeFromJid(model.id);
                $(that.el).append(children.filter('#online-users-'+user_id));
            });
        }
    });
    var view = new View();
    return view;
});

// FIXME: Need to get some convention going for naming classes and instances of
// models and views.

// Event handlers
// --------------
$(document).ready(function () {
    $(document).unbind('jarnxmpp.connected');
    $(document).bind('jarnxmpp.connected', function () {
        // Messages
        xmppchat.connection.addHandler(xmppchat.Messages.messageReceived, null, 'message', 'chat');
        xmppchat.UI.restoreOpenChats();

        xmppchat.Roster = xmppchat.RosterClass(Strophe._connectionPlugins.roster, _, $, console);
        xmppchat.rosterview = Backbone.View.extend(xmppchat.RosterView(xmppchat.Roster, _, $, console));

        xmppchat.connection.addHandler(xmppchat.Roster.presenceHandler, null, 'presence', null);
        
        xmppchat.Roster.registerCallback(xmppchat.Roster.updateHandler);
        xmppchat.Roster.getRoster();
        xmppchat.Presence.sendPresence();

        xmppchat.chatboxes = new xmppchat.ChatBoxes();
        
        xmppchat.chatboxesview = new xmppchat.ChatBoxesView({
            'model': xmppchat.chatboxes
        });
    });
});

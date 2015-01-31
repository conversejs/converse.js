/*
 *Plugin to implement the MUC extension.
   http://xmpp.org/extensions/xep-0045.html
 *Previous Author:
    Nathan Zorn <nathan.zorn@gmail.com>
 *Complete CoffeeScript rewrite:
    Andreas Guth <guth@dbis.rwth-aachen.de>
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([
            "strophe-full"
        ], function (Strophe) {
            factory(
                Strophe.Strophe,
                Strophe.$build,
                Strophe.$iq ,
                Strophe.$msg,
                Strophe.$pres
            );
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

  var Occupant, RoomConfig, XmppRoom,
    __hasProp = {}.hasOwnProperty,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Strophe.addConnectionPlugin('muc', {
    _connection: null,
    rooms: {},
    roomNames: [],

    /*Function
    Initialize the MUC plugin. Sets the correct connection object and
    extends the namesace.
     */
    init: function(conn) {
      this._connection = conn;
      this._muc_handler = null;
      Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
      Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
      Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");
      Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
      return Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    },

    /*Function
    Join a multi-user chat room
    Parameters:
    (String) room - The multi-user chat room to join.
    (String) nick - The nickname to use in the chat room. Optional
    (Function) msg_handler_cb - The function call to handle messages from the
    specified chat room.
    (Function) pres_handler_cb - The function call back to handle presence
    in the chat room.
    (Function) roster_cb - The function call to handle roster info in the chat room
    (String) password - The optional password to use. (password protected
    rooms only)
    (Object) history_attrs - Optional attributes for retrieving history
    (XML DOM Element) extended_presence - Optional XML for extending presence
     */
    join: function(room, nick, msg_handler_cb, pres_handler_cb, roster_cb, password, history_attrs) {
      var msg, room_nick;
      room_nick = this.test_append_nick(room, nick);
      msg = $pres({
        from: this._connection.jid,
        to: room_nick
      }).c("x", {
        xmlns: Strophe.NS.MUC
      });
      if (history_attrs !== null) {
        msg = msg.c("history", history_attrs).up();
      }
      if (password !== null) {
        msg.cnode(Strophe.xmlElement("password", [], password));
      }
      if (typeof extended_presence !== "undefined" && extended_presence !== null) {
        msg.up.cnode(extended_presence);
      }
      if (this._muc_handler === null) {
        this._muc_handler = this._connection.addHandler((function(_this) {
          return function(stanza) {
            var from, handler, handlers, id, roomname, x, xmlns, xquery, _i, _len;
            from = stanza.getAttribute('from');
            if (!from) {
              return true;
            }
            roomname = from.split("/")[0];
            if (!_this.rooms[roomname]) {
              return true;
            }
            room = _this.rooms[roomname];
            handlers = {};
            if (stanza.nodeName === "message") {
              handlers = room._message_handlers;
            } else if (stanza.nodeName === "presence") {
              xquery = stanza.getElementsByTagName("x");
              if (xquery.length > 0) {
                for (_i = 0, _len = xquery.length; _i < _len; _i++) {
                  x = xquery[_i];
                  xmlns = x.getAttribute("xmlns");
                  if (xmlns && xmlns.match(Strophe.NS.MUC)) {
                    handlers = room._presence_handlers;
                    break;
                  }
                }
              }
            }
            for (id in handlers) {
              handler = handlers[id];
              if (!handler(stanza, room)) {
                delete handlers[id];
              }
            }
            return true;
          };
        })(this));
      }
      if (!this.rooms.hasOwnProperty(room)) {
        this.rooms[room] = new XmppRoom(this, room, nick, password);
        this.roomNames.push(room);
      }
      if (pres_handler_cb) {
        this.rooms[room].addHandler('presence', pres_handler_cb);
      }
      if (msg_handler_cb) {
        this.rooms[room].addHandler('message', msg_handler_cb);
      }
      if (roster_cb) {
        this.rooms[room].addHandler('roster', roster_cb);
      }
      return this._connection.send(msg);
    },

    /*Function
    Leave a multi-user chat room
    Parameters:
    (String) room - The multi-user chat room to leave.
    (String) nick - The nick name used in the room.
    (Function) handler_cb - Optional function to handle the successful leave.
    (String) exit_msg - optional exit message.
    Returns:
    iqid - The unique id for the room leave.
     */
    leave: function(room, nick, handler_cb, exit_msg) {
      var id, presence, presenceid, room_nick;
      id = this.roomNames.indexOf(room);
      delete this.rooms[room];
      if (id >= 0) {
        this.roomNames.splice(id, 1);
        if (this.roomNames.length === 0) {
          this._connection.deleteHandler(this._muc_handler);
          this._muc_handler = null;
        }
      }
      room_nick = this.test_append_nick(room, nick);
      presenceid = this._connection.getUniqueId();
      presence = $pres({
        type: "unavailable",
        id: presenceid,
        from: this._connection.jid,
        to: room_nick
      });
      if (exit_msg !== null) {
        presence.c("status", exit_msg);
      }
      if (handler_cb !== null) {
        this._connection.addHandler(handler_cb, null, "presence", null, presenceid);
      }
      this._connection.send(presence);
      return presenceid;
    },

    /*Function
    Parameters:
    (String) room - The multi-user chat room name.
    (String) nick - The nick name used in the chat room.
    (String) message - The plaintext message to send to the room.
    (String) html_message - The message to send to the room with html markup.
    (String) type - "groupchat" for group chat messages o
                    "chat" for private chat messages
    Returns:
    msgiq - the unique id used to send the message
     */
    message: function(room, nick, message, html_message, type, msgid) {
      var msg, parent, room_nick;
      room_nick = this.test_append_nick(room, nick);
      type = type || (nick !== null ? "chat" : "groupchat");
      msgid = msgid || this._connection.getUniqueId();
      msg = $msg({
        to: room_nick,
        from: this._connection.jid,
        type: type,
        id: msgid
      }).c("body").t(message);
      msg.up();
      if (html_message !== null) {
        msg.c("html", {
          xmlns: Strophe.NS.XHTML_IM
        }).c("body", {
          xmlns: Strophe.NS.XHTML
        }).h(html_message);
        if (msg.node.childNodes.length === 0) {
          parent = msg.node.parentNode;
          msg.up().up();
          msg.node.removeChild(parent);
        } else {
          msg.up().up();
        }
      }
      msg.c("x", {
        xmlns: "jabber:x:event"
      }).c("composing");
      this._connection.send(msg);
      return msgid;
    },

    /*Function
    Convenience Function to send a Message to all Occupants
    Parameters:
    (String) room - The multi-user chat room name.
    (String) message - The plaintext message to send to the room.
    (String) html_message - The message to send to the room with html markup.
    (String) msgid - Optional unique ID which will be set as the 'id' attribute of the stanza
    Returns:
    msgiq - the unique id used to send the message
     */
    groupchat: function(room, message, html_message, msgid) {
      return this.message(room, null, message, html_message, void 0, msgid);
    },

    /*Function
    Send a mediated invitation.
    Parameters:
    (String) room - The multi-user chat room name.
    (String) receiver - The invitation's receiver.
    (String) reason - Optional reason for joining the room.
    Returns:
    msgiq - the unique id used to send the invitation
     */
    invite: function(room, receiver, reason) {
      var invitation, msgid;
      msgid = this._connection.getUniqueId();
      invitation = $msg({
        from: this._connection.jid,
        to: room,
        id: msgid
      }).c('x', {
        xmlns: Strophe.NS.MUC_USER
      }).c('invite', {
        to: receiver
      });
      if (reason !== null) {
        invitation.c('reason', reason);
      }
      this._connection.send(invitation);
      return msgid;
    },

    /*Function
    Send a mediated multiple invitation.
    Parameters:
    (String) room - The multi-user chat room name.
    (Array) receivers - The invitation's receivers.
    (String) reason - Optional reason for joining the room.
    Returns:
    msgiq - the unique id used to send the invitation
     */
    multipleInvites: function(room, receivers, reason) {
      var invitation, msgid, receiver, _i, _len;
      msgid = this._connection.getUniqueId();
      invitation = $msg({
        from: this._connection.jid,
        to: room,
        id: msgid
      }).c('x', {
        xmlns: Strophe.NS.MUC_USER
      });
      for (_i = 0, _len = receivers.length; _i < _len; _i++) {
        receiver = receivers[_i];
        invitation.c('invite', {
          to: receiver
        });
        if (reason !== null) {
          invitation.c('reason', reason);
          invitation.up();
        }
        invitation.up();
      }
      this._connection.send(invitation);
      return msgid;
    },

    /*Function
    Send a direct invitation.
    Parameters:
    (String) room - The multi-user chat room name.
    (String) receiver - The invitation's receiver.
    (String) reason - Optional reason for joining the room.
    (String) password - Optional password for the room.
    Returns:
    msgiq - the unique id used to send the invitation
     */
    directInvite: function(room, receiver, reason, password) {
      var attrs, invitation, msgid;
      msgid = this._connection.getUniqueId();
      attrs = {
        xmlns: 'jabber:x:conference',
        jid: room
      };
      if (reason !== null) {
        attrs.reason = reason;
      }
      if (password !== null) {
        attrs.password = password;
      }
      invitation = $msg({
        from: this._connection.jid,
        to: receiver,
        id: msgid
      }).c('x', attrs);
      this._connection.send(invitation);
      return msgid;
    },

    /*Function
    Queries a room for a list of occupants
    (String) room - The multi-user chat room name.
    (Function) success_cb - Optional function to handle the info.
    (Function) error_cb - Optional function to handle an error.
    Returns:
    id - the unique id used to send the info request
     */
    queryOccupants: function(room, success_cb, error_cb) {
      var attrs, info;
      attrs = {
        xmlns: Strophe.NS.DISCO_ITEMS
      };
      info = $iq({
        from: this._connection.jid,
        to: room,
        type: 'get'
      }).c('query', attrs);
      return this._connection.sendIQ(info, success_cb, error_cb);
    },

    /*Function
    Start a room configuration.
    Parameters:
    (String) room - The multi-user chat room name.
    (Function) handler_cb - Optional function to handle the config form.
    Returns:
    id - the unique id used to send the configuration request
     */
    configure: function(room, handler_cb, error_cb) {
      var config, stanza;
      config = $iq({
        to: room,
        type: "get"
      }).c("query", {
        xmlns: Strophe.NS.MUC_OWNER
      });
      stanza = config.tree();
      return this._connection.sendIQ(stanza, handler_cb, error_cb);
    },

    /*Function
    Cancel the room configuration
    Parameters:
    (String) room - The multi-user chat room name.
    Returns:
    id - the unique id used to cancel the configuration.
     */
    cancelConfigure: function(room) {
      var config, stanza;
      config = $iq({
        to: room,
        type: "set"
      }).c("query", {
        xmlns: Strophe.NS.MUC_OWNER
      }).c("x", {
        xmlns: "jabber:x:data",
        type: "cancel"
      });
      stanza = config.tree();
      return this._connection.sendIQ(stanza);
    },

    /*Function
    Save a room configuration.
    Parameters:
    (String) room - The multi-user chat room name.
    (Array) config- Form Object or an array of form elements used to configure the room.
    Returns:
    id - the unique id used to save the configuration.
     */
    saveConfiguration: function(room, config, success_cb, error_cb) {
      var conf, iq, stanza, _i, _len;
      iq = $iq({
        to: room,
        type: "set"
      }).c("query", {
        xmlns: Strophe.NS.MUC_OWNER
      });
      if (typeof Form !== "undefined" && config instanceof Form) {
        config.type = "submit";
        iq.cnode(config.toXML());
      } else {
        iq.c("x", {
          xmlns: "jabber:x:data",
          type: "submit"
        });
        for (_i = 0, _len = config.length; _i < _len; _i++) {
          conf = config[_i];
          iq.cnode(conf).up();
        }
      }
      stanza = iq.tree();
      return this._connection.sendIQ(stanza, success_cb, error_cb);
    },

    /*Function
    Parameters:
    (String) room - The multi-user chat room name.
    Returns:
    id - the unique id used to create the chat room.
     */
    createInstantRoom: function(room, success_cb, error_cb) {
      var roomiq;
      roomiq = $iq({
        to: room,
        type: "set"
      }).c("query", {
        xmlns: Strophe.NS.MUC_OWNER
      }).c("x", {
        xmlns: "jabber:x:data",
        type: "submit"
      });
      return this._connection.sendIQ(roomiq.tree(), success_cb, error_cb);
    },

    /*Function
    Parameters:
    (String) room - The multi-user chat room name.
    (Object) config - the configuration. ex: {"muc#roomconfig_publicroom": "0", "muc#roomconfig_persistentroom": "1"}
    Returns:
    id - the unique id used to create the chat room.
     */
    createConfiguredRoom: function(room, config, success_cb, error_cb) {
      var k, roomiq, v;
      roomiq = $iq({
        to: room,
        type: "set"
      }).c("query", {
        xmlns: Strophe.NS.MUC_OWNER
      }).c("x", {
        xmlns: "jabber:x:data",
        type: "submit"
      });
      roomiq.c('field', {
        'var': 'FORM_TYPE'
      }).c('value').t('http://jabber.org/protocol/muc#roomconfig').up().up();
      for (k in config) {
        if (!__hasProp.call(config, k)) continue;
        v = config[k];
        roomiq.c('field', {
          'var': k
        }).c('value').t(v).up().up();
      }
      return this._connection.sendIQ(roomiq.tree(), success_cb, error_cb);
    },

    /*Function
    Set the topic of the chat room.
    Parameters:
    (String) room - The multi-user chat room name.
    (String) topic - Topic message.
     */
    setTopic: function(room, topic) {
      var msg;
      msg = $msg({
        to: room,
        from: this._connection.jid,
        type: "groupchat"
      }).c("subject", {
        xmlns: "jabber:client"
      }).t(topic);
      return this._connection.send(msg.tree());
    },

    /*Function
    Internal Function that Changes the role or affiliation of a member
    of a MUC room. This function is used by modifyRole and modifyAffiliation.
    The modification can only be done by a room moderator. An error will be
    returned if the user doesn't have permission.
    Parameters:
    (String) room - The multi-user chat room name.
    (Object) item - Object with nick and role or jid and affiliation attribute
    (String) reason - Optional reason for the change.
    (Function) handler_cb - Optional callback for success
    (Function) error_cb - Optional callback for error
    Returns:
    iq - the id of the mode change request.
     */
    _modifyPrivilege: function(room, item, reason, handler_cb, error_cb) {
      var iq;
      iq = $iq({
        to: room,
        type: "set"
      }).c("query", {
        xmlns: Strophe.NS.MUC_ADMIN
      }).cnode(item.node);
      if (reason !== null) {
        iq.c("reason", reason);
      }
      return this._connection.sendIQ(iq.tree(), handler_cb, error_cb);
    },

    /*Function
    Changes the role of a member of a MUC room.
    The modification can only be done by a room moderator. An error will be
    returned if the user doesn't have permission.
    Parameters:
    (String) room - The multi-user chat room name.
    (String) nick - The nick name of the user to modify.
    (String) role - The new role of the user.
    (String) affiliation - The new affiliation of the user.
    (String) reason - Optional reason for the change.
    (Function) handler_cb - Optional callback for success
    (Function) error_cb - Optional callback for error
    Returns:
    iq - the id of the mode change request.
     */
    modifyRole: function(room, nick, role, reason, handler_cb, error_cb) {
      var item;
      item = $build("item", {
        nick: nick,
        role: role
      });
      return this._modifyPrivilege(room, item, reason, handler_cb, error_cb);
    },
    kick: function(room, nick, reason, handler_cb, error_cb) {
      return this.modifyRole(room, nick, 'none', reason, handler_cb, error_cb);
    },
    voice: function(room, nick, reason, handler_cb, error_cb) {
      return this.modifyRole(room, nick, 'participant', reason, handler_cb, error_cb);
    },
    mute: function(room, nick, reason, handler_cb, error_cb) {
      return this.modifyRole(room, nick, 'visitor', reason, handler_cb, error_cb);
    },
    op: function(room, nick, reason, handler_cb, error_cb) {
      return this.modifyRole(room, nick, 'moderator', reason, handler_cb, error_cb);
    },
    deop: function(room, nick, reason, handler_cb, error_cb) {
      return this.modifyRole(room, nick, 'participant', reason, handler_cb, error_cb);
    },

    /*Function
    Changes the affiliation of a member of a MUC room.
    The modification can only be done by a room moderator. An error will be
    returned if the user doesn't have permission.
    Parameters:
    (String) room - The multi-user chat room name.
    (String) jid  - The jid of the user to modify.
    (String) affiliation - The new affiliation of the user.
    (String) reason - Optional reason for the change.
    (Function) handler_cb - Optional callback for success
    (Function) error_cb - Optional callback for error
    Returns:
    iq - the id of the mode change request.
     */
    modifyAffiliation: function(room, jid, affiliation, reason, handler_cb, error_cb) {
      var item;
      item = $build("item", {
        jid: jid,
        affiliation: affiliation
      });
      return this._modifyPrivilege(room, item, reason, handler_cb, error_cb);
    },
    ban: function(room, jid, reason, handler_cb, error_cb) {
      return this.modifyAffiliation(room, jid, 'outcast', reason, handler_cb, error_cb);
    },
    member: function(room, jid, reason, handler_cb, error_cb) {
      return this.modifyAffiliation(room, jid, 'member', reason, handler_cb, error_cb);
    },
    revoke: function(room, jid, reason, handler_cb, error_cb) {
      return this.modifyAffiliation(room, jid, 'none', reason, handler_cb, error_cb);
    },
    owner: function(room, jid, reason, handler_cb, error_cb) {
      return this.modifyAffiliation(room, jid, 'owner', reason, handler_cb, error_cb);
    },
    admin: function(room, jid, reason, handler_cb, error_cb) {
      return this.modifyAffiliation(room, jid, 'admin', reason, handler_cb, error_cb);
    },

    /*Function
    Change the current users nick name.
    Parameters:
    (String) room - The multi-user chat room name.
    (String) user - The new nick name.
     */
    changeNick: function(room, user) {
      var presence, room_nick;
      room_nick = this.test_append_nick(room, user);
      presence = $pres({
        from: this._connection.jid,
        to: room_nick,
        id: this._connection.getUniqueId()
      });
      return this._connection.send(presence.tree());
    },

    /*Function
    Change the current users status.
    Parameters:
    (String) room - The multi-user chat room name.
    (String) user - The current nick.
    (String) show - The new show-text.
    (String) status - The new status-text.
     */
    setStatus: function(room, user, show, status) {
      var presence, room_nick;
      room_nick = this.test_append_nick(room, user);
      presence = $pres({
        from: this._connection.jid,
        to: room_nick
      });
      if (show !== null) {
        presence.c('show', show).up();
      }
      if (status !== null) {
        presence.c('status', status);
      }
      return this._connection.send(presence.tree());
    },

    /*Function
    Registering with a room.
    @see http://xmpp.org/extensions/xep-0045.html#register
    Parameters:
    (String) room - The multi-user chat room name.
    (Function) handle_cb - Function to call for room list return.
    (Function) error_cb - Function to call on error.
     */
    registrationRequest: function(room, handle_cb, error_cb) {
      var iq;
      iq = $iq({
        to: room,
        from: this._connection.jid,
        type: "get"
      }).c("query", {
        xmlns: Strophe.NS.MUC_REGISTER
      });
      return this._connection.sendIQ(iq, function(stanza) {
        var $field, $fields, field, fields, length, _i, _len;
        $fields = stanza.getElementsByTagName('field');
        length = $fields.length;
        fields = {
          required: [],
          optional: []
        };
        for (_i = 0, _len = $fields.length; _i < _len; _i++) {
          $field = $fields[_i];
          field = {
            "var": $field.getAttribute('var'),
            label: $field.getAttribute('label'),
            type: $field.getAttribute('type')
          };
          if ($field.getElementsByTagName('required').length > 0) {
            fields.required.push(field);
          } else {
            fields.optional.push(field);
          }
        }
        return handle_cb(fields);
      }, error_cb);
    },

    /*Function
    Submits registration form.
    Parameters:
    (String) room - The multi-user chat room name.
    (Function) handle_cb - Function to call for room list return.
    (Function) error_cb - Function to call on error.
     */
    submitRegistrationForm: function(room, fields, handle_cb, error_cb) {
      var iq, key, val;
      iq = $iq({
        to: room,
        type: "set"
      }).c("query", {
        xmlns: Strophe.NS.MUC_REGISTER
      });
      iq.c("x", {
        xmlns: "jabber:x:data",
        type: "submit"
      });
      iq.c('field', {
        'var': 'FORM_TYPE'
      }).c('value').t('http://jabber.org/protocol/muc#register').up().up();
      for (key in fields) {
        val = fields[key];
        iq.c('field', {
          'var': key
        }).c('value').t(val).up().up();
      }
      return this._connection.sendIQ(iq, handle_cb, error_cb);
    },

    /*Function
    List all chat room available on a server.
    Parameters:
    (String) server - name of chat server.
    (String) handle_cb - Function to call for room list return.
    (String) error_cb - Function to call on error.
     */
    listRooms: function(server, handle_cb, error_cb) {
      var iq;
      iq = $iq({
        to: server,
        from: this._connection.jid,
        type: "get"
      }).c("query", {
        xmlns: Strophe.NS.DISCO_ITEMS
      });
      return this._connection.sendIQ(iq, handle_cb, error_cb);
    },
    test_append_nick: function(room, nick) {
      var domain, node;
      node = Strophe.escapeNode(Strophe.getNodeFromJid(room));
      domain = Strophe.getDomainFromJid(room);
      return node + "@" + domain + (nick !== null ? "/" + nick : "");
    }
  });

  XmppRoom = (function() {
    function XmppRoom(client, name, nick, password) {
      this.client = client;
      this.name = name;
      this.nick = nick;
      this.password = password;
      this._roomRosterHandler = __bind(this._roomRosterHandler, this);
      this._addOccupant = __bind(this._addOccupant, this);
      this.roster = {};
      this._message_handlers = {};
      this._presence_handlers = {};
      this._roster_handlers = {};
      this._handler_ids = 0;
      if (client.muc) {
        this.client = client.muc;
      }
      this.name = Strophe.getBareJidFromJid(name);
      this.addHandler('presence', this._roomRosterHandler);
    }

    XmppRoom.prototype.join = function(msg_handler_cb, pres_handler_cb, roster_cb) {
      return this.client.join(this.name, this.nick, msg_handler_cb, pres_handler_cb, roster_cb, this.password);
    };

    XmppRoom.prototype.leave = function(handler_cb, message) {
      this.client.leave(this.name, this.nick, handler_cb, message);
      return delete this.client.rooms[this.name];
    };

    XmppRoom.prototype.message = function(nick, message, html_message, type) {
      return this.client.message(this.name, nick, message, html_message, type);
    };

    XmppRoom.prototype.groupchat = function(message, html_message) {
      return this.client.groupchat(this.name, message, html_message);
    };

    XmppRoom.prototype.invite = function(receiver, reason) {
      return this.client.invite(this.name, receiver, reason);
    };

    XmppRoom.prototype.multipleInvites = function(receivers, reason) {
      return this.client.invite(this.name, receivers, reason);
    };

    XmppRoom.prototype.directInvite = function(receiver, reason) {
      return this.client.directInvite(this.name, receiver, reason, this.password);
    };

    XmppRoom.prototype.configure = function(handler_cb) {
      return this.client.configure(this.name, handler_cb);
    };

    XmppRoom.prototype.cancelConfigure = function() {
      return this.client.cancelConfigure(this.name);
    };

    XmppRoom.prototype.saveConfiguration = function(config) {
      return this.client.saveConfiguration(this.name, config);
    };

    XmppRoom.prototype.queryOccupants = function(success_cb, error_cb) {
      return this.client.queryOccupants(this.name, success_cb, error_cb);
    };

    XmppRoom.prototype.setTopic = function(topic) {
      return this.client.setTopic(this.name, topic);
    };

    XmppRoom.prototype.modifyRole = function(nick, role, reason, success_cb, error_cb) {
      return this.client.modifyRole(this.name, nick, role, reason, success_cb, error_cb);
    };

    XmppRoom.prototype.kick = function(nick, reason, handler_cb, error_cb) {
      return this.client.kick(this.name, nick, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.voice = function(nick, reason, handler_cb, error_cb) {
      return this.client.voice(this.name, nick, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.mute = function(nick, reason, handler_cb, error_cb) {
      return this.client.mute(this.name, nick, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.op = function(nick, reason, handler_cb, error_cb) {
      return this.client.op(this.name, nick, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.deop = function(nick, reason, handler_cb, error_cb) {
      return this.client.deop(this.name, nick, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.modifyAffiliation = function(jid, affiliation, reason, success_cb, error_cb) {
      return this.client.modifyAffiliation(this.name, jid, affiliation, reason, success_cb, error_cb);
    };

    XmppRoom.prototype.ban = function(jid, reason, handler_cb, error_cb) {
      return this.client.ban(this.name, jid, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.member = function(jid, reason, handler_cb, error_cb) {
      return this.client.member(this.name, jid, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.revoke = function(jid, reason, handler_cb, error_cb) {
      return this.client.revoke(this.name, jid, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.owner = function(jid, reason, handler_cb, error_cb) {
      return this.client.owner(this.name, jid, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.admin = function(jid, reason, handler_cb, error_cb) {
      return this.client.admin(this.name, jid, reason, handler_cb, error_cb);
    };

    XmppRoom.prototype.changeNick = function(nick) {
      this.nick = nick;
      return this.client.changeNick(this.name, nick);
    };

    XmppRoom.prototype.setStatus = function(show, status) {
      return this.client.setStatus(this.name, this.nick, show, status);
    };


    /*Function
    Adds a handler to the MUC room.
      Parameters:
    (String) handler_type - 'message', 'presence' or 'roster'.
    (Function) handler - The handler function.
    Returns:
    id - the id of handler.
     */

    XmppRoom.prototype.addHandler = function(handler_type, handler) {
      var id;
      id = this._handler_ids++;
      switch (handler_type) {
        case 'presence':
          this._presence_handlers[id] = handler;
          break;
        case 'message':
          this._message_handlers[id] = handler;
          break;
        case 'roster':
          this._roster_handlers[id] = handler;
          break;
        default:
          this._handler_ids--;
          return null;
      }
      return id;
    };


    /*Function
    Removes a handler from the MUC room.
    This function takes ONLY ids returned by the addHandler function
    of this room. passing handler ids returned by connection.addHandler
    may brake things!
      Parameters:
    (number) id - the id of the handler
     */

    XmppRoom.prototype.removeHandler = function(id) {
      delete this._presence_handlers[id];
      delete this._message_handlers[id];
      return delete this._roster_handlers[id];
    };


    /*Function
    Creates and adds an Occupant to the Room Roster.
      Parameters:
    (Object) data - the data the Occupant is filled with
    Returns:
    occ - the created Occupant.
     */

    XmppRoom.prototype._addOccupant = function(data) {
      var occ;
      occ = new Occupant(data, this);
      this.roster[occ.nick] = occ;
      return occ;
    };


    /*Function
    The standard handler that managed the Room Roster.
      Parameters:
    (Object) pres - the presence stanza containing user information
     */

    XmppRoom.prototype._roomRosterHandler = function(pres) {
      var data, handler, id, newnick, nick, _ref;
      data = XmppRoom._parsePresence(pres);
      nick = data.nick;
      newnick = data.newnick || null;
      switch (data.type) {
        case 'error':
          return true;
        case 'unavailable':
          if (newnick) {
            data.nick = newnick;
            if (this.roster[nick] && this.roster[newnick]) {
              this.roster[nick].update(this.roster[newnick]);
              this.roster[newnick] = this.roster[nick];
            }
            if (this.roster[nick] && !this.roster[newnick]) {
              this.roster[newnick] = this.roster[nick].update(data);
            }
          }
          delete this.roster[nick];
          break;
        default:
          if (this.roster[nick]) {
            this.roster[nick].update(data);
          } else {
            this._addOccupant(data);
          }
      }
      _ref = this._roster_handlers;
      for (id in _ref) {
        handler = _ref[id];
        if (!handler(this.roster, this)) {
          delete this._roster_handlers[id];
        }
      }
      return true;
    };


    /*Function
    Parses a presence stanza
      Parameters:
    (Object) data - the data extracted from the presence stanza
     */

    XmppRoom._parsePresence = function(pres) {
      var c, c2, data, _i, _j, _len, _len1, _ref, _ref1;
      data = {};
      data.nick = Strophe.getResourceFromJid(pres.getAttribute("from"));
      data.type = pres.getAttribute("type");
      data.states = [];
      _ref = pres.childNodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        switch (c.nodeName) {
          case "status":
            data.status = c.textContent || null;
            break;
          case "show":
            data.show = c.textContent || null;
            break;
          case "x":
            if (c.getAttribute("xmlns") === Strophe.NS.MUC_USER) {
              _ref1 = c.childNodes;
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                c2 = _ref1[_j];
                switch (c2.nodeName) {
                  case "item":
                    data.affiliation = c2.getAttribute("affiliation");
                    data.role = c2.getAttribute("role");
                    data.jid = c2.getAttribute("jid");
                    data.newnick = c2.getAttribute("nick");
                    break;
                  case "status":
                    if (c2.getAttribute("code")) {
                      data.states.push(c2.getAttribute("code"));
                    }
                }
              }
            }
        }
      }
      return data;
    };

    return XmppRoom;

  })();

  RoomConfig = (function() {
    function RoomConfig(info) {
      this.parse = __bind(this.parse, this);
      if (info !== null) {
        this.parse(info);
      }
    }

    RoomConfig.prototype.parse = function(result) {
      var attr, attrs, child, field, identity, query, _i, _j, _k, _len, _len1, _len2, _ref;
      query = result.getElementsByTagName("query")[0].childNodes;
      this.identities = [];
      this.features = [];
      this.x = [];
      for (_i = 0, _len = query.length; _i < _len; _i++) {
        child = query[_i];
        attrs = child.attributes;
        switch (child.nodeName) {
          case "identity":
            identity = {};
            for (_j = 0, _len1 = attrs.length; _j < _len1; _j++) {
              attr = attrs[_j];
              identity[attr.name] = attr.textContent;
            }
            this.identities.push(identity);
            break;
          case "feature":
            this.features.push(child.getAttribute("var"));
            break;
          case "x":
            if ((child.childNodes[0].getAttribute("var") !== 'FORM_TYPE') || (child.childNodes[0].getAttribute("type") !== 'hidden')) {
              break;
            }
            _ref = child.childNodes;
            for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
              field = _ref[_k];
              if (!field.attributes.type) {
                this.x.push({
                  "var": field.getAttribute("var"),
                  label: field.getAttribute("label") || "",
                  value: field.firstChild.textContent || ""
                });
              }
            }
        }
      }
      return {
        "identities": this.identities,
        "features": this.features,
        "x": this.x
      };
    };

    return RoomConfig;

  })();

  Occupant = (function() {
    function Occupant(data, room) {
      this.room = room;
      this.update = __bind(this.update, this);
      this.admin = __bind(this.admin, this);
      this.owner = __bind(this.owner, this);
      this.revoke = __bind(this.revoke, this);
      this.member = __bind(this.member, this);
      this.ban = __bind(this.ban, this);
      this.modifyAffiliation = __bind(this.modifyAffiliation, this);
      this.deop = __bind(this.deop, this);
      this.op = __bind(this.op, this);
      this.mute = __bind(this.mute, this);
      this.voice = __bind(this.voice, this);
      this.kick = __bind(this.kick, this);
      this.modifyRole = __bind(this.modifyRole, this);
      this.update(data);
    }

    Occupant.prototype.modifyRole = function(role, reason, success_cb, error_cb) {
      return this.room.modifyRole(this.nick, role, reason, success_cb, error_cb);
    };

    Occupant.prototype.kick = function(reason, handler_cb, error_cb) {
      return this.room.kick(this.nick, reason, handler_cb, error_cb);
    };

    Occupant.prototype.voice = function(reason, handler_cb, error_cb) {
      return this.room.voice(this.nick, reason, handler_cb, error_cb);
    };

    Occupant.prototype.mute = function(reason, handler_cb, error_cb) {
      return this.room.mute(this.nick, reason, handler_cb, error_cb);
    };

    Occupant.prototype.op = function(reason, handler_cb, error_cb) {
      return this.room.op(this.nick, reason, handler_cb, error_cb);
    };

    Occupant.prototype.deop = function(reason, handler_cb, error_cb) {
      return this.room.deop(this.nick, reason, handler_cb, error_cb);
    };

    Occupant.prototype.modifyAffiliation = function(affiliation, reason, success_cb, error_cb) {
      return this.room.modifyAffiliation(this.jid, affiliation, reason, success_cb, error_cb);
    };

    Occupant.prototype.ban = function(reason, handler_cb, error_cb) {
      return this.room.ban(this.jid, reason, handler_cb, error_cb);
    };

    Occupant.prototype.member = function(reason, handler_cb, error_cb) {
      return this.room.member(this.jid, reason, handler_cb, error_cb);
    };

    Occupant.prototype.revoke = function(reason, handler_cb, error_cb) {
      return this.room.revoke(this.jid, reason, handler_cb, error_cb);
    };

    Occupant.prototype.owner = function(reason, handler_cb, error_cb) {
      return this.room.owner(this.jid, reason, handler_cb, error_cb);
    };

    Occupant.prototype.admin = function(reason, handler_cb, error_cb) {
      return this.room.admin(this.jid, reason, handler_cb, error_cb);
    };

    Occupant.prototype.update = function(data) {
      this.nick = data.nick || null;
      this.affiliation = data.affiliation || null;
      this.role = data.role || null;
      this.jid = data.jid || null;
      this.status = data.status || null;
      this.show = data.show || null;
      return this;
    };

    return Occupant;
  })();
}));

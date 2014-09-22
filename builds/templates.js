this["JST"] = this["JST"] || {};

this["JST"]["action"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chat-message ' +
((__t = (extra_classes)) == null ? '' : __t) +
'">\n    <span class="chat-message-' +
((__t = (sender)) == null ? '' : __t) +
'">' +
((__t = (time)) == null ? '' : __t) +
' **' +
((__t = (username)) == null ? '' : __t) +
' </span>\n    <span class="chat-message-content">' +
((__t = (message)) == null ? '' : __t) +
'</span>\n</div>\n';

}
return __p
};

this["JST"]["add_contact_dropdown"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dl class="add-converse-contact dropdown">\n    <dt id="xmpp-contact-search" class="fancy-dropdown">\n        <a class="toggle-xmpp-contact-form" href="#"\n            title="' +
((__t = (label_click_to_chat)) == null ? '' : __t) +
'">\n        <span class="icon-plus"></span>' +
((__t = (label_add_contact)) == null ? '' : __t) +
'</a>\n    </dt>\n    <dd class="search-xmpp" style="display:none"><ul></ul></dd>\n</dl>\n';

}
return __p
};

this["JST"]["add_contact_form"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li>\n    <form class="add-xmpp-contact">\n        <input type="text"\n            name="identifier"\n            class="username"\n            placeholder="' +
((__t = (label_contact_username)) == null ? '' : __t) +
'"/>\n        <button type="submit">' +
((__t = (label_add)) == null ? '' : __t) +
'</button>\n    </form>\n<li>\n';

}
return __p
};

this["JST"]["change_status_message"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<form id="set-custom-xmpp-status">\n    <input type="text" class="custom-xmpp-status" ' +
((__t = (status_message)) == null ? '' : __t) +
'\n        placeholder="' +
((__t = (label_custom_status)) == null ? '' : __t) +
'"/>\n    <button type="submit">' +
((__t = (label_save)) == null ? '' : __t) +
'</button>\n</form>\n';

}
return __p
};

this["JST"]["chat_status"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="xmpp-status">\n    <a class="choose-xmpp-status ' +
((__t = (chat_status)) == null ? '' : __t) +
'"\n       data-value="' +
((__t = (status_message)) == null ? '' : __t) +
'"\n       href="#" title="' +
((__t = (desc_change_status)) == null ? '' : __t) +
'">\n\n        <span class="icon-' +
((__t = (chat_status)) == null ? '' : __t) +
'"></span>' +
((__t = (status_message)) == null ? '' : __t) +
'\n    </a>\n    <a class="change-xmpp-status-message icon-pencil"\n        href="#"\n        title="' +
((__t = (desc_custom_status)) == null ? '' : __t) +
'"></a>\n</div>\n';

}
return __p
};

this["JST"]["chatarea"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="chat-area">\n    <div class="chat-content"></div>\n    <form class="sendXMPPMessage" action="" method="post">\n        ';
 if (show_toolbar) { ;
__p += '\n            <ul class="chat-toolbar no-text-select"></ul>\n        ';
 } ;
__p += '\n        <textarea type="text" class="chat-textarea" \n            placeholder="' +
((__t = (label_message)) == null ? '' : __t) +
'"/>\n    </form>\n</div>\n';

}
return __p
};

this["JST"]["chatbox"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="box-flyout" style="height: ' +
((__t = (height)) == null ? '' : __t) +
'px">\n    <div class="dragresize dragresize-tm"></div>\n    <div class="chat-head chat-head-chatbox">\n        <a class="close-chatbox-button icon-close"></a>\n        <a class="toggle-chatbox-button icon-minus"></a>\n        <div class="chat-title">\n            ';
 if (url) { ;
__p += '\n                <a href="' +
((__t = (url)) == null ? '' : __t) +
'" target="_blank" class="user">\n            ';
 } ;
__p += '\n                    ' +
((__t = ( fullname )) == null ? '' : __t) +
'\n            ';
 if (url) { ;
__p += '\n                </a>\n            ';
 } ;
__p += '\n        </div>\n        <p class="user-custom-message"><p/>\n    </div>\n    <div class="chat-body">\n        <div class="chat-content"></div>\n        <form class="sendXMPPMessage" action="" method="post">\n            ';
 if (show_toolbar) { ;
__p += '\n                <ul class="chat-toolbar no-text-select"></ul>\n            ';
 } ;
__p += '\n        <textarea\n            type="text"\n            class="chat-textarea"\n            placeholder="' +
((__t = (label_personal_message)) == null ? '' : __t) +
'"/>\n        </form>\n    </div>\n</div>\n';

}
return __p
};

this["JST"]["chatroom"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="box-flyout" style="height: ' +
((__t = (height)) == null ? '' : __t) +
'px"\n    ';
 if (minimized) { ;
__p += ' style="display:none" ';
 } ;
__p += '>\n    <div class="dragresize dragresize-tm"></div>\n    <div class="chat-head chat-head-chatroom">\n        <a class="close-chatbox-button icon-close"></a>\n        <a class="toggle-chatbox-button icon-minus"></a>\n        <a class="configure-chatroom-button icon-wrench" style="display:none"></a>\n        <div class="chat-title"> ' +
((__t = ( name )) == null ? '' : __t) +
' </div>\n        <p class="chatroom-topic"><p/>\n    </div>\n    <div class="chat-body"><span class="spinner centered"/></div>\n</div>\n';

}
return __p
};

this["JST"]["chatroom_password_form"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chatroom-form-container">\n    <form class="chatroom-form">\n        <legend>' +
((__t = (heading)) == null ? '' : __t) +
'</legend>\n        <label>' +
((__t = (label_password)) == null ? '' : __t) +
'<input type="password" name="password"/></label>\n        <input type="submit" value="' +
((__t = (label_submit)) == null ? '' : __t) +
'"/>\n    </form>\n</div>\n';

}
return __p
};

this["JST"]["chatroom_sidebar"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<!-- <div class="participants"> -->\n<form class="room-invite">\n    <input class="invited-contact" placeholder="' +
((__t = (label_invitation)) == null ? '' : __t) +
'" type="text"/>\n</form>\n<label>' +
((__t = (label_occupants)) == null ? '' : __t) +
':</label>\n<ul class="participant-list"></ul>\n<!-- </div> -->\n';

}
return __p
};

this["JST"]["chatrooms_tab"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li><a class="s" href="#chatrooms">' +
((__t = (label_rooms)) == null ? '' : __t) +
'</a></li>\n';

}
return __p
};

this["JST"]["chats_panel"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div id="minimized-chats">\n    <a id="toggle-minimized-chats" href="#"></a>\n    <div class="minimized-chats-flyout"></div>\n</div>\n';

}
return __p
};

this["JST"]["choose_status"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dl id="target" class="dropdown">\n    <dt id="fancy-xmpp-status-select" class="fancy-dropdown"></dt>\n    <dd><ul class="xmpp-status-menu"></ul></dd>\n</dl>\n';

}
return __p
};

this["JST"]["contacts_panel"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<form class="set-xmpp-status" action="" method="post">\n    <span id="xmpp-status-holder">\n        <select id="select-xmpp-status" style="display:none">\n            <option value="online">' +
((__t = (label_online)) == null ? '' : __t) +
'</option>\n            <option value="dnd">' +
((__t = (label_busy)) == null ? '' : __t) +
'</option>\n            <option value="away">' +
((__t = (label_away)) == null ? '' : __t) +
'</option>\n            <option value="offline">' +
((__t = (label_offline)) == null ? '' : __t) +
'</option>\n            ';
 if (allow_logout)  { ;
__p += '\n            <option value="logout">' +
((__t = (label_logout)) == null ? '' : __t) +
'</option>\n            ';
 } ;
__p += '\n        </select>\n    </span>\n</form>\n';

}
return __p
};

this["JST"]["contacts_tab"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li><a class="s current" href="#users">' +
((__t = (label_contacts)) == null ? '' : __t) +
'</a></li>\n';

}
return __p
};

this["JST"]["controlbox"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="box-flyout" style="height: ' +
((__t = (height)) == null ? '' : __t) +
'px">\n    <div class="dragresize dragresize-tm"></div>\n    <div class="chat-head controlbox-head">\n        <ul id="controlbox-tabs"></ul>\n        <a class="close-chatbox-button icon-close"></a>\n    </div>\n    <div class="controlbox-panes"></div>\n</div>\n';

}
return __p
};

this["JST"]["controlbox_toggle"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<span class="conn-feedback">' +
((__t = (label_toggle)) == null ? '' : __t) +
'</span>\n<span style="display: none" id="online-count">(0)</span>\n';

}
return __p
};

this["JST"]["field"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<field var="' +
((__t = (name)) == null ? '' : __t) +
'"><value>' +
((__t = (value)) == null ? '' : __t) +
'</value></field>\n';

}
return __p
};

this["JST"]["form_checkbox"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<label>' +
((__t = (label)) == null ? '' : __t) +
'<input name="' +
((__t = (name)) == null ? '' : __t) +
'" type="' +
((__t = (type)) == null ? '' : __t) +
'" ' +
((__t = (checked)) == null ? '' : __t) +
'></label>\n';

}
return __p
};

this["JST"]["form_input"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<label>' +
((__t = (label)) == null ? '' : __t) +
'<input name="' +
((__t = (name)) == null ? '' : __t) +
'" type="' +
((__t = (type)) == null ? '' : __t) +
'" value="' +
((__t = (value)) == null ? '' : __t) +
'"></label>\n';

}
return __p
};

this["JST"]["form_select"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<label>' +
((__t = (label)) == null ? '' : __t) +
'<select name="' +
((__t = (name)) == null ? '' : __t) +
'">' +
((__t = (options)) == null ? '' : __t) +
'</select></label>\n';

}
return __p
};

this["JST"]["group_header"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<a href="#" class="group-toggle icon-' +
((__t = (toggle_state)) == null ? '' : __t) +
'" title="' +
((__t = (desc_group_toggle)) == null ? '' : __t) +
'">' +
((__t = (label_group)) == null ? '' : __t) +
'</a>\n';

}
return __p
};

this["JST"]["info"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chat-info">' +
((__t = (message)) == null ? '' : __t) +
'</div>\n';

}
return __p
};

this["JST"]["login_panel"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<form id="converse-login" method="post">\n    <label>' +
((__t = (label_username)) == null ? '' : __t) +
'</label>\n    <input type="username" name="jid" placeholder="Username">\n    <label>' +
((__t = (label_password)) == null ? '' : __t) +
'</label>\n    <input type="password" name="password" placeholder="Password">\n    <input class="login-submit" type="submit" value="' +
((__t = (label_login)) == null ? '' : __t) +
'">\n    <span class="conn-feedback"></span>\n</form">\n';

}
return __p
};

this["JST"]["login_tab"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li><a class="current" href="#login">' +
((__t = (label_sign_in)) == null ? '' : __t) +
'</a></li>\n';

}
return __p
};

this["JST"]["message"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chat-message ' +
((__t = (extra_classes)) == null ? '' : __t) +
'">\n    <span class="chat-message-' +
((__t = (sender)) == null ? '' : __t) +
'">' +
((__t = (time)) == null ? '' : __t) +
' ' +
((__t = (username)) == null ? '' : __t) +
':&nbsp;</span>\n    <span class="chat-message-content">' +
((__t = (message)) == null ? '' : __t) +
'</span>\n</div>\n';

}
return __p
};

this["JST"]["new_day"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<time class="chat-date" datetime="' +
((__t = (isodate)) == null ? '' : __t) +
'">' +
((__t = (datestring)) == null ? '' : __t) +
'</time>\n';

}
return __p
};

this["JST"]["occupant"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<li class="' +
((__t = (role)) == null ? '' : __t) +
'"\n    ';
 if (role === "moderator") { ;
__p += '\n       title="' +
((__t = (desc_moderator)) == null ? '' : __t) +
'"\n    ';
 } ;
__p += '\n    ';
 if (role === "participant") { ;
__p += '\n       title="' +
((__t = (desc_participant)) == null ? '' : __t) +
'"\n    ';
 } ;
__p += '\n    ';
 if (role === "visitor") { ;
__p += '\n       title="' +
((__t = (desc_visitor)) == null ? '' : __t) +
'"\n    ';
 } ;
__p += '\n>' +
((__t = (nick)) == null ? '' : __t) +
'</li>\n';

}
return __p
};

this["JST"]["pending_contact"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<span class="pending-contact-name">' +
((__t = (fullname)) == null ? '' : __t) +
'</span> <a class="remove-xmpp-contact icon-remove" title="' +
((__t = (desc_remove)) == null ? '' : __t) +
'" href="#"></a>\n';

}
return __p
};

this["JST"]["pending_contacts"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dt id="pending-xmpp-contacts"><a href="#" class="group-toggle icon-' +
((__t = (toggle_state)) == null ? '' : __t) +
'" title="' +
((__t = (desc_group_toggle)) == null ? '' : __t) +
'">' +
((__t = (label_pending_contacts)) == null ? '' : __t) +
'</a></dt>\n';

}
return __p
};

this["JST"]["requesting_contact"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<span class="req-contact-name">' +
((__t = (fullname)) == null ? '' : __t) +
'</span>\n<span class="request-actions">\n    <a class="accept-xmpp-request icon-checkmark" title="' +
((__t = (desc_accept)) == null ? '' : __t) +
'" href="#"></a>\n    <a class="decline-xmpp-request icon-close" title="' +
((__t = (desc_decline)) == null ? '' : __t) +
'" href="#"></a>\n</span>\n';

}
return __p
};

this["JST"]["requesting_contacts"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dt id="xmpp-contact-requests"><a href="#" class="group-toggle icon-' +
((__t = (toggle_state)) == null ? '' : __t) +
'" title="' +
((__t = (desc_group_toggle)) == null ? '' : __t) +
'">' +
((__t = (label_contact_requests)) == null ? '' : __t) +
'</a></dt>\n';

}
return __p
};

this["JST"]["room_description"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<!-- FIXME: check markup in mockup -->\n<div class="room-info">\n<p class="room-info"><strong>' +
((__t = (label_desc)) == null ? '' : __t) +
'</strong> ' +
((__t = (desc)) == null ? '' : __t) +
'</p>\n<p class="room-info"><strong>' +
((__t = (label_occ)) == null ? '' : __t) +
'</strong> ' +
((__t = (occ)) == null ? '' : __t) +
'</p>\n<p class="room-info"><strong>' +
((__t = (label_features)) == null ? '' : __t) +
'</strong>\n    <ul>\n        ';
 if (passwordprotected) { ;
__p += '\n        <li class="room-info locked">' +
((__t = (label_requires_auth)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (hidden) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_hidden)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (membersonly) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_requires_invite)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (moderated) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_moderated)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (nonanonymous) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_non_anon)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (open) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_open_room)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (persistent) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_permanent_room)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (publicroom) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_public)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (semianonymous) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_semi_anon)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (temporary) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_temp_room)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (unmoderated) { ;
__p += '\n        <li class="room-info">' +
((__t = (label_unmoderated)) == null ? '' : __t) +
'</li>\n        ';
 } ;
__p += '\n    </ul>\n</p>\n</div>\n';

}
return __p
};

this["JST"]["room_item"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dd class="available-chatroom">\n<a class="open-room" data-room-jid="' +
((__t = (jid)) == null ? '' : __t) +
'"\n   title="' +
((__t = (open_title)) == null ? '' : __t) +
'" href="#">' +
((__t = (name)) == null ? '' : __t) +
'</a>\n<a class="room-info icon-room-info" data-room-jid="' +
((__t = (jid)) == null ? '' : __t) +
'"\n   title="' +
((__t = (info_title)) == null ? '' : __t) +
'" href="#">&nbsp;</a>\n</dd>\n';

}
return __p
};

this["JST"]["room_panel"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<form class="add-chatroom" action="" method="post">\n    <input type="text" name="chatroom" class="new-chatroom-name"\n        placeholder="' +
((__t = (label_room_name)) == null ? '' : __t) +
'"/>\n    <input type="text" name="nick" class="new-chatroom-nick"\n        placeholder="' +
((__t = (label_nickname)) == null ? '' : __t) +
'"/>\n    <input type="' +
((__t = (server_input_type)) == null ? '' : __t) +
'" name="server" class="new-chatroom-server"\n        placeholder="' +
((__t = (label_server)) == null ? '' : __t) +
'"/>\n    <input type="submit" name="join" value="' +
((__t = (label_join)) == null ? '' : __t) +
'"/>\n    <input type="button" name="show" id="show-rooms" value="' +
((__t = (label_show_rooms)) == null ? '' : __t) +
'"/>\n</form>\n<dl id="available-chatrooms"></dl>\n';

}
return __p
};

this["JST"]["roster"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<input class="roster-filter" placeholder="' +
((__t = (placeholder)) == null ? '' : __t) +
'">\n<select class="filter-type">\n    <option value="contacts">' +
((__t = (label_contacts)) == null ? '' : __t) +
'</option>\n    <option value="groups">' +
((__t = (label_groups)) == null ? '' : __t) +
'</option>\n</select>\n<dl class="roster-contacts"></dl>\n';

}
return __p
};

this["JST"]["roster_item"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<a class="open-chat" title="' +
((__t = (desc_chat)) == null ? '' : __t) +
'" href="#"><span class="icon-' +
((__t = (chat_status)) == null ? '' : __t) +
'" title="' +
((__t = (desc_status)) == null ? '' : __t) +
'"></span>' +
((__t = (fullname)) == null ? '' : __t) +
'</a>\n<a class="remove-xmpp-contact icon-remove" title="' +
((__t = (desc_remove)) == null ? '' : __t) +
'" href="#"></a>\n';

}
return __p
};

this["JST"]["search_contact"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li>\n    <form class="search-xmpp-contact">\n        <input type="text"\n            name="identifier"\n            class="username"\n            placeholder="' +
((__t = (label_contact_name)) == null ? '' : __t) +
'"/>\n        <button type="submit">' +
((__t = (label_search)) == null ? '' : __t) +
'</button>\n    </form>\n<li>\n';

}
return __p
};

this["JST"]["select_option"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<option value="' +
((__t = (value)) == null ? '' : __t) +
'">' +
((__t = (label)) == null ? '' : __t) +
'</option>\n';

}
return __p
};

this["JST"]["status_option"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li>\n    <a href="#" class="' +
((__t = ( value )) == null ? '' : __t) +
'" data-value="' +
((__t = ( value )) == null ? '' : __t) +
'">\n        <span class="icon-' +
((__t = ( value )) == null ? '' : __t) +
'"></span>\n        ' +
((__t = ( text )) == null ? '' : __t) +
'\n    </a>\n</li>\n';

}
return __p
};

this["JST"]["toggle_chats"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p +=
((__t = (Minimized)) == null ? '' : __t) +
' <span id="minimized-count">(' +
((__t = (num_minimized)) == null ? '' : __t) +
')</span>\n<span class="unread-message-count"\n    ';
 if (!num_unread) { ;
__p += ' style="display: none" ';
 } ;
__p += '\n    href="#">' +
((__t = (num_unread)) == null ? '' : __t) +
'</span>\n';

}
return __p
};

this["JST"]["toolbar"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (show_emoticons)  { ;
__p += '\n    <li class="toggle-smiley icon-happy" title="Insert a smilery">\n        <ul>\n            <li><a class="icon-smiley" href="#" data-emoticon=":)"></a></li>\n            <li><a class="icon-wink" href="#" data-emoticon=";)"></a></li>\n            <li><a class="icon-grin" href="#" data-emoticon=":D"></a></li>\n            <li><a class="icon-tongue" href="#" data-emoticon=":P"></a></li>\n            <li><a class="icon-cool" href="#" data-emoticon="8)"></a></li>\n            <li><a class="icon-evil" href="#" data-emoticon=">:)"></a></li>\n            <li><a class="icon-confused" href="#" data-emoticon=":S"></a></li>\n            <li><a class="icon-wondering" href="#" data-emoticon=":\\"></a></li>\n            <li><a class="icon-angry" href="#" data-emoticon=">:("></a></li>\n            <li><a class="icon-sad" href="#" data-emoticon=":("></a></li>\n            <li><a class="icon-shocked" href="#" data-emoticon=":O"></a></li>\n            <li><a class="icon-thumbs-up" href="#" data-emoticon="(^.^)b"></a></li>\n            <li><a class="icon-heart" href="#" data-emoticon="<3"></a></li>\n        </ul>\n    </li>\n';
 } ;
__p += '\n';
 if (show_call_button)  { ;
__p += '\n<li class="toggle-call"><a class="icon-phone" title="' +
((__t = (label_start_call)) == null ? '' : __t) +
'"></a></li>\n';
 } ;
__p += '\n';
 if (show_participants_toggle)  { ;
__p += '\n<li class="toggle-participants"><a class="icon-hide-users" title="' +
((__t = (label_hide_participants)) == null ? '' : __t) +
'"></a></li>\n';
 } ;
__p += '\n';
 if (show_clear_button)  { ;
__p += '\n<li class="toggle-clear"><a class="icon-remove" title="' +
((__t = (label_clear)) == null ? '' : __t) +
'"></a></li>\n';
 } ;
__p += '\n';
 if (allow_otr)  { ;
__p += '\n    <li class="toggle-otr ' +
((__t = (otr_status_class)) == null ? '' : __t) +
'" title="' +
((__t = (otr_tooltip)) == null ? '' : __t) +
'">\n        <span class="chat-toolbar-text">' +
((__t = (otr_translated_status)) == null ? '' : __t) +
'</span>\n        ';
 if (otr_status == UNENCRYPTED) { ;
__p += '\n            <span class="icon-unlocked"></span>\n        ';
 } ;
__p += '\n        ';
 if (otr_status == UNVERIFIED) { ;
__p += '\n            <span class="icon-lock"></span>\n        ';
 } ;
__p += '\n        ';
 if (otr_status == VERIFIED) { ;
__p += '\n            <span class="icon-lock"></span>\n        ';
 } ;
__p += '\n        ';
 if (otr_status == FINISHED) { ;
__p += '\n            <span class="icon-unlocked"></span>\n        ';
 } ;
__p += '\n        <ul>\n            ';
 if (otr_status == UNENCRYPTED) { ;
__p += '\n               <li><a class="start-otr" href="#">' +
((__t = (label_start_encrypted_conversation)) == null ? '' : __t) +
'</a></li>\n            ';
 } ;
__p += '\n            ';
 if (otr_status != UNENCRYPTED) { ;
__p += '\n               <li><a class="start-otr" href="#">' +
((__t = (label_refresh_encrypted_conversation)) == null ? '' : __t) +
'</a></li>\n               <li><a class="end-otr" href="#">' +
((__t = (label_end_encrypted_conversation)) == null ? '' : __t) +
'</a></li>\n               <li><a class="auth-otr" data-scheme="smp" href="#">' +
((__t = (label_verify_with_smp)) == null ? '' : __t) +
'</a></li>\n            ';
 } ;
__p += '\n            ';
 if (otr_status == UNVERIFIED) { ;
__p += '\n               <li><a class="auth-otr" data-scheme="fingerprint" href="#">' +
((__t = (label_verify_with_fingerprints)) == null ? '' : __t) +
'</a></li>\n            ';
 } ;
__p += '\n            <li><a href="http://www.cypherpunks.ca/otr/help/3.2.0/levels.php" target="_blank">' +
((__t = (label_whats_this)) == null ? '' : __t) +
'</a></li>\n        </ul>\n    </li>\n';
 } ;
__p += '\n';

}
return __p
};

this["JST"]["trimmed_chat"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<a class="close-chatbox-button icon-close"></a>\n<a class="chat-head-message-count" \n    ';
 if (!num_unread) { ;
__p += ' style="display: none" ';
 } ;
__p += '\n    href="#">' +
((__t = (num_unread)) == null ? '' : __t) +
'</a>\n<a href="#" class="restore-chat" title="' +
((__t = (tooltip)) == null ? '' : __t) +
'">\n    ' +
((__t = ( title )) == null ? '' : __t) +
'\n</a>\n';

}
return __p
};
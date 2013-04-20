Converse.js configuration variables:
====================================

Prebind
--------

Use this option if you don't want to render the login form on the chat control
box.

When set to true, the onConnected method needs to be called manually, together
with a Strophe connection object.

The most likely usecase is if you want to already authenticate on the backend
and merely attach to that connection in the browser.

Besides requiring the back-end to authenticate you, you'll also 
have to write a Javascript snippet to attach to the set up connection::

    $.JSON({
        'url': 'mysite.com/xmpp-authenticate',
        'success': function (data) {
            connection = new Strophe.Connection(data.BOSH_SERVICE_URL);
            connection.attach(data.jid, data.sid, data.rid, converse.onConnected);
        }

fullname
--------

If you are using prebinding, you need to specify the fullname of the currently
logged in user.

xhr_user_search
---------------

There are two ways to add users. 

* The user inputs a valid JID (Jabber ID), and the user is added as a pending
contact.
* The user inputs some text (for example part of a firstname or lastname), an XHR will be made to a backend, and a list of matches are returned. The user can then choose one of the matches to add as a contact.

This setting enables the second mechanism, otherwise by default the first will
be used.

auto_subscribe
--------------

If true, the user will automatically subscribe back to any contact requests.

animate
-------

Show animations, for example when opening and closing chat boxes.

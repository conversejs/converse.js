.. Converse.js documentation master file, created by
   sphinx-quickstart on Fri Apr 26 20:48:03 2013.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

.. toctree::
   :maxdepth: 2

.. contents:: Table of Contents
   :depth: 3
   :local:

===================
What you will need:
===================

An XMPP/Jabber server
=====================

*Converse.js* implements `XMPP`_ as its messaging protocol, and therefore needs
to connect to an XMPP/Jabber server (Jabber is really just a synonym for XMPP).

You can either set up your own XMPP server, or use a public one. You can find a
list of public XMPP servers/providers on `xmpp.net`_ and a list of servers that
you can set up yourself on `xmpp.org`_. Personally, I'm partial towards `ejabberd`_.

Session support (i.e. single site login)
----------------------------------------

It's possible to enable single-site login, whereby users already
authenticated in your website will also automatically be logged in on the chat server,
but this will require custom code on your server.

Jack Moffitt has a great `blogpost`_ about this and even provides an `example Django application`_ to demonstrate it.

Connection Manager
==================

Your website and *Converse.js* use `HTTP`_ as protocol to communicate with
the webserver. HTTP connections are stateless and usually shortlived.

`XMPP`_ on the other hand, is the protocol that enables instant messaging, and
its connections are stateful and usually longer.

To enable a web application like *Converse.js* to communicate with an XMPP
server, we need a proxy in the middle that can act as a bridge between the two
protocols.

This is the job of a connection manager. A connection manager can be either a
standalone application or part of an XMPP server. `ejabberd`_ for example,
includes a connection manager (but you have to enable it).

The demo on the `Converse.js homepage`_ uses a a connection manager located at https://bind.opkode.im.
This connection manager is for testing purposes only, please don't use it in
production.

Overcoming cross-domain request restrictions
--------------------------------------------

The domain of the *Converse.js* demo is *conversejs.org*, but the domain of the connection manager is *opkode.im*.
HTTP requests are made by *Converse.js* to the connection manager via XmlHttpRequests (XHR).  
Until recently, it was not possible to make such requests to a different domain
than the one currently being served (to prevent XSS attacks).

Luckily there is now a standard called `CORS`_ (Cross-origin resource sharing), which enables exactly that.
Modern browsers support CORS, but there are problems with Internet Explorer <
10.

IE 8 and 9 partially support CORS via a proprietary implementation called
XDomainRequest. There is a `Strophe.js plugin`_ which you can use to enable
support for XDomainRequest when it is present.

In IE < 8, there is no support for CORS.

If you need to support these browsers, you can add a front-end proxy in
Apache/Nginx which serves the connection manager under the same domain as your
website. This will remove the need for any cross-domain XHR support.

====================================
Converse.js Configuration variables:
====================================

animate
=======

Default = True

Show animations, for example when opening and closing chat boxes.

auto_list_rooms
===============

Default = False

If true, and the XMPP server on which the current user is logged in supports
multi-user chat, then a list of rooms on that server will be fetched.

Not recommended for servers with lots of chat rooms.

For each room on the server a query is made to fetch further details (e.g.
features, number of occupants etc.), so on servers with many rooms this 
option will create lots of extra connection traffic.

auto_subscribe
==============

Default = False

If true, the user will automatically subscribe back to any contact requests.

bosh_service_url
================

Connections to an XMPP server depend on a BOSH connection manager which acts as
a middle man between HTTP and XMPP.

See `here`_ for more information.

fullname
========

If you are using prebinding, you need to specify the fullname of the currently
logged in user.

hide_muc_server
===============

Default = False

Hide the ``server`` input field of the form inside the ``Room`` panel of the
controlbox. Useful if you want to restrict users to a specific XMPP server of
your choosing.

prebind
========

Default = False

Use this option when you want to attach to an existing XMPP connection that was
already authenticated (usually on the backend before page load).

This is useful when you don't want to render the login form on the chat control
box with each page load.

When set to true, you'll need to make sure that the onConnected method is 
called, and passed to it a Strophe connection object.

Besides requiring the back-end to authenticate you, you'll also 
have to write a Javascript snippet to attach to the set up connection::

    $.JSON({
        'url': 'mysite.com/xmpp-authenticate',
        'success': function (data) {
            connection = new Strophe.Connection(bosh_service_url);
            connection.attach(data.jid, data.sid, data.rid, converse.onConnected);
        }

The backend must authenticate for you, and then return a SID (session ID) and
RID (Request ID), which you use when you attach to the connection.


xhr_user_search
===============

Default = False

There are two ways to add users. 

* The user inputs a valid JID (Jabber ID), and the user is added as a pending
contact.
* The user inputs some text (for example part of a firstname or lastname), an XHR will be made to a backend, and a list of matches are returned. The user can then choose one of the matches to add as a contact.

This setting enables the second mechanism, otherwise by default the first will
be used.


.. _`here`: http://metajack.im/2008/09/08/which-bosh-server-do-you-need/l
.. _`HTTP`: https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol
.. _`XMPP`: https://en.wikipedia.org/wiki/Xmpp
.. _`Converse.js homepage`: http://conversejs.org
.. _`CORS`: https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
.. _`Strophe.js plugin`: https://gist.github.com/1095825/6b4517276f26b66b01fa97b0a78c01275fdc6ff2
.. _`xmpp.net`: http://xmpp.net
.. _`xmpp.org`: http://xmpp.org/xmpp-software/servers/
.. _`ejabberd`: http://www.ejabberd.im
.. _`blogpost`: http://metajack.im/2008/10/03/getting-attached-to-strophe
.. _`example Django application`: https://github.com/metajack/strophejs/tree/master/examples/attach

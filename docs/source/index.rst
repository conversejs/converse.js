.. Converse.js documentation master file, created by
   sphinx-quickstart on Fri Apr 26 20:48:03 2013.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

.. toctree::
   :maxdepth: 2

.. contents:: Table of Contents
   :depth: 2
   :local:


========================
Configuration variables:
========================

Prebind
========

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

fullname
========

If you are using prebinding, you need to specify the fullname of the currently
logged in user.

bosh_service_url
================

Connections to an XMPP server depend on a BOSH connection manager which acts as
a middle man between HTTP and XMPP.

See `here`_ for more information.


xhr_user_search
===============

There are two ways to add users. 

* The user inputs a valid JID (Jabber ID), and the user is added as a pending
contact.
* The user inputs some text (for example part of a firstname or lastname), an XHR will be made to a backend, and a list of matches are returned. The user can then choose one of the matches to add as a contact.

This setting enables the second mechanism, otherwise by default the first will
be used.

auto_subscribe
==============

If true, the user will automatically subscribe back to any contact requests.

animate
=======

Show animations, for example when opening and closing chat boxes.

.. _`here`: http://metajack.im/2008/09/08/which-bosh-server-do-you-need/l



.. Converse.js documentation master file, created by
   sphinx-quickstart on Fri Apr 26 20:48:03 2013.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

.. toctree::
   :maxdepth: 2

.. contents:: Table of Contents
   :depth: 3
   :local:

============
Introduction
============

Even though you can connect to public XMPP servers on the `conversejs.org`_
website, *Converse.js* is not really meant to be a "Software-as-a-service" (SaaS) 
webchat.

Instead, its goal is to provide the means for website owners to add a tightly
integrated instant messaging service to their own sites.

As a website owner, you are expected to host *Converse.js* yourself, and to do some legwork to
properly configure and integrate it into your site.

The benefit in doing this, is that your users have a much more streamlined and integrated
webchat experience and that you have control over the data. The latter being a
requirement for many sites dealing with sensitive information.

You'll need to set up your own XMPP server and in order to have
`Session Support`_ (i.e. single-signon functionality whereby users are authenticated once and stay
logged in to XMPP upon page reload) you will also have to add some server-side
code.

The `What you will need`_ section has more information on all these
requirements.

==================
What you will need
==================

An XMPP/Jabber server
=====================

*Converse.js* implements `XMPP`_ as its messaging protocol, and therefore needs
to connect to an XMPP/Jabber server (Jabber is really just a synonym for XMPP).

You can connect to public XMPP servers like ``jabber.org`` but if you want to
have `Session Support`_ you'll have to set up your own XMPP server.

You can find a list of public XMPP servers/providers on `xmpp.net`_ and a list of
servers that you can set up yourself on `xmpp.org`_.


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

Server-side authentication
==========================

.. _`Session Support`:

Pre-binding and Single Session Support
--------------------------------------

It's possible to enable single-site login, whereby users already
authenticated in your website will also automatically be logged in on the chat server,
but this will require custom code on your server.

Jack Moffitt has a great `blogpost`_ about this and even provides an `example Django application`_ to demonstrate it.

.. Note::
   If you want to enable single session support, make sure to pass **prebind: true**
   when you call **converse.initialize** (see ./index.html).

When you authenticate to the XMPP server on your backend, you'll receive two
tokens, RID (request ID) and SID (session ID).

These tokens then need to be passed back to the javascript running in your
browser, where you will need them attach to the existing session.

You can embed the RID and SID tokens in your HTML markup or you can do an
XMLHttpRequest call to you server and ask it to return them for you.

Below is one example of how this could work. An Ajax call is made to the
relative URL **/prebind** and it expects to receive JSON data back.

:: 

    $.getJSON('/prebind', function (data) {
            var connection = new Strophe.Connection(converse.bosh_service_url);
            connection.attach(data.jid, data.sid, data.rid, function (status) {
                if ((status === Strophe.Status.ATTACHED) || (status === Strophe.Status.CONNECTED)) {
                    converse.onConnected(connection)
                } 
            });
        }
    );

**Here's what's happening:**

The JSON data contains the user's JID (jabber ID), RID and SID. The URL to the
BOSH connection manager is already set as a configuration setting on the
*converse* object (see ./main.js), so we can reuse it from there.

A new Strophe.Connection object is instantiated and then *attach* is called with
the user's JID, the necessary tokens and a callback function.

In the callback function, you call *converse.onConnected* together with the
connection object.


=========================================
Quickstart (to get a demo up and running)
=========================================

When you download a specific release of *Converse.js* there will be two minified files inside the zip file.

* converse.min.js
* converse.min.css

You can include these two files inside the *<head>* element of your website via the *script* and *link*
tags:

::

    <link rel="stylesheet" type="text/css" media="screen" href="converse.min.css">
    <script src="converse.min.js"></script>

Then, at the bottom of your page, after the closing *</body>* element, put the
following inline Javascript code:

::

    <script>
        converse.initialize({
            auto_list_rooms: false,
            auto_subscribe: false,
            bosh_service_url: 'https://bind.opkode.im', // Please use this connection manager only for testing purposes
            hide_muc_server: false,
            i18n: locales.en, // Refer to ./locale/locales.js to see which locales are supported
            prebind: false,
            show_controlbox_by_default: true,
            xhr_user_search: false
        });
    </script>

The *index.html* file inside the Converse.js folder serves as a nice usable
example of this.

These minified files provide the same demo-like functionality as is available
on the `conversejs.org`_ website. Useful for testing or demoing, but not very
practical.

You'll most likely want to implement some kind of single-signon solution for
your website, where users authenticate once in your website and then stay
logged into their XMPP session upon page reload.

For more info on this, read: `Pre-binding and Single Session Support`_.

You might also want to have more fine-grained control of what gets included in
the minified Javascript file. Read `Configuration`_ and `Minification`_ for more info on how to do
that.


=============
Configuration
=============

The included minified JS and CSS files can be used for demoing or testing, but
you'll want to configure *Converse.js* to suit your needs before you deploy it
on your website.

*Converse.js* is passed its configuration settings when you call its
*initialize* method.

You'll most likely want to call the *initialize* method in your HTML page. For
an example of how this is done, please see the bottom of the *./index.html* page.

Please refer to the `Configuration variables`_ section below for info on
all the available configuration settings.

After you have configured *Converse.js*, you'll have to regenerate the minified
JS file so that it will include the new settings. Please refer to the
`Minification`_ section for more info on how to do this.

Configuration variables
=======================

animate
-------

Default = True

Show animations, for example when opening and closing chat boxes.

auto_list_rooms
---------------

Default = False

If true, and the XMPP server on which the current user is logged in supports
multi-user chat, then a list of rooms on that server will be fetched.

Not recommended for servers with lots of chat rooms.

For each room on the server a query is made to fetch further details (e.g.
features, number of occupants etc.), so on servers with many rooms this 
option will create lots of extra connection traffic.

auto_subscribe
--------------

Default = False

If true, the user will automatically subscribe back to any contact requests.

bosh_service_url
----------------

Connections to an XMPP server depend on a BOSH connection manager which acts as
a middle man between HTTP and XMPP.

See `here`_ for more information.

fullname
--------

If you are using prebinding, you need to specify the fullname of the currently
logged in user.

hide_muc_server
---------------

Default = False

Hide the ``server`` input field of the form inside the ``Room`` panel of the
controlbox. Useful if you want to restrict users to a specific XMPP server of
your choosing.

prebind
--------

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

show_controlbox_by_default
--------------------------

Default = False

The "controlbox" refers to the special chatbox containing your contacts roster,
status widget, chatrooms and other controls.

By default this box is hidden and can be toggled by clicking on any element in
the page with class *toggle-online-users*.

If this options is set to true, the controlbox will by default be shown upon
page load.


xhr_user_search
---------------

Default = False

There are two ways to add users. 

* The user inputs a valid JID (Jabber ID), and the user is added as a pending contact.
* The user inputs some text (for example part of a firstname or lastname), an XHR will be made to a backend, and a list of matches are returned. The user can then choose one of the matches to add as a contact.

This setting enables the second mechanism, otherwise by default the first will
be used.

============
Minification
============

Minifying Javascript
====================

We  use `require.js`_ to keep track of *Converse.js* and its dependencies and to
to bundle them together in a single minified file fit for deployment to a 
production site.

To use the require.js's optimization tool, you'll need Node and it's package
manager, NPM.

You can then install install require.js for Node like so:

::

    npm install requirejs

The minified javascript file is then created like this:

::

    r.js -o build.js

You should now have a new minified file (the name which is specified in build.js).

You can `read more about require.js's optimizer here`_.

Minifying CSS
=============

CSS can be minimized with Yahoo's yuicompressor tool:

::

    yui-compressor --type=css converse.css -o converse.min.css


============
Translations
============

.. Note :: 
   Translations take up a lot of space and will bloat your minified file.
   At the time of writing, all the translations add about 50KB of extra data to
   the minified javascript file. Therefore, make sure to only
   include those languages that you intend to support and remove from
   ./locale/locales.js those which you don't need. Remember to rebuild the
   minified file afterwards.

The gettext POT file located in ./locale/converse.pot is the template
containing all translations and from which for each language an individual PO
file is generated.

The POT file contains all translateable strings extracted from converse.js.

To make a user facing string translateable, wrap it in the double underscore helper
function like so:

::

    __('This string will be translated at runtime');

After adding the string, you'll need to regenerate the POT file, like so:

::

    make pot

You can then create or update the PO file for a specific language by doing the following:

::

    msgmerge ./locale/af/LC_MESSAGES/converse.po ./locale/converse.pot -U

This PO file is then what gets translated.

If you've created a new PO file, please make sure to add the following
attributes at the top of the file (under *Content-Transfer-Encoding*). They are
required as configuration settings for Jed, the Javascript translations library
that we're using.

::

    "domain: converse\n"
    "lang: af\n"
    "plural_forms: nplurals=2; plural=(n != 1);\n"
    

Unfortunately Jed cannot use the PO files directly. We have to generate from it 
a file in JSON format and then put that in a .js file for the specific
language.

To generate JSON from a PO file, you'll need po2json for node.js. Run the
following command to install it (npm being the node.js package manager):

::

    npm install po2json
    
You can then convert the translations into JSON format:

::

    po2json locale/af/LC_MESSAGES/converse.po locale/af/LC_MESSAGES/converse.json

Now from converse.json paste the data as a value for the "locale_data" key in the
object in the language's .js file.

So, if you are for example translating into German (language code 'de'), you'll
create or update the file ./locale/LC_MESSAGES/de.js with the following code:

::

    (function (root, factory) {
        define("af", ['jed'], function () {
            return factory(new Jed({
                "domain": "converse",
                "locale_data": {
                    // Paste the JSON data from converse.json here
                }
            })
        }
    }(this, function (i18n) { 
        return i18n; 
    }));

making sure to also paste the JSON data as value to the "locale_data" key.

.. Note :: 
    If you are adding translations for a new language that is not already supported,
    you'll have to make one more edit in ./locale/locales.js to make sure the
    language is loaded by require.js.

Congratulations, you've now succesfully added your translations. Sorry for all
those hoops you had to jump through.


.. _`conversejs.org`: http://conversejs.org
.. _`require.js`: http://requirejs.org
.. _`read more about require.js's optimizer here`: http://requirejs.org/docs/optimization.html
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

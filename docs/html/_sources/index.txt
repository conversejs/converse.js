.. Converse.js documentation master file, created by
   sphinx-quickstart on Fri Apr 26 20:48:03 2013.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

.. toctree::
   :maxdepth: 2

.. contents:: Table of Contents
   :depth: 3
   :local:


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

You need to initialize Converse.js with configuration settings particular to
your requirements.

Please refer to the `Configuration variables`_ section further below for info on
all the available configuration settings.

To do this, put the following inline Javascript code at the
bottom of your page (after the closing *</body>* element).

::

    require(['converse'], function (converse) {
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
    });


Finally, Converse.js requires a special snippet of HTML markup to be included in your page:

::

    <div id="conversejs"></div>

The `index.html <https://github.com/jcbrand/converse.js/blob/master/index.html>`_ file inside the
Converse.js repository serves as a nice usable example of this.

These minified files provide the same demo-like functionality as is available
on the `conversejs.org <http://conversejs.org>`_ website. Useful for testing or demoing, but not very
practical.

You'll most likely want to implement some kind of single-signon solution for
your website, where users authenticate once in your website and then stay
logged into their XMPP session upon page reload.

For more info on this, read: `Pre-binding and Single Session Support`_.

You might also want to have more fine-grained control of what gets included in
the minified Javascript file. Read `Configuration`_ and `Minification`_ for more info on how to do
that.


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

Instead of using CORS, you can add a reverse proxy in
Apache/Nginx which serves the connection manager under the same domain as your
website. This will remove the need for any cross-domain XHR support.

For example:
~~~~~~~~~~~~

Assuming your site is accessible on port ``80`` for the domain ``mysite.com``
and your connection manager manager is running at ``someothersite.com/http-bind``.

The *bosh_service_url* value you want to give Converse.js to overcome
the cross-domain restriction is ``mysite.com/http-bind`` and not
``someothersite.com/http-bind``.

Your ``nginx`` or ``apache`` configuration will look as follows:

Nginx
~~~~~
::

    http {
        server {
            listen       80
            server_name  mysite.com;
            location ~ ^/http-bind/ {
                proxy_pass http://someothersite.com;
            }
        }
    }

Apache
~~~~~~
::

    <VirtualHost *:80>
        ServerName mysite.com
        RewriteEngine On
        RewriteRule ^/http-bind(.*) http://someothersite.com/http-bind$1 [P,L]
    </VirtualHost>


Server-side authentication
==========================

.. _`Session Support`:

Prebinding and Single Session Support
-------------------------------------

It's possible to enable single-site login, whereby users already
authenticated in your website will also automatically be logged in on the chat server,

This session should also persist across page loads. In other words, we don't
want the user to have to give their chat credentials every time they reload the
page.

To do this you will require a `BOSH server <http://xmpp.org/about-xmpp/technology-overview/bosh/>`_
for converse.js to connect to (see the `bosh_service_url`_ under `Configuration variables`_)
as well as a BOSH client on your own server (written for example in Python, Ruby or PHP) that will
do the pre-authentication before the web page loads.

.. note::
    A BOSH server acts as a bridge between HTTP, the protocol of the web, and
    XMPP, the instant messaging protocol.
    Converse.js can only communicate via HTTP, but we need to communicate with
    an XMPP server in order to chat. So the BOSH server acts as a middle man,
    translating our HTTP requests into XMPP stanzas and vice versa.

Jack Moffitt has a great `blogpost`_ about this and even provides an `example Django application`_ to demonstrate it.

When you authenticate to the XMPP server on your backend application (for
example via a BOSH client in Django), you'll receive two tokens, RID (request ID) and SID (session ID).

The **Session ID (SID)** is a unique identifier for the current *session*. This
number stays constant for the entire session.

The **Request ID (RID)** is a unique identifier for the current *request* (i.e.
page load). Each page load is a new request which requires a new unique RID.
The best way to achieve this is to simply increment the RID with each page
load.

When you initialize converse.js in your browser, you need to pass it these two
tokens. Converse.js will then use them to attach to the session you just
created.

You can embed the RID and SID tokens in your HTML markup or you can do an
XMLHttpRequest call to your server and ask it to return them for you.

Below is one example of how this could work. An Ajax call is made to the
relative URL **/prebind** and it expects to receive JSON data back.

::

    $.getJSON('/prebind', function (data) {
        converse.initialize({
            prebind: true,
            bosh_service_url: data.bosh_service_url,
            jid: data.jid,
            sid: data.sid,
            rid: data.rid
        });
    );

**Here's what's happening:**

The JSON data returned from the Ajax call to example.com/prebind contains the user's JID (jabber ID), RID, SID and the URL to the
BOSH server (also called a *connection manager*).

These values are then passed to converse.js's ``initialize`` method.

.. note::
   If you want to enable single session support, you need to set **prebind: true**
   when calling **converse.initialize** (see ./index.html).
   Additionally you need to pass in valid **jid**, **sid**, **rid** and
   **bosh_service_url** values.


Setting up a BOSH server
------------------------

The `Movim <http://movim.eu/>`_ project wiki has a very thorough page on setting up a BOSH server for
a wide variety of standalone or XMPP servers.

http://wiki.movim.eu/manual:bosh_servers

Facebook integration
====================

.. Note ::
    It should be possible to integrate Converse.js with Facebook chat, and
    below I'll provide some tips and documentation on how to achieve this. That
    said, I don't have a Facebook account and therefore haven't tried to do
    this myself. Feedback and patches from people who have succesfully done this
    will be appreciated.


Converse.js uses `Strophe.js <http://strophe.im/strophejs>`_ to connect and
communicate with the XMPP server. One nice thing about Strophe.js is that it
can be extended via `plugins <http://github.com/strophe/strophejs-plugins>`_.

Here is a `plugin for authenticating with facebook
<https://github.com/kissrobber/turedsocial/blob/master/strophe-plugins/src/facebook.js>`_.

You will need your own BOSH connection manager to act as a proxy between
Converse.js/Strophe.js and Facebook's XMPP server. That is because Facebook's
XMPP server doesn't support BOSH natively.

The BOSH connection manager that I make available for
testing purposes (at https://bind.opkode.im) uses `Punjab <https://github.com/twonds/punjab>`_,
although there are quite a few other options available as well.

When you configure Converse.js, via its ``initialize`` method, you must specify the
`bosh_service_url`_ value, which is to be your BOSH connection manager.

Please note, to enable Facebook integration, you'll have to
get your hands dirty and modify Converse.js's code, so that it calls the
``facebookConnect`` method of the plugin above.

The plugin above gives the following code example for you to meditate upon:

::

    connection = new Strophe.Connection("http://localhost:5280/bosh");
    connection.facebookConnect(
        "12345@chat.facebook.com",
        onConnectFacebook,
        300,
        1,
        '5e64a30272af065bd72258c565a03f2f',
        '8147a27e4a7f9b55ffc85c2683f9529a',
        FB.getSession().session_key
    );

The connection is already created inside Converse.js, so the
``facebookConnect`` method needs to also be called from there.

If someone submits a sane patch that does the above, I'll be happy to merge it.
Until then, people will have to do this themselves.

===========
Development
===========

If you want to work with the non-minified Javascript and CSS files you'll soon
notice that there are references to a missing *components* folder. Please
follow the instructions below to create this folder and fetch Converse's
3rd-party dependencies.


Install Node.js and development dependencies
============================================

We use development tools (`Grunt <http://gruntjs.com>`_ and `Bower <http://bower.io>`_)
which depend on Node.js and npm (the Node package manager).

If you don't have Node.js installed, you can download and install the latest
version `here <https://nodejs.org/download>`_.

Once you have Node.js installed, run the following command inside the Converse.js
directory:

::

    npm install

This will install all the development dependencies for Converse.js. If you are
curious to know what these are, take a look at whats under the *devDependencies* key in
`package.json <https://github.com/jcbrand/converse.js/blob/master/package.json>`.

Install 3rd party dependencies
==============================

After running ``npm install``, you will now have Grunt and Bower installed.

We use Bower to manage Converse's front-end dependencies (e.g. Javascript that
should get loaded in the browser).

To fetch these dependencies, run:

::

    grunt fetch

If you don't have grunt installed globally, you need to specify the relative
path:

::
    ./node_modules/.bin/grunt fetch

This will call Bower in the background to fetch all the front-end
dependencies (like backbone.js, strophe.js etc.) and then put them in the
*components* folder.

With AMD and require.js (recommended)
=====================================

Converse.js uses `require.js <http://requirejs.org>`_ to asynchronously load dependencies.

If you want to develop or customize converse.js, you'll want to load the
non-minified javascript files.

Add the following two lines to the *<head>* section of your webpage:

::

    <link rel="stylesheet" type="text/css" media="screen" href="converse.css">
    <script data-main="main" src="components/requirejs/require.js"></script>

require.js will then let the main.js file be parsed (because of the *data-main*
attribute on the *script* tag), which will in turn cause converse.js to be
parsed.

Without AMD and require.js
==========================

Converse.js can also be used without require.js. If you for some reason prefer
to use it this way, please refer to
`non_amd.html <https://github.com/jcbrand/converse.js/blob/master/non_amd.html>`_
for an example of how and in what order all the Javascript files that converse.js
depends on need to be loaded.


Before submitting a pull request
================================

Add tests for your bugfix or feature
------------------------------------

Add a test for any bug fixed or feature added. We use Jasmine
for testing.

Take a look at ``tests.html`` and ``spec/MainSpec.js`` to see how
the tests are implemented.

If you are unsure how to write tests, please
`contact me <http://opkode.com/contact>`_ and I'll be happy to help.

Check that the tests pass
-------------------------

Check that the Jasmine tests complete sucessfully. Open
`tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
in your browser, and the tests will run automatically.

On the command line you can run:

::

    grunt test

Check your code for errors or bad habits by running JSHint
----------------------------------------------------------

`JSHint <http://jshint.com>`_ will do a static analysis of your code and hightlight potential errors
and/or bad habits.

::

    grunt jshint


You can run both the tests and jshint in one go by calling:

::

    grunt check


===============
Troubleshooting
===============

Conflicts with other Javascript libraries
=========================================

Problem: 
---------

You are using other Javascript libraries (like JQuery plugins), and
get errors like these in your browser console::

    Uncaught TypeError: Object [object Object] has no method 'xxx' from example.js

Solution:
---------

First, find out which object is referred to by ``Object [object Object]``.

It will probably be the jQuery object ``$`` or perhaps the underscore.js object ``_``.

For the purpose of demonstration, I'm going to assume its ``$``, but the same
rules apply if its something else.

The bundled and minified default build of converse.js, ``converse.min.js``
includes within it all of converse.js's dependencies, which include for example *jQuery*.

If you are having conflicts where attributes or methods aren't available 
on the jQuery object, you are probably loading ``converse.min.js`` (which
includes jQuery) as well as your own jQuery version separately.

What then happens is that there are two ``$`` objects (one from
converse.js and one from the jQuery version you included manually)
and only one of them has been extended to have the methods or attributes you require.

Which jQuery object you get depends on the order in which you load the libraries.

There are multiple ways to solve this issue.

Firstly, make sure whether you really need to include a separate version of
jQuery. Chances are that you don't. If you can remove the separate
version, your problem should be solved, as long as your libraries are loaded in
the right order.

Either case, whether you need to keep two versions or not, the solution depends
on whether you'll use require.js to manage your libraries or whether you'll
load them manually.

With require.js
~~~~~~~~~~~~~~~

Instead of using ``converse.min.js``, manage all the libraries in your project
(i.e. converse.js and its dependencies plus all other libraries you use) as one
require.js project, making sure everything is loaded in the correct order.

Then, before deployment, you make your own custom minified build that bundles everything
you need.

With <script> tags
~~~~~~~~~~~~~~~~~~

Take a look at `non_amd.html <https://github.com/jcbrand/converse.js/blob/master/non_amd.html>`_
in the converse.js repo.

It shows in which order the libraries must be loaded via ``<script>`` tags. Add
your own libraries, making sure that they are loaded in the correct order (e.g.
jQuery plugins must load after jQuery).


======
Events
======

Converse.js emits events to which you can subscribe from your own Javascript.

Concerning events, the following methods are available:

Event Methods
=============

* **on(eventName, callback)**: 

    Calling the ``on`` method allows you to subscribe to an event.
    Every time the event fires, the callback method specified by ``callback`` will be
    called.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` is the callback method to be called when the event is emitted.

    For example::

        converse.on('onMessage', function (messageXML) { ... });

* **once(eventName, callback)**:

    Calling the ``once`` method allows you to listen to an event
    exactly once.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` is the callback method to be called when the event is emitted.
    
    For example::

        converse.once('onMessage', function (messageXML) { ... });

* **off(eventName, callback)**

    To stop listening to an event, you can use the ``off`` method.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` refers to the function that is to be no longer executed.


Event Types
===========

Here are the different events that are emitted:

* **onInitialized**

    ``converse.on('onInitialized', function () { ... });``

    Triggered once converse.js has been initialized.

* **onReady**

    Triggered after a connection has been established and converse.js has
    got all its ducks in a row.

    ``converse.on('onReady', function () { ... });``

* **onMessage**

    ``converse.on('onMessage', function (messageXML) { ... });``

    Triggered when a message is received.

* **onMessageSend**

    ``converse.on('onMessageSend', function (messageText) { ... });``

    Triggered when a message will be sent out.

* **onRoster**

    ``converse.on('onRoster', function (items) { ... });``

    Triggered when the roster is updated.

* **onRosterViewUpdated**

    ``converse.on('onRosterViewUpdated', function (items) { ... });``

    Triggered whenever the roster view (i.e. the rendered HTML) has changed.

* **onChatBoxFocused**

    ``converse.on('onChatBoxFocused', function (chatbox) { ... });``

    Triggered when the focus has been moved to a chat box.

* **onChatBoxOpened**

    ``converse.on('onChatBoxOpened', function (chatbox) { ... });``

    Triggered when a chat box has been opened.

* **onChatBoxClosed**

    ``converse.on('onChatBoxClosed', function (chatbox) { ... });``

    Triggered when a chat box has been closed.

* **onStatusChanged**

    ``converse.on('onStatusChanged', function (status) { ... });``

    Triggered when own chat status has changed.

* **onStatusMessageChanged**

    ``converse.on('onStatusMessageChanged', function (message) { ... });``

    Triggered when own custom status message has changed.

* **onBuddyStatusChanged**

    ``converse.on('onBuddyStatusChanged', function (buddy, status) { ... });``

    Triggered when a chat buddy's chat status has changed.

* **onBuddyStatusMessageChanged**

    ``converse.on('onBuddyStatusMessageChanged', function (buddy, messageText) { ... });``

    Triggered when a chat buddy's custom status message has changed.


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

allow_contact_requests
----------------------

Default = ``true``

Allow users to add one another as contacts. If this is set to false, the
**Add a contact** widget, **Contact Requests** and **Pending Contacts** roster
sections will all not appear. Additionally, all incoming contact requests will be
ignored.

allow_muc
---------

Default = ``true``

Allow multi-user chat (muc) in chatrooms. Setting this to ``false`` will remove
the ``Chatrooms`` tab from the control box.

animate
-------

Default = ``true``

Show animations, for example when opening and closing chat boxes.

auto_list_rooms
---------------

Default = ``false``

If true, and the XMPP server on which the current user is logged in supports
multi-user chat, then a list of rooms on that server will be fetched.

Not recommended for servers with lots of chat rooms.

For each room on the server a query is made to fetch further details (e.g.
features, number of occupants etc.), so on servers with many rooms this
option will create lots of extra connection traffic.

auto_subscribe
--------------

Default = ``false``

If true, the user will automatically subscribe back to any contact requests.

bosh_service_url
----------------

Connections to an XMPP server depend on a BOSH connection manager which acts as
a middle man between HTTP and XMPP.

See `here <http://metajack.im/2008/09/08/which-bosh-server-do-you-need>`_ for more information.

debug
-----

Default = ``false``

If set to true, debugging output will be logged to the browser console.

fullname
--------

If you are using prebinding, can specify the fullname of the currently
logged in user, otherwise the user's vCard will be fetched.

hide_muc_server
---------------

Default = ``false``

Hide the ``server`` input field of the form inside the ``Room`` panel of the
controlbox. Useful if you want to restrict users to a specific XMPP server of
your choosing.

i18n
----

Specify the locale/language. The language must be in the ``locales`` object. Refer to
``./locale/locales.js`` to see which locales are supported.

prebind
--------

Default = ``false``

Use this option when you want to attach to an existing XMPP connection that was
already authenticated (usually on the backend before page load).

This is useful when you don't want to render the login form on the chat control
box with each page load.

For prebinding to work, your backend server must authenticate for you, and
then return a JID (jabber ID), SID (session ID) and RID (Request ID).

If you set ``prebind`` to ``true``, you have to make sure to also pass in these
values as ``jid``, ``sid``, ``rid``.

Additionally, you have to specify ``bosh_service_url``.


show_controlbox_by_default
--------------------------

Default = ``false``

The "controlbox" refers to the special chatbox containing your contacts roster,
status widget, chatrooms and other controls.

By default this box is hidden and can be toggled by clicking on any element in
the page with class *toggle-online-users*.

If this options is set to true, the controlbox will by default be shown upon
page load.

show_only_online_users
----------------------

Default = ``false``

If set to ``true``, only online users will be shown in the contacts roster.
Users with any other status (e.g. away, busy etc.) will not be shown.

use_vcards
----------

Default = ``true``

Determines whether the XMPP server will be queried for roster contacts' VCards
or not. VCards contain extra personal information such as your fullname and
avatar image.

xhr_custom_status
-----------------

Default = ``false``

.. Note ::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

This option will let converse.js make an AJAX POST with your changed custom chat status to a
remote server.

xhr_custom_status_url
---------------------

.. Note ::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

Default = Empty string

Used only in conjunction with ``xhr_custom_status``.

This is the URL to which the AJAX POST request to set the user's custom status
message will be made.

The message itself is sent in the request under the key ``msg``.

xhr_user_search
---------------

Default = ``false``

.. Note ::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

There are two ways to add users.

* The user inputs a valid JID (Jabber ID), and the user is added as a pending contact.
* The user inputs some text (for example part of a firstname or lastname), an XHR (Ajax Request) will be made to a remote server, and a list of matches are returned. The user can then choose one of the matches to add as a contact.

This setting enables the second mechanism, otherwise by default the first will be used.

*What is expected from the remote server?*

A default JSON encoded list of objects must be returned. Each object
corresponds to a matched user and needs the keys ``id`` and ``fullname``.

xhr_user_search_url
-------------------

.. Note ::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

Default = Empty string

Used only in conjunction with ``xhr_user_search``.

This is the URL to which an AJAX GET request will be made to fetch user data from your remote server.
The query string will be included in the request with ``q`` as its key.

============
Minification
============

Minifying Javascript and CSS
============================

Please make sure to read the section `Development`_ and that you have installed
all development dependencies (long story short, you can run ``npm install``
and then ``grunt fetch``).

We  use `require.js`_ to keep track of *Converse.js* and its dependencies and to
to bundle them together in a single minified file fit for deployment to a
production site.

To minify the Javascript and CSS, run the following command:

::

    grunt minify

Javascript will be bundled and minified with `require.js`_'s optimization tool,
using `almond <https://github.com/jrburke/almond>`_.

You can `read more about require.js's optimizer here`_.

CSS is minified via `cssmin <https://github.com/gruntjs/grunt-contrib-cssmin>`_.


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

    msgmerge ./locale/de/LC_MESSAGES/converse.po ./locale/converse.pot -U

To do this for ALL languages, run:

::

    make merge

The resulting PO file is then what gets translated.

If you've created a new PO file, please make sure to add the following
attributes at the top of the file (under *Content-Transfer-Encoding*). They are
required as configuration settings for Jed, the Javascript translations library
that we're using.

::

    "domain: converse\n"
    "lang: de\n"
    "plural_forms: nplurals=2; plural=(n != 1);\n"


Unfortunately `Jed <http://slexaxton.github.io/Jed>`_ cannot use the PO files directly. We have to generate from it
a file in JSON format and then put that in a .js file for the specific
language.

To generate JSON from a PO file, you'll need po2json for node.js. Run the
following command to install it (npm being the node.js package manager):

::

    npm install po2json

You can then convert the translations into JSON format:

::

    po2json locale/de/LC_MESSAGES/converse.po locale/de/LC_MESSAGES/converse.json

Now from converse.json paste the data as a value for the "locale_data" key in the
object in the language's .js file.

So, if you are for example translating into German (language code 'de'), you'll
create or update the file ./locale/LC_MESSAGES/de.js with the following code:

::

    (function (root, factory) {
        define("de", ['jed'], function () {
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

.. _`read more about require.js's optimizer here`: http://requirejs.org/docs/optimization.html
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

.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>
 
=======================
Security considerations
=======================

.. note::
    Converse comes with no warranty of any kind and the authors are not liable for any damages.

The data-structures of Converse encapsulate sensitive user data such as
XMPP account details (in case of manual login) and personal conversations.

In an environment where, besides Converse, other untrusted 3rd party scripts
might also be running, it's important to guard against malicious or invasive
access to user data and/or the API.

The threat model
================

The following threat model is considered:

Malicious 3rd party scripts served through compromised side-channels, such as ad-networks,
which attempt to access Converse's API and/or data-structures in order to personify users
or to pilfer their data.

Mitigating measures
===================

As of version 3.0.0, the following actions were taken to harden Converse against attacks:

Separate code/data into public and private parts
------------------------------------------------

1. Encapsulate Converse's data structures into a private closured object (named ``_converse``).
2. Split the API into public and private parts.

Restrict access to private code/data
------------------------------------

3. Only plugins are allowed to access the private API and the closured ``_converse`` object.
4. TODO: Whitelist plugins that have access to the private API and closured ``_converse`` object.
5. Prevent the removal of registered plugins (otherwise the whitelist could be circumvented).
6. Throw an error when multiple plugins try to register under the same name
   (otherwise the whitelist could be circumvented).

.. note::
    Care should be taken when using a custom build of Converse where some
    of the core plugins contained in the default build are omitted. In this case
    the omitted plugins should also be removed from the whitelist, otherwise
    malicious plugins could be registered under their names.

Addititional measures
=====================

Besides the measures mentioned above, integrators and hosts can also take
further security precautions.

The most effective is to avoid serving untrusted 3rd party JavaScript (e.g.
advertisements and analytics).

Another option is to forego the use of a global ``converse`` object (which
exposes the public API) and instead to encapsulate it inside a private closure,
in order to keep it inaccessible to other scripts.


Other considerations
====================

Locally cached data
-------------------

Besides the "hot" data stored in Backbone models and collections, which are all
encapsulated in the private ``_converse`` object, there is also the cached data
stored in the browser's ``sessionStorage`` and ``localStorage`` stores.

Examples of sensitive cached data are chat messages and the contacts roster,
both which are in session storage, which means that the cache is cleared as
soon as the last tab or window is closed. User credentials are not cached at
all.

Perhaps the ability to encrypt this cached data could be added in future
versions of Converse, if there is sufficient demand for it.

However to date no significant mitigation or hardening measures have been taken to
secure this cached data.

Therefore, the best defence as website host is to avoid serving Converse with
untrusted 3rd party code, and the best defence as an end-user is to avoid chatting
on websites that host untrusted 3rd party code. The most common examples of such
being advertising and analytics scripts.


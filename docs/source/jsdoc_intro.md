# The Converse API documentation

## The public and private API

Converse has a public API and a private API.

The reason we make this distinction between public and private is so that API
methods which might can be used to "impersonate" the user, for example by
sending messages on their behalf, are not available to random scripts running
in the websites.

The public API is accessible via the `window.converse` global and is therefore
available to all JavaScript running in the page.

The private API is only accessible to plugins, which have been whitelisted and
registered before `converse.initialize` (which is a public API method) has been
called. See the [plugin development](https://conversejs.org/docs/html/plugin_development.html)
section for more info on writing plugins.

Inside a plugin, you can get access to the `_converse.api` object. Note the
underscore in front of `_converse`, which indicates that this is a private,
closured object.

## API Groupings

The Converse API is often broken up into different logical "groupings" (for
example `converse.plugins` or `converse.contacts`).

There are some exceptions to this, like `converse.initialize`, which aren't
groupings but single methods.

The groupings logically group methods, such as standardised accessors and
mutators:

* .get
* .set
* .add
* .remove

So for example, to get a contact, you would do the following:

    _converse.api.contacts.get('jid@example.com');

To get multiple contacts, just pass in an array of jids:

    _converse.api.contacts.get(['jid1@example.com', 'jid2@example.com']);

To get all contacts, simply call ``get`` without any jids:

    _converse.api.contacts.get();


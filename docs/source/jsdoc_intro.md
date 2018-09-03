# The Converse API documentation

Welcome to the new Converse API documentation, generated with
[JSDoc](http://usejsdoc.org/).

The old (increasingly out of date and incomplete) API documentation is
currently still [available here](/docs/htmls/developer_api.html).

## The public and private API

Converse has a public API and a private API.
r
The reason we make this distinction between public and private is so that API
methods which might can be used to "impersonate" the user, for example by
sending messages on their behalf, are not available to random scripts running
in the websites.

The public API is accessible via the `window.converse` global and is therefore
available to all JavaScript running in the page.

Tehe private API is only accessible to plugins, which have been whitelisted and
registered before `converse.initialize` (which is a public API method) has been
called. See the [plugin development](https://conversejs.org/docs/html/plugin_development.html)
section for more info on writing plugins.

Inside a plugin, you can get access to the `_converse.api` object. Note the
underscore in front of `_converse`, which indicates that this is a private,
closured object.

## API Namespaces

The Converse API (private and public) makes use of namespaces to logically
group relevant methods.

So, for example, all the XEP-0030 service discovery methods are under the
{@link \_converse.api.disco} namespace, in the [private API]{@link \_converse.api}.

Which means that you access it via `_converse.api.disco`.

Namespaces can be nested. So the {@link \_converse.api.disco} namespace
namespace has {@link \_converse.api.disco.own} as a nested namespace.

Not all methods are however within a namespace. For example {@link converse.initialize}.

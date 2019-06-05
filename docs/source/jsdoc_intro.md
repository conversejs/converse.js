# The Converse API documentation

Welcome to the new Converse API documentation, generated with
[JSDoc](http://usejsdoc.org/).

## The public and private API

Converse has a public API and a private API only available to plugins.

The reason we make this distinction between public and private is so that API
methods which could be used to "impersonate" the user, for example by
sending messages on their behalf, are not available to random scripts running
in your website.

The public API is accessible via the [window.converse](/docs/html/api/converse.html)
global and is therefore available to any JavaScript running in the page.

The private API is only accessible to plugins, which have been whitelisted and
registered before [converse.initialize](/docs/html/api/converse.html#.initialize)
(which is a public API method) has been called.

See the [plugin development](/docs/html/plugin_development.html)
section for more info on writing plugins.

Inside a plugin, you can get access to the {@link _converse.api}
object. Note the underscore in front of {@link _converse},
which indicates that this is a private, closured object.

## API Namespaces

The Converse API (private and public) makes use of namespaces to logically
group relevant methods.

So, for example, all the XEP-0030 service discovery methods are under the
{@link \_converse.api.disco} namespace, in the [private API]{@link \_converse.api}.

Which means that you access it via {@link _converse.api.disco}.

### Nested Namespaces

Namespaces can be nested.

{@link _converse.api} is the top-level namespace, of which {@link \_converse.api.disco}
is a nested, child namespace and {@link \_converse.api.disco.own} is nested another
level deeper.

Not all methods are however within a namespace. For example {@link converse.initialize}.

## Stable API versus unstable API

Converse uses [semantic versioning](https://semver.org/) for releases, which means that 
we try to maintain a stable API for minor and patch releases and when we do change the
stable API we will make a major release.

In the JSDoc API documentation, all API methods that are **not** marked as *Private*
are considered to be part of the stable API, and you can therefore expect them to
not change between minor and patch releases. If a method is marked as *Private*,
then you could still use it, but we don't provide any guarantee that it won't change
between minor and patch releases.

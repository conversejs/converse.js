---
title: Integrating into Other Frameworks
description: How to integrate Converse into frameworks like Angular.js.
---

## Angular.js

Angular.js has the concept of a [service](https://docs.angularjs.org/guide/services#!),
which is a special kind of [provider](https://docs.angularjs.org/guide/providers).

An angular.js service is a constructor or object which provides an API defined by the
author of the service. The goal of a service is to organize and share code, so
that it can be used across an application.

So, if we wanted to properly integrate converse.js into an angular.js
application, then putting it into a service is a good approach.

This lets us avoid having a global `converse` API object (accessible via
`windows.converse`), and instead we can get hold of the converse API via
angular's dependency injection when we specify it as a dependency for our
angular components.

Below is an example code that wraps converse.js as an angular.js service.

```javascript
angular.module('converse', []).service('converse', function() {
    var loaded_deferred = new $.Deferred(),
        connected_deferred = new $.Deferred();

    var service = {
        'waitUntilLoaded': _.constant(loaded_deferred.promise()),
        'initialize': function initConverse(options) {
            this.waitUntilLoaded().done(_.partial(this.api.initialize, options));
        },
        'waitUntilConnected': _.constant(connected_deferred.promise())
    };

    define([
        "converse-core",
        "locales",
        "converse-chatview",
        "converse-controlbox",
        "converse-bookmarks",
        "converse-mam",
        "converse-muc",
        "converse-vcard",
        "converse-register",
        "converse-ping",
        "converse-notification",
        "converse-minimize",
        "converse-dragresize",
        "converse-headline",
    ], function(converse) {
        service.api = converse;

        converse.plugins.add('conversejs-angular-service', {
            initialize: function () {
                this._converse.api.listen.on('connected', connected_deferred.resolve);
            }
        });

        return loaded_deferred.resolve();
    });
    require(["converse"]);
    return service;
});
```

The above code is a modified version of the file [src/converse.js](https://github.com/jcbrand/converse.js/blob/master/src/converse.js)
which defines the converse AMD module and specifies which plugins will go into
this build.

You should replace the contents of that file with the above, if you want such a
service registered. Then, you should run `make build`, to create new build
files in the `dist` directory, containing your new angular.js service.

The above code registers an angular.js module and service, both named `converse`.

This module should then be added as a dependency for your own angular.js
modules, for example:

```javascript
angular.module('my-module', ['converse']);
```

Then you can have the converse service dependency injected into
your components, for example:

```javascript
angular.module('my-module').provider('my-provider', function(converse) {
    // Your custom code can come here..

    converse.waitUntilLoaded().done(function () {
        converse.initialize({
            'allow_logout': false,
            'auto_login': 'true',
            'auto_reconnect': true,
            'bosh_service_url': bosh_url,
            'jid': bare_jid,
            'credentials_url': credentials_url,
            'whitelisted_plugins': ['conversejs-angular-service']
        });

    // More custom code could come here...
    });
});
```

You might have noticed the `waitUntilLoaded()` method being called on the `converse`
service. This is a special method added to the service (see the implementation
example above) that makes sure that converse.js is loaded and available. It
returns a promise which resolves once converse.js is available.

This is necessary because otherwise you might run into race-conditions
when your angular application loads more quickly than converse.js.

Lastly, the API of converse is available via the `.api` attribute on the service.
So you can call it like this for example:

```javascript
converse.api.user.status.set('online');
```

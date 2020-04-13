# Converse Headless

[Converse](https://conversejs.org) has a special build called the *headless build*.

You can generate it yourself by running ``make src/headless/dist/converse-headless.js``
in the root of the [converse.js repo](https://github.com/conversejs/converse.js).

The headless build is a bundle of all the non-UI parts of Converse, and its aim
is to provide you with an XMPP library (and application) on which you can build
your own UI.

It's also installable with NPM/Yarn as [@converse/headless](https://www.npmjs.com/package/@converse/headless).

The main distribution of Converse relies on the headless build.

The file [src/headless/headless.js](https://github.com/jcbrand/converse.js/blob/master/src/headless/headless.js)
is used to determine which plugins are included in the build.

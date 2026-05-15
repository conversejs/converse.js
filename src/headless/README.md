# Converse Headless

[Converse](https://conversejs.org) has a special build called the _headless build_.

You can generate it yourself by running `npm run build:headless`
in the root of the [converse.js repo](https://github.com/conversejs/converse.js).

The headless build is a bundle of all the non-UI parts of Converse, and its aim
is to provide you with an XMPP library (and application) on which you can build
your own UI.

It's also installable with NPM/Yarn as [@converse/headless](https://www.npmjs.com/package/@converse/headless).

The main distribution of Converse relies on the headless build.

The file [src/headless/index.js](https://github.com/jcbrand/converse.js/blob/master/src/headless/index.js)
is used to determine which plugins are included in the build.

## Runtime files

When serving or bundling `@converse/headless`, these companion files must be available at runtime:

| File                       | Purpose                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| `libomemo.esm.min.js`      | GPL-licensed crypto library, loaded on-demand when OMEMO encryption is used |
| `curve25519_compiled.wasm` | WebAssembly crypto primitives, loaded by `libomemo.esm.js`                  |
| `emoji.json`               | Emoji metadata for the built-in emoji picker                                |

All files must live in the same directory. For CDN/self-host deployments, copy the entire `dist/` directory. When using a bundler, ensure these files are treated as external (not bundled).

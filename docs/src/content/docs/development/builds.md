---
title: Generating Builds
description: How to create JavaScript and CSS bundles for Converse.
---

:::caution
The current documentation in this section does not adequately
explain how to create custom bundles.
:::

:::note
Please make sure to read the section [Development](/development/overview/) and that you have installed
all development dependencies.
:::

## Creating JavaScript and CSS bundles and distribution files

Converse uses [RSPack](https://www.rspack.dev/) to create the final JavaScript and CSS distribution files.

The generated distribution files are all placed in the `./dist` directory.
The Converse repository does not include `dist` directory by default.

To generate the `./dist` directory and all CSS and JavaScript bundles, simply run:

```bash
npm run build
```

When you're developing, and constantly changing code, you can run:

```bash
npm run watch
```

This will let the bundles be automatically generated as soon as you edit a file.

:::note
If you have GNU Make installed, you can also run `make dist` to build all distribution files,
or `make watch` for the watch mode.
:::

## Development builds

For development, you can use:

- `npm run dev` - Creates unminified development builds
- `npm run watch` - Watches for changes and rebuilds automatically
- `npm run devserver` - Starts the RSPack development server with live reloading

## Production builds

For production builds, you can use:

- `npm run build` - Creates minified production builds (ESM and CJS)
- `npm run build:headless` - Builds the headless package
- `npm run build:esm` - Builds only the ESM bundle
- `npm run build:cjs` - Builds only the CommonJS bundle

## Special builds

### Headless build

Converse has a special build called the `headless build`.

You can generate it by running:

```bash
npm run build:headless
```

The headless build is a bundle of all the non-UI parts of Converse, and its aim
is to provide you with an XMPP library (and application) on which you can build
your own UI.

It's also installable as [@converse/headless](https://www.npmjs.com/package/@converse/headless).

The main distribution of Converse relies on the headless build.

The file [src/headless/index.js](https://github.com/jcbrand/converse.js/blob/master/src/headless/index.js)
is used to determine which plugins are included in the build.

### CDN build

To create a build suitable for CDN deployment with absolute paths, run:

```bash
npm run cdn
```

## Creating custom bundles

One reason you might want to create your own bundles, is because you want to
remove some of the core plugins of Converse, or perhaps you want to include
your own.

To add or remove plugins from the build, you need to modify
[src/index.js](https://github.com/conversejs/converse.js/blob/master/src/index.js) or
[src/headless/index.js](https://github.com/conversejs/converse.js/blob/master/src/headless/index.js).

You'll find sections where plugins are imported and registered. You can comment
out or remove plugins you don't need.

After doing so, you need to run `npm run build` again in the root of your
Converse repository, in order to generate the new build.

Be aware that some plugins might have dependencies on other plugins, so if you
remove a certain plugin but other included plugins still depend on it, then it
will still be included in your build.

To see which other plugins a particular plugin depends on, open it up in your
text editor and look at the import statements and plugin dependencies.

## Build configuration files

The RSPack build configuration files are located in the `rspack/` directory:

- `rspack.common.js` - Shared configuration used by all builds
- `rspack.build.js` - Main production build configuration
- `rspack.build.esm.js` - ESM-specific build configuration
- `rspack.build.cjs.js` - CommonJS-specific build configuration
- `rspack.headless.js` - Headless build configuration
- `rspack.nodeps.js` - No-dependencies build configuration
- `rspack.serve.js` - Development server configuration

## Output files

After building, the following files will be generated in the `dist/` directory:

- `converse.js` - Main CommonJS bundle
- `converse.min.js` - Minified CommonJS bundle
- `converse.esm.js` - Main ESM bundle
- `converse.min.esm.js` - Minified ESM bundle
- `converse.css` - Main CSS bundle
- `converse.min.css` - Minified CSS bundle

The headless build generates files in `src/headless/dist/`:

- `converse-headless.js` - Headless CommonJS bundle
- `converse-headless.min.js` - Minified headless CommonJS bundle
- `converse-headless.esm.js` - Headless ESM bundle
- `converse-headless.min.esm.js` - Minified headless ESM bundle

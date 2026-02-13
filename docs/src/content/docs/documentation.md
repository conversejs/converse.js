---
title: Writing Documentation
description: How to contribute to the Converse documentation.
---

:::note
Contributions to the documentation are much appreciated.
:::

## What is used to write the documentation?

This documentation is written using [Starlight](https://starlight.astro.build/), an Astro-based
documentation generator.

The documentation source files are written in Markdown.

## Where is the documentation?

The Markdown documentation files are located in the
[converse.js code repository](https://github.com/jcbrand/converse.js/tree/master/docs/)
under `docs/`.

## How to generate HTML from the source files?

### Install the dependencies

```
cd docs
npm install
```

### Run the development server

```
npm run dev
```

This will start a local server with live-reloading. You can view the docs at http://localhost:4321.

### Build for production

```
npm run build
```

The HTML files will be generated in `docs/dist/`.

:::caution
When contributing, please don't commit any generated HTML files.
:::

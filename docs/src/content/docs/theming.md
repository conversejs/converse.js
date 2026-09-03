---
title: Theming
description: How to customize the look and feel of Converse.
---

## Setting up your environment

In order to theme Converse, you first need to follow the steps for [Setting up a Dev Environment](/docs/development/setup-dev-environment/), including the [webserver section](/docs/development/setup-dev-environment/#setting-up-your-development-environment).

## Creating a custom theme

Converse can be themed via CSS custom properties (aka CSS variables) and comes with several themes available in its source repository.

A theme is a CSS file with a specific rule that defines the theme's CSS properties. The rule has a specific selector that must include (and determines) the theme name.

Inside this CSS rule, various CSS variables are assigned values. The CSS variables mainly refer to the colors that comprise the theme.

There is no fallback to the `classic` theme: each theme is an independent CSS rule, so a variable your theme doesn't set resolves to nothing at all, and every declaration that reads it is dropped. Copy a shipped theme such as [classic.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/classic.scss) and change the values, rather than starting from a short list.

The native theme files can be found in [shared/styles/themes](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes).

Note: The Converse theme files have a `.scss` extension because they are compiled by the Sass compiler into normal CSS files. However, it's not necessary to use Sass - basic CSS files will also work.

The theme that Converse uses can be set via the [`theme`](/docs/configuration/#theme) configuration setting (and the [`dark_theme`](/docs/configuration/#dark_theme) configuration setting for dark mode).

### How are themes applied?

When you set a value for the [`theme`](/docs/configuration/#theme) configuration setting, Converse marks the `converse-root` DOM element with the theme's name in three ways: a `theme-${name}` class, and the `data-converse-theme` and `data-bs-theme` attributes.

So, for example, if you set the `theme` setting to `"dracula"`:

```javascript
converse.initialize({ theme: "dracula" });
```

```html
<converse-root class="conversejs theme-dracula"
               data-converse-theme="dracula"
               data-bs-theme="dracula"></converse-root>
```

Any of the three can carry your theme's rule. The shipped themes use the attribute form, so [dracula.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/dracula.scss) opens with `&[data-converse-theme='dracula'], &[data-bs-theme='dracula']`, nested inside a `.conversejs, converse-bg` block.

Prefer the attribute form for your own theme too. The `converse-bg` element, which paints the background behind the app, is given the attributes but not the class, so a rule written only against `.theme-${name}` will not reach it.

To create your own theme, you can create a similar CSS rule that matches your theme's name and then set the `theme` configuration setting to that name. This CSS rule can be in any CSS file that is loaded in your website, or you can even put it in the DOM as an inline style.

### Creating your first custom theme

Let's create a simple custom theme called "ocean":

1. Create a new CSS file (e.g., `ocean-theme.css`) with the following content:

```css
.conversejs[data-converse-theme='ocean'],
.conversejs[data-bs-theme='ocean'],
converse-bg[data-converse-theme='ocean'],
converse-bg[data-bs-theme='ocean'] {
  color-scheme: light;

  /* The page and the ink on it. Everything else is measured against these. */
  --background-color: #f0f8ff;
  --background-color-rgb: 240, 248, 255;
  --foreground-color: #1c3d5a;

  /* The semantic set, used for buttons, badges and alerts. */
  --primary-color: #0077be;
  --primary-rgb: 0, 119, 190;
  --secondary-color: #00a8cc;
  --secondary-rgb: 0, 168, 204;
  --success-color: #2e8b57;
  --success-color-rgb: 46, 139, 87;
  --danger-color: #c0392b;
  --danger-color-rgb: 192, 57, 43;
  --warning-color: #e0a458;
  --info-color: #00a8cc;
  --info-color-rgb: 0, 168, 204;

  /* Links, and the fill for a selected or open item in a list. */
  --link-color: #005f94;
  --link-color-hover: #004a73;
  --highlight-color: #dbeeff;
  --highlight-color-hover: #c3e0f7;

  /* One accent per kind of conversation. Keep each `-rgb` in step with the
     colour above it: the translucent washes are built from the `-rgb` form. */
  --chat-color: #2e8b57;
  --chat-rgb: 46, 139, 87;
  --muc-color: #e0a458;
  --muc-rgb: 224, 164, 88;
  --headlines-color: #00a8cc;

  /* Quiet text, and the states. */
  --subdued-color: #7f8c8d;
  --disabled-color: #7f8c8d;
  --error-color: #c0392b;
  --focus-color: #00a8cc;
  --heading-color: #0077be;
  --controlbox-color: #0077be;
  --selection-color: #003b5c;
  --chat-status-online: #2e8b57;
  --chat-status-away: #e0a458;
  --chat-status-busy: #c0392b;
  --chat-status-offline: #7f8c8d;
}
```

This is the core of a theme, not all of it. Because nothing falls back to
`classic`, a variable you leave out resolves to nothing and the rules that read
it are simply dropped, so the quickest way to a complete theme is to copy
[classic.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/classic.scss)
and replace the values.

2. Load this CSS file in your HTML:

```html
<link rel="stylesheet" href="path/to/ocean-theme.css">
```

3. Initialize Converse with your theme:

```javascript
converse.initialize({ 
  theme: "ocean"
  // ... other configuration options
});
```

### Declaring whether your theme is light or dark

A few things can't be decided in CSS alone, such as which variant of an image
to load. For those, Converse needs to know whether the theme currently in force
is a light one or a dark one, and your theme says so itself, using the standard
[`color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
property:

```css
.conversejs[data-converse-theme='ocean'] {
  color-scheme: light;

  /* ... your colours ... */
}
```

Use `dark` for a dark theme. The browser reads this too, and will render
scrollbars, form controls and other native widgets to match.

A theme that declares nothing is treated as light. There is no list of theme
names anywhere in Converse, so a third-party theme is on exactly the same
footing as a bundled one.

### Available CSS variables

The variables a theme is most likely to want to set, with the values the
`classic` theme gives them:

| Variable | What it colours | Classic |
|----------|-----------------|---------|
| `--background-color` | The page behind the whole app | `#efefef` |
| `--background-color-rgb` | The same colour as `r, g, b`, for translucent washes | `239, 239, 239` |
| `--foreground-color` | Body text. `--text-color` is an alias and follows it | `#666` |
| `--primary-color` | Primary buttons, the active item in a list | `#387592` |
| `--secondary-color` | Secondary buttons, quiet icons | `#578ea9` |
| `--success-color` | Success buttons and badges | `#3aa569` |
| `--danger-color` | Destructive buttons, danger alerts | `#d24e2b` |
| `--warning-color` | Warning buttons and badges | `#e7a151` |
| `--info-color` | Info alerts, popover headers | `#578ea9` |
| `--link-color` | Links | `#2d3991` |
| `--link-color-hover` | Links under the pointer | `#2d3991` |
| `--highlight-color` | A selected or open item in a list | `#eff4f7` |
| `--highlight-color-hover` | The same, under the pointer | `#eff4f7` |
| `--chat-color` | The 1:1 chat accent | `#1e9652` |
| `--chat-rgb` | The 1:1 accent as `r, g, b` | `58, 165, 105` |
| `--muc-color` | The groupchat accent | `#e77051` |
| `--muc-rgb` | The groupchat accent as `r, g, b` | `231, 161, 81` |
| `--headlines-color` | The headlines (news feed) accent | `#e7a151` |
| `--heading-color` | Section headings | `#578ea9` |
| `--controlbox-color` | The controlbox toggle tile | `#578ea9` |
| `--subdued-color` | Timestamps and other quiet text | `gray` |
| `--disabled-color` | Disabled controls | `gray` |
| `--error-color` | Error text | `#d24e2b` |
| `--focus-color` | The focus ring | `#578ea9` |
| `--selection-color` | The background behind selected text | `black` |
| `--chat-status-online` | The presence dot, online | `#3aa569` |
| `--chat-status-away` | The presence dot, away | `#e7a151` |
| `--chat-status-busy` | The presence dot, busy | `#d24e2b` |
| `--chat-status-offline` | The presence dot, offline | `gray` |

Several variables come in a pair: a colour and an `-rgb` companion holding the
same colour as bare `r, g, b` numbers, because `rgba()` needs it that way to
build a translucent wash. Set both, and keep them in step.

A few more are derived from `--background-color` and `--foreground-color` in
[\_variables.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/_variables.scss),
so your theme gets them without doing anything, and may override them if the
derived value doesn't suit:

| Variable | What it colours | Derived as |
|----------|-----------------|------------|
| `--inset-bg-color` | A surface one step off the page: a disabled field, a quoted reply | 8% of the foreground mixed into the background |
| `--converse-border-color` | Input, list-group, table, nav-tabs and pagination edges | 20% of the foreground mixed into the background |
| `--converse-border-color-translucent` | Dropdown, popover and card edges | The foreground at 18% opacity |
| `--backdrop-shadow` | The edge of a surface sitting on whatever the theme paints behind the app. `none` unless your theme paints something back there | `none` |

For the complete set, check the [classic.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/classic.scss) file.

## Modifying the CSS

To create a new theme with different colors, it should be enough to create a theme file that sets the various CSS variables (as described above).

For other CSS-related changes, you can create specific CSS rules that match the elements you want to change.

Sometimes it might be necessary to modify the core CSS files from Converse, for example if you're developing new features or fixing styling bugs.

The CSS files are generated from [Sass](http://sass-lang.com) files that end in `.scss` and which are distributed throughout the source code.

The CSS that is relevant to a particular plugin is usually inside the `./styles` directory inside the relevant plugin directory.

For example: [src/plugins/controlbox/styles](https://github.com/conversejs/converse.js/tree/master/src/plugins/controlbox/styles).

If you're running `npm run watch` (or `make watch`), then the CSS will automatically be regenerated when you've changed any of the `.scss` files.

You can also manually generate the CSS:

```bash
npm run css
# or for just website CSS:
npm run build:website-css
```

## Modifying the HTML templates of Converse

Converse uses [lit-html](https://lit.dev/docs/libraries/standalone-templates/) as its HTML templating library, and the HTML source code is contained in JavaScript `.js` files in various `./templates` directories in the source code.

Some top-level templates are also in the `./src/templates` directory, but the templates that are relevant to a specific plugin should be inside that plugin's subdirectory.

For example: [src/plugins/chatview/templates](https://github.com/conversejs/converse.js/tree/master/src/plugins/chatview/templates).

You can modify HTML markup that Converse generates by modifying these files.

### Use module resolution to modify templates without changing the original files

Generally, what we recommend when creating a modified version of Converse for a project or customer is to create a new JavaScript package with its own `package.json` and add `converse.js` as a dependency (e.g. via `npm install --save converse.js`) to the `package.json`.

Then you can use your build tool's module resolution features to replace template paths with your own modified files.

For example, if you're using Webpack, you can use [webpack aliases](https://webpack.js.org/configuration/resolve/#resolvealias) to resolve template paths to your own custom templates:

```javascript
// webpack.config.js
resolve: {
    extensions: ['.js'],
    alias: {
      './message-body.js': path.resolve(__dirname, 'path/to/my/custom/message-body.js'),
      './templates/message.js': path.resolve(__dirname, 'path/to/my/custom/chat_message.js'),
    }
}
```

If you're using other build tools like Rollup or Vite, they have similar module resolution features that can be used for the same purpose.

### Best practices for theming

1. **Start with an existing theme**: Copy one of the existing theme files as a starting point rather than creating from scratch.

2. **Use consistent color schemes**: Ensure your color choices are accessible and provide good contrast for readability.

3. **Test in both light and dark modes**: If your theme supports both modes, make sure it looks good in each.

4. **Document your theme**: Include comments in your theme file explaining your color choices and any special considerations.

5. **Keep it simple**: Don't override too many variables at once. Start with primary colors and build from there.

6. **Test across browsers**: Make sure your theme works consistently across different browsers and devices.

7. **Consider accessibility**: Ensure your theme meets accessibility standards, particularly for color contrast.

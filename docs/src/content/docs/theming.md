---
title: Theming
description: How to customize the look and feel of Converse.
---

## Setting up your environment

In order to theme Converse, you first need to follow the steps for [Setting up a Dev Environment](/development/setup-dev-environment/), including the [webserver section](/development/setup-dev-environment/#installing-the-3rd-party-dependencies).

## Creating a custom theme

Converse can be themed via CSS custom properties (aka CSS variables) and comes with several themes available in its source repository.

A theme is a CSS file with a specific rule that defines the theme's CSS properties. The rule has a specific selector that must include (and determines) the theme name.

Inside this CSS rule, various CSS variables are assigned values. The CSS variables mainly refer to the colors that comprise the theme. If you don't specify a value for a specific CSS variable, then the value from the `classic` theme is used, as defined in [classic.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/classic.scss).

The native theme files can be found in [shared/styles/themes](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes).

Note: The Converse theme files have a `.scss` extension because they are compiled by the Sass compiler into normal CSS files. However, it's not necessary to use Sass - basic CSS files will also work.

The theme that Converse uses can be set via the [`theme`](/configuration/#theme) configuration setting (and the [`dark_theme`](/configuration/#dark_theme) configuration setting for dark mode).

### How are themes applied?

When you set a value for the [`theme`](/configuration/#theme) configuration setting, Converse will add a class `theme-${api.settings.get('theme')}` on the `converse-root` DOM element.

So, for example, if you set the `theme` setting to `"dracula"`, then the `converse-root` element will get the class `theme-dracula`.

```javascript
converse.initialize({ theme: "dracula" });
```

```html
<converse-root class="conversejs theme-dracula"></converse-root>
```

To apply a theme, there needs to be a CSS rule with a selector that matches the `theme-dracula` class on the `converse-root` element.

If you take a look at the theme file [dracula.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/dracula.scss), you'll see that it defines a CSS rule with the selector `.conversejs.theme-dracula`.

This selector matches any DOM element with both the classes `.conversejs` and `.theme-dracula`. The `converse-root` element will already have the class `.conversejs` and it will have the class `.theme-dracula` if the `theme` (or `dark_theme` in dark mode) configuration setting is set to `"dracula"`.

This is how themes are applied - by defining a CSS selector that matches the class `.theme-${name}` (where `name` is a variable containing the name of the theme), and then setting the `theme` (and/or `dark_theme`) configuration setting.

To create your own theme, you can create a similar CSS rule that matches your theme's name and then set the `theme` configuration setting to that name. This CSS rule can be in any CSS file that is loaded in your website, or you can even put it in the DOM as an inline style.

### Creating your first custom theme

Let's create a simple custom theme called "ocean":

1. Create a new CSS file (e.g., `ocean-theme.css`) with the following content:

```css
.conversejs.theme-ocean {
  /* Primary colors */
  --brand-primary: #0077be;
  --brand-secondary: #00a8cc;
  
  /* Background colors */
  --background: #f0f8ff;
  --background-light: #ffffff;
  --background-dark: #e6f3ff;
  
  /* Text colors */
  --text-color: #333333;
  --text-color-light: #666666;
  
  /* Accent colors */
  --success-color: #28a745;
  --warning-color: #ffc107;
  --error-color: #dc3545;
}
```

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

### Available CSS variables

Here are the most commonly used CSS variables you can customize in your theme:

| Variable | Description | Default (Classic Theme) |
|----------|-------------|------------------------|
| `--brand-primary` | Primary brand color | `#337ab7` |
| `--brand-secondary` | Secondary brand color | `#5cb85c` |
| `--background` | Main background color | `#ffffff` |
| `--background-light` | Light background color | `#f5f5f5` |
| `--background-dark` | Dark background color | `#e0e0e0` |
| `--text-color` | Main text color | `#212121` |
| `--text-color-light` | Light text color | `#757575` |
| `--success-color` | Success state color | `#5cb85c` |
| `--warning-color` | Warning state color | `#f0ad4e` |
| `--error-color` | Error state color | `#d9534f` |
| `--link-color` | Link color | `#337ab7` |
| `--border-color` | Border color | `#ddd` |

For a complete list of available variables, check the [classic.scss](https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/classic.scss) file.

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

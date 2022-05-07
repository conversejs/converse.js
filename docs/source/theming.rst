.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _theming:

=======
Theming
=======

Setting up your environment
===========================

In order to theme Converse, you first need to follow the steps for :ref:`setup_dev_environment`, including :ref:`webserver`.

Creating a custom theme
=======================

Converse can be themed via CSS custom properties (aka CSS variables) and it has
some themes available in its source repository.

A theme is a CSS file with a specific rule that defines the theme's CSS properties.
The rule has a specific selector that must include (and determines) the theme name.

Inside this CSS rule, various CSS variables are assigned values.
The CSS variables mainly refer to the colors that comprise the theme.
If you don't specify a value for a specific CSS variable, then the value from
the ``classic`` theme is used, as defined in `classic.scss <https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/classic.scss>`_.

The native theme files can be found in `shared/styles/themes <https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes>`_.

Note, the Converse theme files have a ``.scss`` extension because they are compiled
by the Sass compiler into normal CSS files. It's however not necessary to use
Sass, basic CSS files will also suffice.

The theme that Converse uses can be set via the :ref:`theme` configuration
setting (and the :ref:`dark_theme` configuration setting for dark mode).

How are themes applied?
-----------------------

When you set a value for the :ref:`theme` configuration setting, Converse will add
a class ``theme-${api.settings.get('theme')}`` on the ``converse-root`` DOM
element.

So, for example, if you set the ``theme`` setting to ``"dracula"``, then the
``converse-root`` element will get the class ``theme-dracula``.

.. code-block:: javascript

    converse.initialize({ theme: "dracula" });


.. code-block:: html

    <converse-root class="conversejs theme-dracula"></converse-root>


The apply a theme, there then needs to be a CSS rule with a selector that matches the
``theme-dracula`` class on the ``converse-root`` element.

If you take a look at the theme file `dracula.scss <https://github.com/conversejs/converse.js/tree/master/src/shared/styles/themes/dracula.scss>`_
you'll see that it defines a CSS rule with the selector
``.conversejs.theme-dracula``.

This selector matches any DOM element with both the classes ``.conversejs`` and
``.theme-dracula``. The ``converse-root`` element will already have the class
``.conversejs`` and it will have the class ``.theme-dracula`` if the ``theme``
(or ``dark_theme`` in dark mode) configuration setting is set to ``"dracula"``.

This is how themes are applied, by defining a CSS selector that matches the
class ``.theme-${name}`` (where ``name`` is a variable containing the name of
the theme), and then setting the ``theme`` (and/or ``dark_theme``) configuration
setting.

To create your own theme, you can create a similar CSS rule that matches
your theme's name and then you set the ``theme`` configuration setting to that
name. This CSS rule can be in any CSS file that is loaded in your website, or
you can even put it in the DOM as an inline style.

Modifying the CSS
=================

To create a new theme with different colors, it should be enough to create a
theme file that sets the various CSS variables (as described above).

For other CSS-related changes, you can make a specific
CSS rule with that matches the element you want to change.

Sometimes it might however be neccessary to modify the core CSS files from
Converse, for example if you're developing new features or fixing styling bugs.

The CSS files are generated from `Sass <http://sass-lang.com>`_ files that end in ``.scss`` and
which are distributed throughout the source code.

The CSS that is relevant to a particular plugin
is usually inside the ``./styles`` directory inside the relevant plugin directory.

For example: `src/plugins/controlbox/styles <https://github.com/conversejs/converse.js/tree/master/src/plugins/controlbox/styles>`_.

If you're running ``make watch``, then the CSS will automatically be
regenerated when you've changed any of the ``.scss``.

You can also manually generate the CSS::

    make css

Modifying the HTML templates of Converse
========================================

Converse uses `lit-html <https://lit.dev/docs/libraries/standalone-templates/>`_ as HTML
templating library, and the HTML source code is contained in JavaScript ``.js``
files in various ``./template`` directories in the source code.

Some top-level templates are also in the ``./src/templates`` directory, but
the templates that are relevant to a specific plugin should be inside that plugin's subdirectory.

For example: `src/plugins/chatview/templates <https://github.com/conversejs/converse.js/tree/master/src/plugins/chatview/templates>`_.

You can modify HTML markup that Converse generates by modifying these files.

Use webpack aliases to modify templates without changing the original files
---------------------------------------------------------------------------

Generally what I do when creating a modified version of Converse for a project
or customer, is that I create a new JavaScript package with its own
``package.json`` and I then add ``converse.js`` as a dependency (e.g. via ``npm
install --save converse.js``) to the ``package.json``.

Then I add a Webpack configuration and use `webpack aliases <https://webpack.js.org/configuration/resolve/#resolvealias>`_
to resolve template paths to my own modified files.

For example, in the webpack configuration snippet below, I add two aliases, so
that the ``message-body.js`` and ``message.js`` templates can be replaced with
two of my own custom templates.

.. code-block:: javascript

    resolve: {
        extensions: ['.js'],
        alias: {
        './message-body.js': path.resolve(__dirname, 'path/to/my/custom/message-body.js'),
        './templates/message.js': path.resolve(__dirname, 'path/to/my/custom/chat_message.js'),
        }
    }

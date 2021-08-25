.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _theming:

=======
Theming
=======

Setting up your environment
===========================

In order to theme Converse, you first need to set up a :ref:`development` environment
and then you'll also want to follow the guide to :ref:`webserver`.

Modifying the HTML templates of Converse
========================================

Converse uses `lit-html <https://lit-html.polymer-project.org/guide>`_ as HTML
templating library, and the HTML source code is contained in JavaScript ``.js``
files in various ``./template`` directories in the source code.

Some top-level templates are found in the ``./src/templates`` directory, but
usually the templates that are relevant to a specific plugin will be find
inside that plugin's subdirectory.

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

Modifying the CSS
=================

The CSS files are generated from `Sass <http://sass-lang.com>`_ files that end in ``.scss`` and
which are distributed throughout the source code.

Similarly to the template files, the CSS that is relevant to a particular plugin
is usually inside the ``./styles`` directory inside the relevant plugin
directory.

For example: `src/plugins/controlbox/styles <https://github.com/conversejs/converse.js/tree/master/src/plugins/controlbox/styles>`_.

To generate the CSS you can run::

    make css

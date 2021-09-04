.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/webserver.rst">Edit me on GitHub</a></div>


.. _`webserver`:

Setting up a webserver
======================

When making changes to Converse, either development or theming changes,
you'll want to preview them in your browser.

For this, you'll need to serve the development files via a web server,
so that you can see your local changes in the browser.

Manually starting a web server
------------------------------

To both set up the development environment and also start up a web browser to
serve the files for you, you can run::

    make serve

.. note::
    To run the "make" commands, you'll need `GNUMake <https://www.gnu.org/software/make>`_
    installed on your computer. If you use GNU/Linux or \*BSD, it should be installed or
    available via your package manager. For Mac, you'll need to install XCode and in
    Windows you can use `Chocolatey <https://chocolatey.org/>`_.

After running ``make serve`` you can open http://localhost:8000 in your webbrowser to see the Converse website.

When developing or changing the theme, you'll want to load all the
unminified JS and CSS resources as separate files. To do this, open http://localhost:8000/dev.html instead.

You might want to open `dev.html <https://github.com/conversejs/converse.js/blob/master/dev.html>`_ in your text editor or IDE as well, to see
how ``converse.initialize`` is called and to potentially change any of the
settings.

If you're running ``make devserver``, you need to open http://localhost:8080
instead.

Starting a web server with live reloading
-----------------------------------------

Alternatively, if you want to have live reloading whenever any of the source files change, you
can run ``make devserver`` (which will use `webpack-dev-server <https://github.com/webpack/webpack-dev-server>`_).

Instead of ``dev.html`` being used, `webpack.html <https://github.com/conversejs/converse.js/blob/master/webpack.html>`_
is now being used as the HTML template, and you'll need to modify that file if
you want to change the settings passed to ``converse.initialize``.

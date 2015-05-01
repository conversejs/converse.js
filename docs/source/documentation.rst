.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/documentation.rst">Edit me on GitHub</a></div>

=====================
Writing Documentation
=====================

.. contents:: Table of Contents
   :depth: 2
   :local:

.. note:: Contributions to the documentation are much appreciated.

What is used to write the documentation
=======================================

This documentation is written in `Sphinx <http://sphinx-doc.org/>`_, a
documentation generator written in `Python <http://python.org>`_.

The documentation is written in `reStructuredText (reST) <http://sphinx-doc.org/rest.html>`_, 
a very easy to write plain text format, relatively similar to Markdown.

So see what the source looks like, click the **Source** link in the footer of
this page.

Where is the documentation
==========================

The reST documentation files are located in the
`converse.js code repository <https://github.com/jcbrand/converse.js/tree/master/docs/source>`_
under ``docs/source``.

How to generate HTML from the source files
==========================================

Install Dependencies
--------------------

In order to generate HTML from the source files, you need to have Sphinx and
the `Sphinx Bootstrap Theme <http://ryan-roemer.github.io/sphinx-bootstrap-theme>`_
installed.

We use `zc.buildout <http://www.buildout.org/en/latest/>`_ to install Sphinx
and the theme.

To install Sphinx, do the following::

    python bootstrap.py
    ./bin/buildout

Generate the HTML
-----------------

After installing the dependencies, you can generate the HTML by simply
running::

    make html

The HTMl files will be located in ``./docs/html``

.. warning:: When contributing, please don't commit any generated html files.

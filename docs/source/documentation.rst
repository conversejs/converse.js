.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/documentation.rst">Edit me on GitHub</a></div>

=====================
Writing Documentation
=====================

.. note:: Contributions to the documentation are much appreciated.

What is used to write the documentation?
========================================

This documentation is written in `Sphinx <http://sphinx-doc.org/>`_, a
documentation generator written in `Python <http://python.org>`_.

The documentation is written in `reStructuredText (reST) <http://sphinx-doc.org/rest.html>`_, 
a very easy to write plain text format, relatively similar to Markdown.

So see what the source looks like, click the **Source** link in the footer of
this page.

Where is the documentation?
===========================

The reST documentation files are located in the
`converse.js code repository <https://github.com/jcbrand/converse.js/tree/master/docs/source>`_
under ``docs/source``.

How to generate HTML from the source files?
===========================================

Generate the HTML
-----------------

After installing the dependencies, you can generate the HTML by running::

    make html

The HTMl files will be located in ``./docs/html``

What ``make html`` does for you is it installs `zc.buildout <http://www.buildout.org/en/latest/>`_
which is used to install Sphinx and all its dependencies.

You'll need to have Python and `Virtualenv <https://virtualenv.pypa.io/en/latest/>`_ available on your computer.

.. warning:: When contributing, please don't commit any generated html files.

Serving the documentation
-------------------------

To view the generated docs, you can run ``make serve`` and then open
http://localhost:8000/docs/html/index.html in your browser.



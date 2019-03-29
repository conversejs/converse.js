.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/development.rst">Edit me on GitHub</a></div>

.. _development:

===========
Development
===========

Welcome to the developer documentation of Converse.

Read the documentation linked to below, if you want to add new features or
create your own customized version of Converse.

Converse has a plugin architecture (see `pluggable.js <https://github.com/jcbrand/pluggable.js/>`_)
which lets you add new features or modify existing functionality without having to touch
the core files (in the `src/ <https://github.com/conversejs/converse.js/tree/master/src>`_ directory).
This is the recommended way to customize or add new functionality to Converse.

Plugins are especially useful if you want to add proprietary modifications, since the
Mozilla Public License version 2 doesn't require you to open source your
plugins. Be aware that this doesn't apply when you intend to use libsignal for
OMEMO encryption because libsignal's license is GPLv3.

Refer to the section on `plugin development <https://conversejs.org/docs/html/plugin_development.html>`_
for more info on how to write plugins.

Converse is a community project and largely volunteer driven.

We're grateful for your contributions, so please don't hesitate to 
make a `Github pull request <https://help.github.com/categories/collaborating-with-issues-and-pull-requests/>`_
to fix a bug or to add new functionality.


.. toctree::
   :maxdepth: 2

   dependencies
   style_guide
   plugin_development
   api/index
   testing
   other_frameworks
   builds

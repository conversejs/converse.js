Automated tests
===============

Converse uses the `Jasmine <https://jasmine.github.io/>`_ testing framework for
writing tests.

Tests are run in a browser, either manually or automatically via Chrome
headless.

Adding tests for your bugfix or feature
----------------------------------------

Take a look at `tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
and the `spec files <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
to see how tests are implemented.

Running tests
-------------

Check that all tests complete sucessfully.

Run ``make check`` in your terminal.

To run the tests manually, run ``make serve`` and then open `http://localhost:8000/tests <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_ in your browser.

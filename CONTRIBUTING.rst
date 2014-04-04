=======================
Contribution Guidelines
=======================

Thanks for contributing to `Converse.js <http://conversejs.org>`_.

Support questions
=================
Please ask support and setup questions on the mailing list: conversejs@librelist.com

The issue tracker is only for bugs (i.e. issues) and feature requests.

Contributing Code
=================
Please follow the usual github workflow. Create your own local fork of this repository,
make your changes and then submit a pull request.

Before submitting a pull request
--------------------------------

Add tests for your bugfix or feature
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Add a test for any bug fixed or feature added. We use Jasmine
for testing. 

Take a look at `tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
and the `spec files <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
to see how tests are implemented.

Check that the tests pass
~~~~~~~~~~~~~~~~~~~~~~~~~
Check that the Jasmine tests complete sucessfully. Open
`tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
in your browser, and the tests will run automatically.

Check your code for errors or bad habits by running JSHint
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
If you haven't yet done so, run ``npm install`` to install all development
dependencies.

Then run ``grunt jshint`` and check the output.

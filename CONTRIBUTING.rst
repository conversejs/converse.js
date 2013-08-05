===========================
Contributing to Converse.js
===========================

Thanks for contributing to Converse.js_.

Please follow the usual github workflow. Create your own local fork of this repository,
make your changes and then submit a pull request.

Before submitting a pull request
================================

Add tests for your bugfix or feature
------------------------------------

Add a test for any bug fixed or feature added. We use Jasmine
for testing. 

Take a look at ``tests.html`` and ``spec/MainSpec.js`` to see how
the tests are implemented.

If you are unsure how to write tests, please `contact me`_ and I'll be happy to
help.

Check that the tests pass
-------------------------

Check that the Jasmine tests complete sucessfully. Open tests.html in your
browser, and the tests will run automatically.

On the command line you can run ``grunt test`` (if you have before run ``npm
install``).

Check your code for errors or bad habits by running JSHint
----------------------------------------------------------

If you haven't yet done so, run ``npm install`` to install all development
dependencies.

Then run ``grunt jshint`` and check the output.

.. _Converse.js: http://conversejs.org
.. _`contact me`: http://opkode.com/contact.html

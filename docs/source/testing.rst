Automated tests
===============

Converse uses the `Karma <https://karma-runner.github.io/latest/index.html>`_ test runner and
`Jasmine <https://jasmine.github.io/>`_ testing library for running tests.

In addition, we use `ESlint <https://eslint.org/>`_ to run a static analysis (aka
linting) of the source files and report errors.

Whenever a commit is pushed to the Converse Github repo, all ESlint checks and
Jasmine tests are run on `Travis CI <https://travis-ci.org/github/conversejs/converse.js>`_.

Running tests
-------------

You can run ESlint by typing ``make eslint``. Similarly the tests can be run via ``make tests``.

To run both eslint and the tests, you can use ``make check``.

When running ``make test`` or ``make check``, a browser will automatically
start up, open a tab at http://localhost:9876 and start running the tests.

You'll see a green bar at the top of the page, and on the right inside it is a ``Debug`` button.

It's often helpful to click that button and run the tests in debug mode. This
way, you see better error output for failed tests.

Automatically run tests on file changes
***************************************

To automatically run the tests whenever you make a change to any of the
Converse source code, you can run ``make watch`` in one terminal, and ``make tests`` in another.

``make watch`` will build development bundles of Converse (in ``dist/converse.js`` and ``dist/converse.css``)
and automatically rebuild them whenever a source file is modified.

Similarly, Karma will make sure that the tests are re-executed when the bundle files are rebuilt.

Running individual tests
************************

Converse has over 400 tests, and it can take a while to run through all of them.

When developing on Converse, it's often preferable to have a more rapid
turnaround time between editing a file and checking whether the most relevant
tests have passed.

Jasmine tests are described by `it` functions and the tests names are written to
be read as plain English sentences that start with the word ``it``.

For example:

.. code-block:: javascript

    it("is rejected if it's an unencapsulated forwarded message",

Tests are grouped by `describe` functions, and contained in spec files inside
the `spec <https://github.com/jcbrand/converse.js/blob/master/spec/>`_ directory.

To run only a single test, you can replace ``it(`` with ``fit(`` for the particular
test that you want to run. You can also do this for multiple tests. All of them
will be run whenever ``make test`` executes.

To run only a group of tests, you can similarly replace ``describe(`` with ``fdescribe``.

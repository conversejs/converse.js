.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

Software Style Guide
====================

Most of the style guide recommendations here come from Douglas Crockford's book
`JavaScript, the good parts <http://shop.oreilly.com/product/9780596517748.do>`_

Tabs or spaces?
---------------

We always indent 4 spaces. Proper indentation is important for readability.

Underscores or camelCase?
-------------------------

We use camelCase for function names and underscores for variables names.

For example:

.. code-block:: javascript 

    function thisIsAFunction () {
        var this_is_a_variable;
        ...
    }

Spaces around operators
-----------------------

In general, spaces are put around operators, such as the equals ``=`` or plus ``+`` signs.

For example:

.. code-block:: javascript 

    if (sublocale != locale) {
        // do something
    }

An exception is when they appear inside for-loop expressions, for example:

.. code-block:: javascript 

    for (i=0; i<msgs_length; i++) {
        // do something
    }

Generally though, rather err on the side of adding spaces, since they make the
code much more readable.

Constants are written in ALL_CAPS
---------------------------------

Identifiers that denote constant values should be written in
all capital letters, with underscores between words.

For example:

.. code-block:: javascript 

    var SECONDS_IN_HOUR = 3600;
    var seconds_since_message = 0;


Function declaration and invocation
-----------------------------------

When declaring a function, the function name and the brackets after it are separated
with a space. Like so:

.. code-block:: javascript 

    function update (model) {
        model.foo = 'bar';
    }

When calling the same function, the brackets are written without a space in
between:

.. code-block:: javascript 

    update(model);

This is to make a more explicit visual distinction between method declarations
and method invocations.

Checking for equality
---------------------

JavaScript has a strict ``===`` and less strict ``==`` equality operator. The
stricter equality operator also does type checking. To avoid subtle bugs when
doing comparisons, always use the strict equality check.

Curly brackets
--------------

Curly brackets must appear on the same lines as the ``if`` and ``else`` keywords.
The closing curly bracket appears on its own line.

For example:

.. code-block:: javascript 

    if (locales[locale]) {
        return locales[locale];
    } else {
        sublocale = locale.split("-")[0];
        if (sublocale != locale && locales[sublocale]) {
            return locales[sublocale];
        }
    }

Always enclose blocks in curly brackets
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When writing a block such as an ``if`` or ``while`` statement, always use
curly brackets around that block of code. Even when not strictly required by
the compiler (for example if its only one line inside the ``if`` statement).

For example, like this:

.. code-block:: javascript 

    if (condition === true) {
        this.updateRoomsList();
    }
    somethingElse();

and NOT like this:

.. code-block:: javascript

    if (converse.auto_list_rooms)
        this.updateRoomsList();
    somethingElse();

This is to aid in readability and to avoid subtle bugs where certain lines are
wrongly assumed to be executed within a block.

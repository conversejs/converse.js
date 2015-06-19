Software Style Guide
====================

.. note:: Converse.js doesn't yet use any of the new `ES2015
    <https://babeljs.io/docs/learn-es2015/>`_ features, because we don't
    rely on a transpiler and still support older browsers.

Most of the style guide recommendations here come from Douglas Crockford's book
"Javascript, the good parts".

This style guide is fairly opinionated. Some of these opinions perhaps don't
conform to your expectations on how Javascript code should look like.
I apologize for that. However, for the sake of sanity, consistency and having
code that is pleasing to the eye, please stick to these guidelines.

Tabs or spaces?
---------------

We always indent 4 spaces. Proper indentation is very important for readability.

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

Javascript has a strict ``===`` and less strict ``==`` equality operator. To
avoid subtle bugs when doing comparisons, always use the strict equality check.

Curly brackets
--------------

Curly brackets come on the same lines as the ``if`` and ``else`` keywords.

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

When writing an a block such as an ``if`` or ``while`` statement, always use
curly brackets around the block of code. Either when not strictly required by
the compiler.

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

Software Style Guide
====================

.. note:: Converse.js currently does not use any of the new ES6 or ES7 features.
    We don't use a transpiler and still support older browsers, so we only use ES5.

Most of the style guide recommendations here come from Douglas Crockford's book
"Javascript, the good parts".

This style guide is fairly opinionated. Some of these opinions perhaps don't
conform to your expectations on how Javascript should be written.
I apologize for that. However, for the sake of sanity, consistency and having
code that is pleasing to the eye, please stick to these guidelines.

Tabs or spaces?
---------------

We always indent 4 spaces.

Proper indentation is very important for harmonious looking code.
Poor indentation is distracting and causes irritation. When one is distracted and
irritated, one is not in the relaxed, focused state of mind required for doing quality work.

Underscores or camelCase?
-------------------------

We use camelCase for function names and underscores for variables names.

For example:

.. code-block:: javascript 

    function thisIsAFunction () {
        var this_is_a_variable;
        ...
    }

Constants are written in ALL CAPS
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

Always enclose blocks in curly brackets
---------------------------------------

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

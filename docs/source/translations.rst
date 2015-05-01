.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/translations.rst">Edit me on GitHub</a></div>

============
Translations
============

.. contents:: Table of Contents
   :depth: 2
   :local:

.. note::
   Translations take up a lot of space and will bloat your minified file.
   At the time of writing, all the translations add about 50KB of extra data to
   the minified javascript file. Therefore, make sure to only
   include those languages which you intend to support and remove from
   ./src/locales.js those which you don't need. Remember to rebuild the
   minified file afterwards, by running `make build`.

----------------------------------------------
Updating the translations template (.pot file)
----------------------------------------------

The gettext `.pot` file located in
`./locale/converse.pot <https://github.com/jcbrand/converse.js/blob/master/locale/converse.pot>`_
is the template containing all translations and from which for each language an individual PO
file is generated.

The `.pot` file contains all translateable strings extracted from converse.js.

To make a user-facing string translateable, wrap it in the double underscore helper
function like so:

.. code-block:: javascript

    __('This string will be translated at runtime');

After adding the string, you'll need to regenerate the POT file:

::

    make pot


-------------------------------------------
Making translations file for a new language
-------------------------------------------

To create a new translations file for a language in which converse.js is not yet
translated into, do the following

.. note:: In this example we use Polish (pl), you need to substitute 'pl' to your own language's code.

::

    mkdir -p ./locale/pl/LC_MESSAGES
    msginit -i ./locale/converse.pot -o ./locale/pl/LC_MESSAGES/converse.po -l pl

Please make sure to add the following attributes at the top of the file (under
*Content-Transfer-Encoding*). They are required as configuration settings for Jed,
the Javascript translations library that we're using.

.. code-block:: po

    "domain: converse\n"
    "lang: pl\n"
    "Content-Type: text/plain; charset=UTF-8\n"
    "plural_forms: nplurals=2; plural=(n != 1);\n"

--------------------------------------
Updating an existing translations file
--------------------------------------

You can update the `.po` file for a specific language by doing the following:

.. note:: In this example we use German (de), you need to substitute 'de' to your own language's code.

::

    msgmerge ./locale/de/LC_MESSAGES/converse.po ./locale/converse.pot -U

To do this for ALL languages, run:

::

    make po

The resulting `.po` file is then what gets translated.


-----------------------------------------------------
Generating a Javascript file from a translations file
-----------------------------------------------------

Unfortunately `Jed <http://slexaxton.github.io/Jed>`_, which we use for
translations in converse.js cannot use the `.po` files directly. We have
to generate from it a file in JSON format and then put that in a `.js` file
for the specific language.

To generate JSON from a PO file, you'll need po2json for node.js. Run the
following command to install it (npm being the node.js package manager):

::

    npm install po2json

You can then convert the translations into JSON format:

::

    po2json -p -f jed -d converse locale/de/LC_MESSAGES/converse.po locale/de/LC_MESSAGES/converse.json

To do this for ALL languages, run:

::

    make po2json


.. note::
    If you are adding translations for a new language that is not already supported,
    you'll have to add the language path in main.js and make one more edit in ./src/locales.js
    to make sure the language is loaded by require.js.

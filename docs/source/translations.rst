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
   include those languages that you intend to support and remove from
   ./locale/locales.js those which you don't need. Remember to rebuild the
   minified file afterwards.

The gettext POT file located in ./locale/converse.pot is the template
containing all translations and from which for each language an individual PO
file is generated.

The POT file contains all translateable strings extracted from converse.js.

To make a user facing string translateable, wrap it in the double underscore helper
function like so:

.. code-block:: javascript

    __('This string will be translated at runtime');

After adding the string, you'll need to regenerate the POT file, like so:

::

    make pot

To create a new PO file for a language in which converse.js is not yet
translated into, do the following

.. note:: In this example we use Polish (pl), you need to substitute 'pl' to your own language's code.

::

    mkdir -p ./locale/pl/LC_MESSAGES
    msginit -i ./locale/converse.pot -o ./locale/pl/LC_MESSAGES/converse.po -l pl

You can then create or update the PO file for a specific language by doing the following:

.. note:: In this example we use German (de), you need to substitute 'de' to your own language's code.

::

    msgmerge ./locale/de/LC_MESSAGES/converse.po ./locale/converse.pot -U

To do this for ALL languages, run:

::

    make po

The resulting PO file is then what gets translated.

If you've created a new PO file, please make sure to add the following
attributes at the top of the file (under *Content-Transfer-Encoding*). They are
required as configuration settings for Jed, the Javascript translations library
that we're using.

.. code-block:: po

    "domain: converse\n"
    "lang: de\n"
    "plural_forms: nplurals=2; plural=(n != 1);\n"


Unfortunately `Jed <http://slexaxton.github.io/Jed>`_ cannot use the PO files directly. We have to generate from it
a file in JSON format and then put that in a .js file for the specific
language.

To generate JSON from a PO file, you'll need po2json for node.js. Run the
following command to install it (npm being the node.js package manager):

::

    npm install po2json

You can then convert the translations into JSON format:

::

    po2json locale/de/LC_MESSAGES/converse.po locale/de/LC_MESSAGES/converse.json

Now from converse.json paste the data as a value for the "locale_data" key in the
object in the language's .js file.

So, if you are for example translating into German (language code 'de'), you'll
create or update the file ./locale/LC_MESSAGES/de.js with the following code:

.. code-block:: javascript 

    (function (root, factory) {
        define("de", ['jed'], function () {
            return factory(new Jed({
                "domain": "converse",
                "locale_data": {
                    // Paste the JSON data from converse.json here
                }
            })
        }
    }(this, function (i18n) {
        return i18n;
    }));

making sure to also paste the JSON data as value to the "locale_data" key.

.. note::
    If you are adding translations for a new language that is not already supported,
    you'll have to add the language path in main.js and make one more edit in ./locale/locales.js
    to make sure the language is loaded by require.js.

Congratulations, you've now succesfully added your translations. Sorry for all
those hoops you had to jump through.

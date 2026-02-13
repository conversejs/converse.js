---
title: Translations
description: How to add or update translations for Converse.
---

Converse supports localization of its user interface and date formats. As
of writing, 46 languages are supported.

The translations of Converse can be found in the [src/i18n](https://github.com/conversejs/converse.js/tree/master/src/i18n/) directory.

Translations of Converse are very welcome. You can add translations either
manually by editing the `.po` files in the `src/i18n/locales`
directory, or through the web at [Weblate](https://hosted.weblate.org/projects/conversejs/#languages).

As of version 3.3.0, Converse no longer automatically bundles translations
in its source file and instead fetches only the relevant locale for the current
session from a URL as specified by the [`assets_path`](/configuration/#assets_path) setting.

There are three configuration settings relevant to translations and
localisation. You're encouraged to read the documentation for each of them.

- [`i18n`](/configuration/#i18n)
- [`locales`](/configuration/#locales)
- [`assets_path`](/configuration/#assets_path)

## Manually updating translations

If you simply want to add a few missing translations, then consider doing it
through the web at [Weblate](https://hosted.weblate.org/projects/conversejs/#languages).

Some things however cannot be done via Weblate and instead have to be done
manually in a checkout of the Converse source repository.

These tasks are documented below.

### Updating the global translations template (.pot file)

The gettext `.pot` file located in
[./locale/converse.pot](https://github.com/conversejs/converse.js/blob/master/src/i18n/converse.pot)
is the template containing all translations and from which for each language an individual PO
file is generated.

The `.pot` file contains all translatable strings extracted from Converse.

To make a user-facing string translatable, wrap it in the double underscore helper
function like so:

```javascript
const { __ } = _converse.i18n.env;
const str = __('This string will be translated at runtime');
```

After adding the string, you'll need to regenerate the POT file:

```
make pot
```

### Making a translations file for a new language

To create a new translations file for a language in which Converse is not yet
translated into, do the following:

:::note
In this example we use Polish (pl), you need to substitute 'pl' with your own language's code.
:::

```
mkdir -p ./src/i18n/locales/pl/LC_MESSAGES
msginit -i ./src/i18n/converse.pot -o ./src/i18n/locales/pl/LC_MESSAGES/converse.po -l pl
```

Please make sure to add the following attributes at the top of the file (under
*Content-Transfer-Encoding*). They are required as configuration settings for Jed,
the JavaScript translations library that we're using.

```po
"domain: converse\n"
"lang: pl\n"
"Content-Type: text/plain; charset=UTF-8\n"
"plural_forms: nplurals=2; plural=(n != 1);\n"
```

### Updating an existing translations file

You can update the `.po` file for a specific language by doing the following:

:::note
In this example we use German (de), you need to substitute 'de' with your own language's code.
:::

```
msgmerge ./src/i18n/locales/de/LC_MESSAGES/converse.po ./src/i18n/converse.pot -U
```

To do this for ALL languages, run:

```
make po
```

The resulting `.po` file is then what gets translated.

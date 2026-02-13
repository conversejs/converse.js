---
title: Software Style Guide
description: Coding conventions and style guide for Converse development.
---

Most of the style guide recommendations here come from Douglas Crockford's book
[JavaScript, the good parts](http://shop.oreilly.com/product/9780596517748.do).

## Tabs or spaces?

We always indent 4 spaces.

## Underscores or camelCase?

We use camelCase for function names and underscores for variable names.

For example:

```javascript
function thisIsAFunction () {
    let this_is_a_variable;
    ...
}
```

## const versus let

Try to use `const` whenever possible. If a variable won't be reassigned, use
`const`, otherwise use `let`.

## Spaces around operators

In general, spaces are put around operators, such as the equals `=` or plus `+` signs.

For example:

```javascript
if (sublocale != locale) {
    // do something
}
```

An exception is when they appear inside for-loop expressions, for example:

```javascript
for (i=0; i<msgs_length; i++) {
    // do something
}
```

Generally though, rather err on the side of adding spaces, since they make the
code much more readable.

## Destructuring

When assigning to a variable via destructuring, add spaces between the curly
brackets.

For example:

```javascript
const { foo } = bar;
```

## Global constants are written in ALL_CAPS

Global identifiers that denote constant values should be written in
all capital letters, with underscores between words.

For example:

```javascript
const SECONDS_IN_HOUR = 3600;

function update () {
    const timeout = 20;
    let seconds_since_message = 0;
    // other stuff here
}
```

## Function declaration and invocation

When declaring a function, the function name and the brackets after it are separated
with a space. Like so:

```javascript
function update (model) {
    model.foo = 'bar';
}
```

When calling the same function, the brackets are written without a space in
between:

```javascript
update(model);
```

This is to make a more explicit visual distinction between method declarations
and method invocations.

## Checking for equality

JavaScript has a strict `===` and less strict `==` equality operator. The
stricter equality operator also does type checking. To avoid subtle bugs when
doing comparisons, always use the strict equality check.

## Curly brackets

Curly brackets must appear on the same lines as the `if` and `else` keywords.
The closing curly bracket appears on its own line.

For example:

```javascript
if (locales[locale]) {
    return locales[locale];
} else {
    sublocale = locale.split("-")[0];
    if (sublocale != locale && locales[sublocale]) {
        return locales[sublocale];
    }
}
```

### Always enclose blocks in curly brackets

When writing a block such as an `if` or `while` statement, always use
curly brackets around that block of code. Even when not strictly required by
the compiler (for example if its only one line inside the `if` statement).

For example, like this:

```javascript
if (condition === true) {
    this.updateRoomsList();
}
somethingElse();
```

and NOT like this:

```javascript
if (converse.auto_list_rooms)
    this.updateRoomsList();
somethingElse();
```

This is to aid in readability and to avoid subtle bugs where certain lines are
wrongly assumed to be executed within a block.

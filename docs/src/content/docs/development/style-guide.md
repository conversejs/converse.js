---
title: Software Style Guide
description: Coding conventions and style guide for Converse development.
---

Converse uses [Prettier](https://prettier.io/) to enforce a consistent code style
across the codebase. The configuration lives in `.prettierrc` at the project root.

Run Prettier on your changes before committing:

```bash
npx prettier --write src/path/to/file.js
```

Many of the conventions below are enforced by Prettier automatically. Where Prettier
doesn't cover something (naming conventions, architectural patterns), the rules below
apply.

## Prettier configuration

Our Prettier settings:

| Setting | Value |
|---------|-------|
| `tabWidth` | 4 spaces |
| `useTabs` | `false` (spaces, not tabs) |
| `singleQuote` | `true` |
| `printWidth` | 120 |
| `spaceBeforeFunctionParen` | `true` |
| `bracketSpacing` | `true` |

## Naming conventions

### Variables and functions

We use `snake_case` for variable names and `camelCase` for function names.

```javascript
function thisIsAFunction () {
    let this_is_a_variable;
    ...
}
```

### Classes

Use `PascalCase` for class names.

### Constants

Global identifiers that denote constant values should be written in
`UPPER_CASE`, with underscores between words.

```javascript
const SECONDS_IN_HOUR = 3600;

function update () {
    const timeout = 20;
    let seconds_since_message = 0;
}
```

## `const` versus `let`

Try to use `const` whenever possible. If a variable won't be reassigned, use
`const`, otherwise use `let`.

## Checking for equality

JavaScript has a strict `===` and less strict `==` equality operator. The
stricter equality operator also does type checking. To avoid subtle bugs when
doing comparisons, always use the strict equality check.

### Always enclose blocks in curly brackets

When writing a block such as an `if` or `while` statement, always use
curly brackets around that block of code. Even when not strictly required by
the compiler (for example if its only one line inside the `if` statement).

```javascript
if (condition === true) {
    this.updateRoomsList();
}
somethingElse();
```

and **NOT** like this:

```javascript
if (converse.auto_list_rooms)
    this.updateRoomsList();
somethingElse();
```

This is to aid in readability and to avoid subtle bugs where certain lines are
wrongly assumed to be executed within a block.

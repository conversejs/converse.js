# @converse/log

[![npm version](https://img.shields.io/npm/v/@converse/log.svg)](https://www.npmjs.com/package/@converse/log)
[![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](https://github.com/conversejs/converse.js/blob/master/LICENSE.txt)

A lightweight logging utility for Converse.js and related projects, providing configurable log levels with a thin wrapper around `console`.

## Features

- Multiple log levels (debug, info, warn, error, fatal)
- Variadic arguments passed through to `console`
- Automatic `Error.stack` and `Element.outerHTML` conversion
- Zero dependencies
- TypeScript support

## Installation

```bash
npm install @converse/log
```

## Basic Usage

```javascript
import log from '@converse/log';

// Configure log level (default: 'info')
log.setLogLevel('debug');

// Log messages
log.debug('Detailed debug information');
log.info('System status update');
log.warn('Potential issue detected');
log.error('Operation failed');
log.fatal('Critical system failure');

// Pass multiple arguments like console
log.debug('User', username, 'logged in', { timestamp: Date.now() });

// Use %c for CSS styling in the browser console
log.debug('%c%s', 'color: darkgoldenrod', xmlStanza.outerHTML);
```

## API Reference

### `setLogLevel(level: string): void`

Sets the minimum log level to display. Available levels (in order of severity):

- `debug`
- `info` (default)
- `warn`
- `error`
- `fatal`

### Logging Methods

All methods accept the same arguments as their corresponding `console` method.

- `log.debug(...args: any[]): void`
- `log.info(...args: any[]): void`
- `log.warn(...args: any[]): void`
- `log.error(...args: any[]): void`
- `log.fatal(...args: any[]): void`

### `log.log(level: string, ...args: any[]): void`

Generic log method where you specify the level.

### Special Handling

- `Error` instances are converted to their `.stack` property
- `Element` instances are converted to their `.outerHTML` property

## Integration with Converse.js

This package is used internally by Converse.js but can also be used independently in other projects.

## Development

To contribute or run tests locally:

```bash
git clone https://github.com/conversejs/converse.js.git
cd src/log
npm install
npm test
```

## License

MPL-2.0 © [Converse.js Contributors](https://github.com/conversejs/converse.js/graphs/contributors)

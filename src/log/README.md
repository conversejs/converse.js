# @converse/log

[![npm version](https://img.shields.io/npm/v/@converse/log.svg)](https://www.npmjs.com/package/@converse/log)
[![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](https://github.com/conversejs/converse.js/blob/master/LICENSE.txt)

A lightweight logging utility for Converse.js and related projects, providing configurable log levels and console output formatting.

## Features

- Multiple log levels (debug, info, warn, error, fatal)
- Customizable output styling
- Simple API
- Zero dependencies
- TypeScript support

## Installation

```bash
npm install @converse/log
# or
yarn add @converse/log
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

// Log with custom styling
log.info('Important notice', 'color: blue; font-weight: bold');
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
All methods accept an optional `style` parameter for custom console output styling.

- `log.debug(message: string, style?: string): void`
- `log.info(message: string, style?: string): void`
- `log.warn(message: string, style?: string): void` 
- `log.error(message: string, style?: string): void`
- `log.fatal(message: string, style?: string): void`

### `log.log(message: string, level: string, style?: string): void`
Generic log method where you specify the level.

## Integration with Converse.js

This package is used internally by Converse.js but can also be used independently in other projects.

## Development

To contribute or run tests locally:

```bash
git clone https://github.com/conversejs/converse.js.git
cd src/log
npm install
```

## License

MPL-2.0 © [Converse.js Contributors](https://github.com/conversejs/converse.js/graphs/contributors)

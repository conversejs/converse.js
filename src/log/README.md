# @converse/log

A helper module which lets you log messages to the console, with different log levels.

Use `log.setLogLevel` to set the log level. All messages with a log level equal
to or higher than what's set, will be logged to the console.

## Installation

```bash
npm install @converse/log
```

## Usage

```javascript
import log from '@converse/log';

log.setLogLevel('warn');
log.debug('Debug message'); // This message will NOT be logged
log.info('Info message'); // This message will NOT be logged
log.warn('Warning message'); // This message will be logged
log.error('Error message'); // This message will be logged
log.fatal('Fatal error'); // This message will be logged
```

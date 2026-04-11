import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import log, { LEVELS } from './index.js';

describe('@converse/log', () => {
    it('LEVELS are ordered correctly', () => {
        assert.strictEqual(LEVELS.debug, 0);
        assert.strictEqual(LEVELS.info, 1);
        assert.strictEqual(LEVELS.warn, 2);
        assert.strictEqual(LEVELS.error, 3);
        assert.strictEqual(LEVELS.fatal, 4);
    });

    it('default loglevel is info', () => {
        assert.strictEqual(log.loglevel, 'info');
    });

    it('setLogLevel accepts valid levels', () => {
        for (const level of ['debug', 'info', 'warn', 'error', 'fatal']) {
            log.setLogLevel(level);
            assert.strictEqual(log.loglevel, level);
        }
        log.setLogLevel('info');
    });

    it('setLogLevel rejects invalid levels', () => {
        assert.throws(() => log.setLogLevel('trace'), /Invalid loglevel/);
        assert.throws(() => log.setLogLevel(undefined), /Invalid loglevel/);
    });

    it('filters messages below the current loglevel', () => {
        log.setLogLevel('warn');
        const spy = mock.method(console, 'debug');
        const infoSpy = mock.method(console, 'info');

        log.debug('should not appear');
        log.info('should not appear');

        assert.strictEqual(spy.mock.callCount(), 0);
        assert.strictEqual(infoSpy.mock.callCount(), 0);

        spy.mock.restore();
        infoSpy.mock.restore();
        log.setLogLevel('info');
    });

    it('passes through variadic args to console', () => {
        log.setLogLevel('debug');
        const spy = mock.method(console, 'debug');

        log.debug('hello', 'world', 42);

        assert.strictEqual(spy.mock.callCount(), 1);
        const args = spy.mock.calls[0].arguments;
        assert.strictEqual(args[0], 'hello');
        assert.strictEqual(args[1], 'world');
        assert.strictEqual(args[2], 42);

        spy.mock.restore();
        log.setLogLevel('info');
    });

    it('converts Error to stack trace', () => {
        log.setLogLevel('debug');
        const spy = mock.method(console, 'debug');
        const err = new Error('test error');

        log.debug(err);

        assert.strictEqual(spy.mock.callCount(), 1);
        const args = spy.mock.calls[0].arguments;
        assert.strictEqual(args[0], err.stack);

        spy.mock.restore();
        log.setLogLevel('info');
    });

    it('converts Element to outerHTML', () => {
        globalThis.Element = class Element {};
        const el = new Element();
        el.outerHTML = '<div>test</div>';

        log.setLogLevel('debug');
        const spy = mock.method(console, 'debug');

        log.debug(el);

        assert.strictEqual(spy.mock.callCount(), 1);
        const args = spy.mock.calls[0].arguments;
        assert.strictEqual(args[0], '<div>test</div>');

        spy.mock.restore();
        delete globalThis.Element;
        log.setLogLevel('info');
    });

    it('routes fatal to console.error', () => {
        const spy = mock.method(console, 'error');

        log.fatal('something broke');

        assert.strictEqual(spy.mock.callCount(), 1);
        assert.strictEqual(spy.mock.calls[0].arguments[0], 'something broke');

        spy.mock.restore();
    });

    it('routes warn to console.warn', () => {
        log.setLogLevel('debug');
        const spy = mock.method(console, 'warn');

        log.warn('watch out');

        assert.strictEqual(spy.mock.callCount(), 1);
        assert.strictEqual(spy.mock.calls[0].arguments[0], 'watch out');

        spy.mock.restore();
        log.setLogLevel('info');
    });
});

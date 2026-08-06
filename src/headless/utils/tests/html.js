/**
 * Tests for the DOM-free HTML helpers. They're isomorphic, so this spec runs
 * both in a browser (the `headless` project) and under Node (`headless-node`).
 */
import { describe, expect, it } from 'vitest';
import { decodeHTMLEntities, unescapeHTML } from '../html.js';

describe('decodeHTMLEntities', function () {
    it('returns anything that is not a non-empty string unchanged', function () {
        expect(decodeHTMLEntities('')).toBe('');
        expect(decodeHTMLEntities(null)).toBe(null);
        expect(decodeHTMLEntities(undefined)).toBe(undefined);
    });

    it('decodes HTML entities', function () {
        expect(decodeHTMLEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
        expect(decodeHTMLEntities('&#8230;')).toBe('…');
        expect(decodeHTMLEntities('caf&eacute;')).toBe('café');
    });

    it('strips tags, keeping the text between them', function () {
        expect(decodeHTMLEntities('<p>hello <b>world</b></p>')).toBe('hello world');
        expect(decodeHTMLEntities('<br/>')).toBe('');
        expect(decodeHTMLEntities('<!-- a comment -->kept')).toBe('kept');
        expect(decodeHTMLEntities('<!DOCTYPE html>kept')).toBe('kept');
    });

    it('keeps an entity-encoded tag as text', function () {
        expect(decodeHTMLEntities('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
    });

    it('keeps a `<` that does not open a tag', function () {
        expect(decodeHTMLEntities('3 < 5')).toBe('3 < 5');
        expect(decodeHTMLEntities('ends with <')).toBe('ends with <');
    });

    it('drops the content of script and style elements', function () {
        expect(decodeHTMLEntities('<script>alert(1)</script>hi')).toBe('hi');
        expect(decodeHTMLEntities('<SCRIPT TYPE="text/javascript">alert(1)</SCRIPT>hi')).toBe('hi');
        expect(decodeHTMLEntities('<style>body { color: red }</style>hi')).toBe('hi');
        // A stray end tag doesn't open a raw text element.
        expect(decodeHTMLEntities('</script>hi')).toBe('hi');
        // Nor does a tag named after something on Object.prototype.
        expect(decodeHTMLEntities('<constructor>hi</constructor>')).toBe('hi');
        expect(decodeHTMLEntities('<toString>hi</toString>')).toBe('hi');
    });

    it('drops a tag that is never closed', function () {
        expect(decodeHTMLEntities('safe <script src="x')).toBe('safe ');
        expect(decodeHTMLEntities('safe <img onerror=alert(1)')).toBe('safe ');
    });

    it('honours quoted attribute values containing a `>`', function () {
        expect(decodeHTMLEntities('<img alt="a>b">kept')).toBe('kept');
        expect(decodeHTMLEntities("<img alt='a>b'>kept")).toBe('kept');
    });

    it('leaves no tag behind for markup that nests or truncates', function () {
        const payloads = [
            '<scr<script>ipt>alert(1)</script>',
            '<<script>script>alert(1)<</script>/script>',
            '<img src="x" onerror="alert(1)"',
            '<a href="><script>alert(1)</script>">x</a>',
            '<div <div>>x',
        ];
        for (const payload of payloads) {
            const text = decodeHTMLEntities(payload);
            expect(text).not.toContain('<script');
            expect(text).not.toContain('<img');
            expect(text).not.toContain('onerror');
        }
    });
});

describe('unescapeHTML', function () {
    it('decodes entities without touching tags', function () {
        expect(unescapeHTML('&lt;b&gt;x&lt;/b&gt;')).toBe('<b>x</b>');
        expect(unescapeHTML('<b>x</b>')).toBe('<b>x</b>');
    });

    it('returns a non-string unchanged', function () {
        expect(unescapeHTML(null)).toBe(null);
    });
});

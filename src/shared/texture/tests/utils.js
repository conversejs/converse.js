import { getUrlRanges } from '../utils.js';

describe('getUrlRanges', function () {

    it('returns an empty array for text without URLs', function () {
        expect(getUrlRanges('hello world')).toEqual([]);
        expect(getUrlRanges('')).toEqual([]);
        expect(getUrlRanges('just some _emphasized_ text')).toEqual([]);
    });

    it('detects a simple HTTP URL', function () {
        const text = 'visit https://example.com today';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(ranges[0][0]).toBe(6);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com');
    });

    it('detects multiple URLs', function () {
        const text = 'see https://example.com and http://other.org for info';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(2);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com');
        expect(text.slice(ranges[1][0], ranges[1][1])).toBe('http://other.org');
    });

    it('excludes trailing punctuation from URLs', function () {
        const text = 'check https://example.com.';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com');
    });

    it('excludes trailing parentheses from URLs', function () {
        const text = '(https://example.com)';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com');
    });

    it('strips a trailing underscore from a URL', function () {
        const text = 'link: https://example.com/path_';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com/path');
    });

    it('preserves underscores inside a URL path', function () {
        const text = 'see https://example.com/some_path/to_page for details';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com/some_path/to_page');
    });

    it('handles URLs with query parameters containing underscores', function () {
        const text = 'https://example.com/search?q=foo_bar&lang=en';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com/search?q=foo_bar&lang=en');
    });

    it('handles URLs with fragments', function () {
        const text = 'https://example.com/page#section_one';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com/page#section_one');
    });

    it('detects non-HTTP scheme URLs', function () {
        const text = 'download via ftp://files.example.com/doc.pdf please';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('ftp://files.example.com/doc.pdf');
    });

    it('handles URL at the start of the text', function () {
        const text = 'https://example.com is a website';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(ranges[0][0]).toBe(0);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com');
    });

    it('handles URL at the end of the text', function () {
        const text = 'visit https://example.com';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com');
    });

    it('trims trailing curly quotes and guillemets', function () {
        const text = '\u00ABhttps://example.com\u00BB';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(text.slice(ranges[0][0], ranges[0][1])).toBe('https://example.com');
    });

    it('handles a URL that is the entire text', function () {
        const text = 'https://example.com/path';
        const ranges = getUrlRanges(text);
        expect(ranges.length).toBe(1);
        expect(ranges[0][0]).toBe(0);
        expect(ranges[0][1]).toBe(text.length);
    });
});

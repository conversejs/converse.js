/*global converse */

const { replaceCurrentWord, isMentionBoundary, getCurrentWord } = converse.env.utils;

function createInput(value, selectionEnd) {
    const input = document.createElement('input');
    input.value = value;
    input.selectionEnd = selectionEnd;
    return input;
}

describe('replaceCurrentWord', () => {
    it('replaces the current word with a trailing space by default', () => {
        const input = createInput('hello world again', 11);
        replaceCurrentWord(input, 'earth');
        expect(input.value).toBe('hello earth  again');
        expect(input.selectionEnd).toBe(12);
    });

    it('replaces the current word without a trailing space when suffix is empty', () => {
        const input = createInput('hello earth', 11);
        replaceCurrentWord(input, 'world', '');
        expect(input.value).toBe('hello world');
        expect(input.selectionEnd).toBe(11);
    });

    it('appends a custom suffix after the replaced word', () => {
        const input = createInput('apple banana', 5);
        replaceCurrentWord(input, 'kiwi', ', ');
        expect(input.value).toBe('kiwi,  banana');
        expect(input.selectionEnd).toBe(6);
    });
});

describe('getCurrentWord', () => {
    it('returns the word at the cursor position', () => {
        const input = createInput('hello world', 11);
        expect(getCurrentWord(input)).toBe('world');
    });

    it('returns the partial word when caret is mid-word', () => {
        const input = createInput('hello world', 8);
        expect(getCurrentWord(input)).toBe('wo');
    });

    it('returns the word at an explicit index', () => {
        const input = createInput('alpha beta gamma', 11);
        expect(getCurrentWord(input, 5)).toBe('alpha');
    });

    it('splits on a custom delineator', () => {
        const input = createInput('group1, gr', 10);
        expect(getCurrentWord(input, undefined, ',')).toBe('gr');
    });
});

describe('isMentionBoundary', () => {
    it('returns true for whitespace', () => {
        expect(isMentionBoundary(' ')).toBe(true);
    });

    it('returns true for punctuation', () => {
        expect(isMentionBoundary(',')).toBe(true);
        expect(isMentionBoundary('.')).toBe(true);
    });

    it('returns false for alphanumeric characters', () => {
        expect(isMentionBoundary('a')).toBe(false);
        expect(isMentionBoundary('1')).toBe(false);
    });

    it('returns false for @ (the mention trigger)', () => {
        expect(isMentionBoundary('@')).toBe(false);
    });
});
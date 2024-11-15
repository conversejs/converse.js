/**
 * @param {string} text
 * @returns {string}
 */
export function firstCharToUpperCase(text) {
    if (!text) {
        return '';
    }

    if ('\uD83D\uDE00'.length === 1) {
        return text.charAt(0).toLocaleUpperCase() + text.substring(1);
    }

    const firstChar = text.codePointAt(0);
    const index = firstChar > 0xffff ? 2 : 1;

    return String.fromCodePoint(firstChar).toLocaleUpperCase() + text.substring(index);
}

/**
 * @param {string} string
 * @param {string[]} candidates
 * @returns {string}
 */
export function getLongestSubstring (string, candidates) {
    /**
     * @param {string} accumulator
     * @param {string} current_value
     * @returns {string}
     */
    function reducer (accumulator, current_value) {
        if (string.startsWith(current_value)) {
            if (current_value.length > accumulator.length) {
                return current_value;
            } else {
                return accumulator;
            }
        } else {
            return accumulator;
        }
    }
    return candidates.reduce(reducer, '');
}

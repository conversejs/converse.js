/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Pure functions to help functionally parse messages.
 * @todo Other parsing helpers can be made more abstract and placed here.
 */
const helpers = {};

// Captures all mentions, but includes a space before the @
helpers.mention_regex = /(?:\s|^)([@][\w_-]+(?:\.\w+)*)/ig;

helpers.matchRegexInText = text => regex => text.matchAll(regex);

const escapeRegexChars = (string, char) => string.replace(RegExp('\\' + char, 'ig'), '\\' + char);

helpers.escapeCharacters = characters => string =>
    characters.split('').reduce(escapeRegexChars, string);

helpers.escapeRegexString = helpers.escapeCharacters('[\\^$.?*+(){}');

// `for` is ~25% faster than using `Array.find()`
helpers.findFirstMatchInArray = array => text => {
    for (let i = 0; i < array.length; i++) {
        if (text.localeCompare(array[i], undefined, {sensitivity: 'base'}) === 0) {
            return array[i];
        }
    }
    return null;
};

const reduceReferences = ([text, refs], ref, index) => {
    let updated_text = text;
    let { begin, end } = ref;
    const { value } = ref;
    begin = begin - index;
    end = end - index - 1; // -1 to compensate for the removed @
    updated_text = `${updated_text.slice(0, begin)}${value}${updated_text.slice(end + 1)}`;
    return [updated_text, [...refs, { ...ref, begin, end }]]
}

helpers.reduceTextFromReferences = (text, refs) => refs.reduce(reduceReferences, [text, []]);

export default helpers;

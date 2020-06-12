/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Pure functions to help funcitonally parse messages.
 * @todo Other parsing helpers can be made more abstract and placed here.
 */
const helpers = {};

// Captures all mentions, but includes a space before the @
helpers.mention_regex = /(?:\s|^)([@][\w_-]+(?:\.\w+)*)/ig;

helpers.matchRegexInText = text => regex => text.matchAll(regex);

helpers.isStringPrecededBySpace = text => string_index => text[string_index - 1] == ' ';

const reduceReferences = ([text, refs], ref, index) => {
    let updated_text = text;
    let { begin, end } = ref;
    const { value } = ref
    begin = begin - index;
    end = end - index - 1; // -1 to compensate for the removed @
    updated_text = `${updated_text.slice(0, begin)}${value}${updated_text.slice(end + 1)}`;
    return [updated_text, [...refs, { ...ref, begin, end }]]
}

helpers.reduceTextFromReferences = (text, refs) => refs.reduce(reduceReferences, [text, []]);

export default helpers;

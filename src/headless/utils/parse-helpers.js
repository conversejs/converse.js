/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Pure functions to help funcitonally parse messages.
 * @todo Other parsing helpers can be made more abstract and placed here.
 */
const helpers = {};

// Captures all mentions, but includes a space before the @
helpers.mention_regex = /\s([@][\w_-]+)|^([@][\w_-]+)/ig;

helpers.mapMentionToReference = regex => match => {
    const first_character = match[0][0];
    const begin = regex.test(first_character) ? match.index + 1 : match.index;
    const tempValue = match[1] || match[0];
    const non_inclusive_end = begin + tempValue.length;
    return { begin, end: non_inclusive_end, tempValue };
};

helpers.addKnownNickname = (known_nicknames, lowercase_nicknames) => reference => {
    const { tempValue, ...rest } = reference;
    const lowercase_mention_no_at_sign = tempValue.slice(1).toLowerCase();
    const index = lowercase_nicknames.indexOf(lowercase_mention_no_at_sign);
    return index > -1
      ? { value: known_nicknames[index], ...rest }
      : reference;
};

helpers.withValue = v => v.value;

helpers.makeUriFromReference = (getOccupant, jid) => reference => {
    const nickname = reference.value;
    const occupant  = getOccupant(nickname) || getOccupant(jid);
    const uri = occupant ? occupant.get('jid') : `${jid}/${nickname}`;
    return { ...reference, uri: encodeURI(`xmpp:${uri}`) }
};

const reduceReferences = ([text, refs], ref, index) => {
    let updated_text = text;
    let { begin, end } = ref;
    const { value } = ref
    begin = begin - index;
    end = end - index - 1; // -1 to compensate for the removed @
    updated_text = `${updated_text.slice(0, begin)}${value}${updated_text.slice(end + 1)}`;
    return [updated_text, [...refs, { ...ref, begin, end }]]
}

helpers.reduceTextFromReferences = (text, refs) =>
    refs.reduce(reduceReferences, [text, []]);

export default helpers;

/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Pure functions to help funcitonally parse messages.
 * @todo Other parsing helpers can be made more abstract and placed here.
 */
const helpers = {};

    // Captures all mentions, but includes a space before the @
helpers.mention_regex = /\s([@][\w_-]+)|^([@][\w_-]+)/ig;

helpers.mapCleanReferences = (reference) => {
    /* eslint-disable */
    const { mentioned_as, ...rest } = reference;
    return { ...rest };
};

helpers.mapAddCoordsToReferences = (indexes) => (reference, index) => {
    const begin = indexes[index] - index;
    return {
        ...reference,
        begin,
        end: begin + reference.value.length // add one for the @
    }
};

helpers.mapAddUriToReferences = (makeUriFromReference) => (reference) => ({
    ...reference,
    uri: makeUriFromReference(reference)
})

helpers.mapFormatMentions = mention => mention.slice(1).toLowerCase();

// One of the two possible matches for `mention_regex`
// One will always be undefined
helpers.mapMentionsInMatches = match => match[1] || match[0];

helpers.mapMentionsToTempReferences = (mention) => ({
    mentioned_as: mention,
    type: 'mention'
});

helpers.mapMatchesToBeginIndexes = (match) => {
    const whitespace_regex = /[\s]+/g;
    const match_is_preceded_by_white_space = whitespace_regex.test(match[0][0]);
    return match_is_preceded_by_white_space
        ? match.index + 1
        : match.index;
};

helpers.reduceTextFromReferences = (updated_text, reference) => {
    const { begin, end, value } = reference;
    return `${updated_text.slice(0, begin)}${value}${updated_text.slice(end + 1)}`;
};

helpers.reduceReferencesWithNicknames = (known_nicknames) => {
    const lowercase_nicknames = known_nicknames.map(nick => nick.toLowerCase());
    return (accum, reference) => {
        const lowercase_mention_no_at_sign = reference.mentioned_as.slice(1).toLowerCase();
        const index = lowercase_nicknames.indexOf(lowercase_mention_no_at_sign);
        if (index == -1) {
            return accum;
        }
        return [...accum, {
            ...reference,
            value: known_nicknames[index]
        }];
    }
};

helpers.makeUriFromReference = (getOccupant, jid) => (reference) => {
    const nickname = reference.value;
    const occupant = getOccupant(nickname) || getOccupant(jid);
    const uri = occupant ? occupant.get('jid') : `${jid}/${nickname}`;
    return encodeURI(`xmpp:${uri}`);
};

export default helpers;

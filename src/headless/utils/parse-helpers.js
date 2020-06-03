/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Pure functions to help funcitonally parse messages.
 * @todo Other parsing helpers can be made more abstract and placed here.
 */
const helpers = {
    filterIsNicknameMentioned (mentions) {
        // testing against lowercase nickname to be able to
        // produce matches that are case insensitive
        return nickname => mentions.includes(nickname.toLowerCase());
    },

    mapCleanReferences (reference) {
        /* eslint-disable */
        const { mentionedAs, ...rest } = reference;
        return { ...rest };
    },

    mapAddCoordsToReferences (indexes) {
        return (reference, index) => {
            const begin = indexes[index] - index;
            return {
                ...reference,
                begin,
                end: begin + reference.value.length // add one for the @
            }
        }
    },

    mapAddUriToReferences (makeUriFromReference) {
        return (reference) => ({
            ...reference,
            uri: makeUriFromReference(reference)
        })
    },

    mapFormatMentions (mention) {
        return mention.slice(1).toLowerCase();
    },

    mapMentionsInMatches (match) {
        return match[1];
    },

    mapMentionsToTempReferences (mention) {
        return {
            mentionedAs: mention,
            type: 'mention'
        }
    },

    mapMatchesToBeginIndexes (match) {
        const whitespaceRegex = /[\s]+/g;
        const matchIsPrecededByWhiteSpace = whitespaceRegex.test(match[0][0]);
        return matchIsPrecededByWhiteSpace
            ? match.index + 1
            : match.index;
    },

    reduceTextFromReferences (updatedText, reference) {
        const { begin, end, value } = reference;
        return `${updatedText.slice(0, begin)}${value}${updatedText.slice(end + 1)}`;
    },

    reduceReferencesWithNicknames (knownNicknames) {
        const lowercaseNicknames = knownNicknames.map(nick => nick.toLowerCase());
        return (accum, reference) => {
            const lowercaseMentionNoAtSign = reference.mentionedAs.slice(1).toLowerCase();
            const index = lowercaseNicknames.indexOf(lowercaseMentionNoAtSign);
            if (index == -1) {
                return accum
            }
            return [...accum, {
                ...reference,
                value: knownNicknames[index]
            }];
        }
    },

    makeUriFromReference (getOccupantByNickname, jid) {
        return (reference) => {
            const nickname = reference.value;
            const occupant = getOccupantByNickname(nickname);
            const uri = occupant
                ? occupant.get('jid')
                : `${jid}/${nickname}`;
            return encodeURI(`xmpp:${uri}`);
        }
    }
};

export default helpers;

export const bracketing_directives = ['*', '_', '~', '`'];
export const styling_directives = [...bracketing_directives, '```', '>'];
export const styling_map = {
    '*': { 'name': 'strong', 'type': 'span' },
    '_': { 'name': 'emphasis', 'type': 'span' },
    '~': { 'name': 'strike', 'type': 'span' },
    '`': { 'name': 'preformatted', 'type': 'span' },
    '```': { 'name': 'preformatted_block', 'type': 'block' },
    '>': { 'name': 'quote', 'type': 'block' },
};
export const dont_escape = ['_', '>', '`', '~'];

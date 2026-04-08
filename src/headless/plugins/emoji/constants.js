
// Regex to detect shortname keys (e.g. ':thumbsup:')
export const SHORTNAME_RE = /^:[a-zA-Z0-9_+*-]+:$/;
// How long to debounce/wait before publishing popular emojis
export const PUBLISH_DEBOUNCE_MILLIS = 30_000;

/**
 * converse-cli's exit codes. They're part of its interface: scripts and agents
 * branch on them, so a code never changes meaning once released.
 */
export const EXIT = {
    OK: 0,
    ERROR: 1, // Anything not covered below, including bad usage
    TIMEOUT: 2, // A wait ended without a match
    NOT_FOUND: 3, // No such contact, conversation or message
    AMBIGUOUS: 4, // A name matched more than one contact or conversation
    REFUSED: 5, // Refused by send policy
    DRAFT: 6, // Queued as a draft for approval rather than sent
    DAEMON_UNAVAILABLE: 7, // No daemon running, and none could be started
};

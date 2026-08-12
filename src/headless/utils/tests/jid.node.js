/**
 * Runs under Node, so the JID helpers a non-browser client leans on are pinned
 * as DOM-free.
 */
import { afterEach, describe, expect, it } from 'vitest';
import _converse from '../../shared/_converse.js';
import { getFullJID, isSameBareJID, isSameDomain, isValidJID } from '../jid.js';

// This project doesn't extend the root config, so nothing restores the stub below.
afterEach(() => {
    delete _converse.state.presences;
});

/**
 * A stand-in for the roster plugin's presence store, which is all getFullJID
 * reaches for.
 * @param {Record<string, {name: string, priority: number, timestamp: string}[]>} by_jid
 */
function stubPresences(by_jid) {
    _converse.state.presences = {
        get(jid) {
            const resources = by_jid[jid];
            if (!resources) return undefined;
            return {
                getHighestPriorityResource() {
                    if (!resources.length) return undefined;
                    return [...resources]
                        .sort((a, b) => `${a.priority}-${a.timestamp}`.localeCompare(`${b.priority}-${b.timestamp}`))
                        .reverse()
                        .map((r) => ({ get: (/** @type {string} */ k) => r[k] }))[0];
                },
            };
        },
    };
}

describe('getFullJID, under Node', () => {
    it('resolves to the highest-priority resource', () => {
        stubPresences({
            'juliet@capulet.lit': [
                { name: 'phone', priority: 1, timestamp: '2026-03-16T10:00:00Z' },
                { name: 'balcony', priority: 5, timestamp: '2026-03-16T09:00:00Z' },
            ],
        });
        expect(getFullJID('juliet@capulet.lit')).toBe('juliet@capulet.lit/balcony');
    });

    it('uses only the bare part of whatever it is given', () => {
        stubPresences({ 'juliet@capulet.lit': [{ name: 'balcony', priority: 1, timestamp: 'x' }] });
        expect(getFullJID('juliet@capulet.lit/some-other-resource')).toBe('juliet@capulet.lit/balcony');
    });

    it('returns null when we have no presence for them', () => {
        stubPresences({ 'juliet@capulet.lit': [] });
        expect(getFullJID('juliet@capulet.lit')).toBeNull();
        expect(getFullJID('romeo@montague.lit')).toBeNull();
    });

    it('returns null rather than throwing on junk or before presences exist', () => {
        stubPresences({});
        expect(getFullJID(null)).toBeNull();
        expect(getFullJID(undefined)).toBeNull();

        _converse.state.presences = undefined;
        expect(getFullJID('juliet@capulet.lit')).toBeNull();
    });
});

describe('The other JID helpers, under Node', () => {
    it('validates and compares without a DOM', () => {
        expect(isValidJID('juliet@capulet.lit')).toBe(true);
        expect(isValidJID('capulet.lit')).toBe(false);
        expect(isSameBareJID('juliet@capulet.lit/balcony', 'JULIET@capulet.lit/phone')).toBe(true);
        expect(isSameDomain('juliet@capulet.lit', 'romeo@montague.lit')).toBe(false);
    });
});

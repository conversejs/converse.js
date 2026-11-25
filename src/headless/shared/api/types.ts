import dayjs from 'dayjs';
import { $build, $iq, $msg, $pres, Strophe, Stanza } from 'strophe.js';
import { Model, Collection } from '@converse/skeletor';
import { html, render } from 'lit';
import u from '../../utils/index.js';
import sizzle from 'sizzle';

/**
 * Utility methods and globals from bundled 3rd party libraries.
 */
export type ConverseEnv = {
    $build: typeof $build;
    $iq: typeof $iq;
    $msg: typeof $msg;
    $pres: typeof $pres;
    Collection: typeof Collection;
    Model: typeof Model;
    Stanza: typeof Stanza;
    Strophe: typeof Strophe;
    TimeoutError: any;
    dayjs: typeof dayjs;
    html: typeof html;
    render: typeof render;
    sizzle: typeof sizzle;
    sprintf: (...args: any[]) => string;
    u: typeof u;
};

export type LoginOptions = {
    automatic?: boolean; // Whether Converse logs in by itself at start-up, rather than the user logging in
};

// The payload of the `login` hook. A handler that has logged the user in
// returns it with `success` set, and later handlers then don't try again.
export type LoginHookPayload = {
    jid: string;
    password: string;
    automatic?: boolean; // Whether Converse is logging in by itself once the connection is set up
    success?: boolean; // Whether a handler has already logged in
};

// The payload of the `attachSession` hook, through which a plugin attaches to
// a session that already exists elsewhere, such as in a shared worker.
export type AttachSessionPayload = {
    attached: boolean; // Set by the plugin that attached
};

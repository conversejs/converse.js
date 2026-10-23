/**
 * @converse/daemon
 *
 * A long-lived Node process that hosts a single `@converse/headless` session
 * and shares it with local client processes (such as `@converse/cli`) over a
 * unix socket, enforcing policy on what each client may do.
 *
 * The daemon reaches headless only through its public API and its Node entry
 * point (`@converse/headless`, resolved via the `node` export condition). XMPP
 * logic belongs in headless; this package holds only what is Node-only or
 * exists because several clients share one session.
 *
 * @module @converse/daemon
 */
export {};

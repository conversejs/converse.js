export default api;
declare namespace api {
    const user: {
        /**
         * @method _converse.api.user.jid
         * @returns {string} The current user's full JID (Jabber ID)
         * @example _converse.api.user.jid())
         */
        jid(): string;
        /**
         * Logs the user in.
         *
         * If called without any parameters, Converse will try
         * to log the user in by calling the `prebind_url` or `credentials_url` depending
         * on whether prebinding is used or not.
         *
         * @method _converse.api.user.login
         * @param { string } [jid]
         * @param { string } [password]
         * @param { boolean } [automatic=false] - An internally used flag that indicates whether
         *  this method was called automatically once the connection has been
         *  initialized. It's used together with the `auto_login` configuration flag
         *  to determine whether Converse should try to log the user in if it
         *  fails to restore a previous auth'd session.
         *  @returns  { Promise<void> }
         */
        login(jid?: string, password?: string, automatic?: boolean): Promise<void>;
        /**
         * Logs the user out of the current XMPP session.
         * @method _converse.api.user.logout
         * @example _converse.api.user.logout();
         */
        logout(): Promise<any>;
        presence: {
            send(type?: string, to?: string, status?: string, child_nodes?: any): Promise<void>;
        };
        settings: {
            getModel(): Promise<import("@converse/skeletor").Model>;
            get(key: string, fallback?: any): Promise<any>;
            set(key: any, val?: string): Promise<any>;
            clear(): Promise<any>;
        };
    };
}
//# sourceMappingURL=user.d.ts.map
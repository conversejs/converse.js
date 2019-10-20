// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import converse from "@converse/headless/converse-core";
import hello from "hellojs";
import tpl_oauth_providers from "templates/oauth_providers.html";

const { _, Backbone } = converse.env;


// The following line registers your plugin.
converse.plugins.add("converse-oauth", {

    /* Optional dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * NB: These plugins need to have already been loaded via require.js.
     *
     * It's possible to make optional dependencies non-optional.
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     */
    'optional_dependencies': ['converse-register'],

    /* If you want to override some function or a Backbone model or
     * view defined elsewhere in converse.js, then you do that under
     * the "overrides" namespace.
     */
    'overrides': {
        /* For example, the private *_converse* object has a
         * method "onConnected". You can override that method as follows:
         */
        LoginPanel: {

            insertOAuthProviders () {
                const { _converse } = this.__super__;
                if (this.oauth_providers_view === undefined) {
                    this.oauth_providers_view =
                        new _converse.OAuthProvidersView({'model': _converse.oauth_providers});

                    this.oauth_providers_view.render();
                    this.el.querySelector('.buttons').insertAdjacentElement(
                        'afterend',
                        this.oauth_providers_view.el
                    );
                }
                this.oauth_providers_view.render();
            },

            render () {
                const { _converse } = this.__super__;
                const result = this.__super__.render.apply(this, arguments);
                if (_converse.oauth_providers && !_converse.auto_login) {
                    this.insertOAuthProviders();
                }
                return result;
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        _converse.api.settings.update({
            'oauth_providers': {},
        });

        _converse.OAuthProviders = _converse.Collection.extend({
            'sync': function sync () {},

            initialize () {
                _converse.user_settings.oauth_providers.forEach(provider => {
                    const item = new Backbone.Model(Object.assign(provider, {
                        'login_text': __('Log in with %1$s', provider.name)
                    }));
                    this.add(item, {'silent': true});
                });
            }
        });
        _converse.oauth_providers = new _converse.OAuthProviders();


        _converse.OAuthProvidersView = Backbone.VDOMView.extend({
            'events': {
                'click .oauth-login': 'oauthLogin'
            },

            toHTML () {
                return tpl_oauth_providers(
                    Object.assign({
                        '_': _,
                        '__': _converse.__,
                        'providers': this.model.toJSON()
                    }));
            },

            async fetchOAuthProfileDataAndLogin () {
                const profile = await this.oauth_service.api('me');
                const response = this.oauth_service.getAuthResponse();
                _converse.api.user.login(
                    `${profile.name}@${this.provider.get('host')}`,
                    response.access_token
                );
            },

            async oauthLogin (ev) {
                ev.preventDefault();
                const id = ev.target.getAttribute('data-id');
                this.provider = _converse.oauth_providers.get(id);
                this.oauth_service = hello(id);

                const data = {};
                data[id] = this.provider.get('client_id');
                hello.init(data, {
                    'redirect_uri': '/redirect.html'
                });

                await this.oauth_service.login();
                this.fetchOAuthProfileDataAndLogin();
            }
        });
    }
});


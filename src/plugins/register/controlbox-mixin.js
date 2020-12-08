import { _converse, api } from '@converse/headless/core';

const ControlBoxRegistrationMixin = {

    showLoginOrRegisterForm () {
        if (!this.registerpanel) {
            return;
        }
        if (this.model.get('active-form') == 'register') {
            this.loginpanel.el.classList.add('hidden');
            this.registerpanel.el.classList.remove('hidden');
        } else {
            this.loginpanel.el.classList.remove('hidden');
            this.registerpanel.el.classList.add('hidden');
        }
    },

    renderRegistrationPanel () {
        if (api.settings.get('allow_registration')) {
            this.registerpanel = new _converse.RegisterPanel({
                'model': this.model
            });
            this.registerpanel.render();
            this.registerpanel.el.classList.add('hidden');
            const login_panel = this.querySelector('#converse-login-panel');
            if (login_panel) {
                login_panel.insertAdjacentElement('afterend', this.registerpanel.el);
            }
            this.showLoginOrRegisterForm();
        }
        return this;
    }
};

export default ControlBoxRegistrationMixin;

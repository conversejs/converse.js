import bootstrap from "bootstrap.native";
import tpl_login_panel from "./templates/loginpanel.js";
import { ElementView } from "@converse/skeletor/src/element";
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { render } from 'lit-html';

const u = converse.env.utils;
const { Strophe } = converse.env;

const REPORTABLE_STATUSES = [
    0, // ERROR'
    1, // CONNECTING
    2, // CONNFAIL
    3, // AUTHENTICATING
    4, // AUTHFAIL
    7, // DISCONNECTING
   10  // RECONNECTING
];

const PRETTY_CONNECTION_STATUS = {
    0: 'Error',
    1: 'Connecting',
    2: 'Connection failure',
    3: 'Authenticating',
    4: 'Authentication failure',
    5: 'Connected',
    6: 'Disconnected',
    7: 'Disconnecting',
    8: 'Attached',
    9: 'Redirect',
   10: 'Reconnecting'
};

const CONNECTION_STATUS_CSS_CLASS = {
   'Error': 'error',
   'Connecting': 'info',
   'Connection failure': 'error',
   'Authenticating': 'info',
   'Authentication failure': 'error',
   'Connected': 'info',
   'Disconnected': 'error',
   'Disconnecting': 'warn',
   'Attached': 'info',
   'Redirect': 'info',
   'Reconnecting': 'warn'
};


const LoginPanelModel = Model.extend({
   defaults: {
         // Passed-by-reference. Fine in this case because there's only one such model.
         'errors': [],
   }
});


class LoginPanel extends ElementView {
   id = "converse-login-panel"
   className = 'controlbox-pane fade-in row no-gutters'
   events = {
         'submit form#converse-login': 'authenticate',
         'change input': 'validate'
   }

   initialize () {
         this.model = new LoginPanelModel();
         this.listenTo(this.model, 'change', this.render)
         this.listenTo(_converse.connfeedback, 'change', this.render);
         this.render();
         this.initPopovers();
   }

   render () {
         const connection_status = _converse.connfeedback.get('connection_status');
         let feedback_class, pretty_status;
         if (REPORTABLE_STATUSES.includes(connection_status)) {
            pretty_status = PRETTY_CONNECTION_STATUS[connection_status];
            feedback_class = CONNECTION_STATUS_CSS_CLASS[pretty_status];
         }
         render(tpl_login_panel(
            Object.assign(this.model.toJSON(), {
               '_converse': _converse,
               'ANONYMOUS': _converse.ANONYMOUS,
               'EXTERNAL': _converse.EXTERNAL,
               'LOGIN': _converse.LOGIN,
               'PREBIND': _converse.PREBIND,
               'auto_login': api.settings.get('auto_login'),
               'authentication': api.settings.get("authentication"),
               'connection_status': connection_status,
               'conn_feedback_class': feedback_class,
               'conn_feedback_subject': pretty_status,
               'conn_feedback_message': _converse.connfeedback.get('message'),
               'placeholder_username': (api.settings.get('locked_domain') || api.settings.get('default_domain')) &&
                                       __('Username') || __('user@domain'),
               'show_trust_checkbox': api.settings.get('allow_user_trust_override')
            })
         ), this);
   }

   initPopovers () {
         Array.from(this.querySelectorAll('[data-title]')).forEach(el => {
            new bootstrap.Popover(el, {
               'trigger': api.settings.get("view_mode") === 'mobile' && 'click' || 'hover',
               'dismissible': api.settings.get("view_mode") === 'mobile' && true || false,
               'container': this.parentElement.parentElement.parentElement
            })
         });
   }

   validate () {
         const form = this.querySelector('form');
         const jid_element = form.querySelector('input[name=jid]');
         if (jid_element.value &&
               !api.settings.get('locked_domain') &&
               !api.settings.get('default_domain') &&
               !u.isValidJID(jid_element.value)) {
            jid_element.setCustomValidity(__('Please enter a valid XMPP address'));
            return false;
         }
         jid_element.setCustomValidity('');
         return true;
   }

   /**
    * Authenticate the user based on a form submission event.
    * @param { Event } ev
    */
   authenticate (ev) {
         ev?.preventDefault();
         if (api.settings.get("authentication") === _converse.ANONYMOUS) {
            return this.connect(_converse.jid, null);
         }
         if (!this.validate()) { return; }

         const form_data = new FormData(ev.target);
         _converse.config.save({'trusted': form_data.get('trusted') && true || false});

         let jid = form_data.get('jid');
         if (api.settings.get('locked_domain')) {
            const last_part = '@' + api.settings.get('locked_domain');
            if (jid.endsWith(last_part)) {
               jid = jid.substr(0, jid.length - last_part.length);
            }
            jid = Strophe.escapeNode(jid) + last_part;
         } else if (api.settings.get('default_domain') && !jid.includes('@')) {
            jid = jid + '@' + api.settings.get('default_domain');
         }
      this.connect(jid, form_data.get('password'));
   }

   connect (jid, password) { // eslint-disable-line class-methods-use-this
         if (["converse/login", "converse/register"].includes(_converse.router.history.getFragment())) {
            _converse.router.navigate('', {'replace': true});
         }
         _converse.connection && _converse.connection.reset();
         api.user.login(jid, password);
   }
}

api.elements.define('converse-login-panel', LoginPanel);

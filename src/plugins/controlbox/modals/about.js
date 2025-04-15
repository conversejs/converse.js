import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import BaseModal from 'plugins/modal/modal.js';

class AboutModal extends BaseModal {
    getModalTitle() {
        return __('About Converse');
    }

    renderModal() {
        return html`
            <p>
                Converse is an open-source <a href="https://xmpp.org" target="_blank" rel="noopener">XMPP</a> chat app
                written in JavaScript.
            </p>
            <p>Just like the XMPP protocol, Converse is built with extensibility in mind.</p>
            <p>
                Because it is open source, integrators and developers can use it to add chat functionality to their
                websites.
            </p>
            <p>
                Converse is also
                <a href="https://conversejs.org/docs/html/configuration.html" target="_blank" rel="noopener"
                    >configurable</a
                >, built with modern web technologies and
                <a href="https://conversejs.org/docs/html/plugin_development.html" target="_blank" rel="noopener"
                    >extensible with plugins</a
                >. It has different modes, which means it can be a full page app, an embedded chat widget, or an overlayed chat
                box. For a list of supported features and XMPP extensions, please see the
                <a
                    href="https://github.com/conversejs/converse.js?tab=readme-ov-file#features"
                    target="_blank"
                    rel="noopener"
                    >README</a
                >.
            </p>
            <p>
                Converse is translated into over 30 languages. You can
                <a target="_blank" rel="nofollow" href="https://hosted.weblate.org/projects/conversejs/#languages"
                    >translate</a
                >
                it into your own language.
            </p>
            <p>
                Converse was created by <a target="_blank" rel="nofollow" href="https://opkode.com">JC Brand</a>. You
                can <a target="_blank" rel="nofollow" href="https://opkode.com/contact.html">hire me</a>
                for customizations, support or to build your next project.
            </p>
            <p>
                If you're interested in sponsoring Converse, please visit:
                <a href="https://github.com/sponsors/jcbrand" target="_blank" rel="noopener">Github</a>,
                <a href="https://www.patreon.com/jcbrand" target="_blank" rel="noopener">Patreon</a>,
                <a href="https://liberapay.com/jcbrand" target="_blank" rel="noopener">Liberapay</a>
                or
                <a href="https://opkode.com/contact.html" target="_blank" rel="noopener">contact us</a>.
            </p>
        `;
    }
}

api.elements.define('converse-about-modal', AboutModal);

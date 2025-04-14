import { html } from 'lit';

/**
 * @param {import('../navbar.js').default} el
 */
export default (el) => {
    return html`
        <nav class="navbar navbar-expand-lg">
            <div class="container-fluid">
                <div class="collapse navbar-collapse" id="navbarSupportedContent">
                    <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
                        <li class="nav-item">
                            <a class="nav-link" href="#" @click=${el.openAboutDialog}>About</a>
                        </li>
                        <li class="nav-item">
                            <a
                                class="nav-link"
                                target="_blank"
                                rel="noopener"
                                href="https://github.com/conversejs/converse.js"
                                >Github</a
                            >
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" target="_blank" rel="noopener" href="https://conversejs.org/docs/html"
                                >Documentation</a
                            >
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" target="_blank" rel="noopener" href="https://opkode.com/contact.html"
                                >Contact</a
                            >
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    `;
};

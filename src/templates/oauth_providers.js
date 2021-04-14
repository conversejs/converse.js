import { html } from "lit";

const tpl_provider = (o, provider) => html`
    <p class="oauth-provider">
        <a @click=${o.oauthLogin} class="oauth-login" data-id="${provider.id}">
            <i class="fa ${provider.class}"></i>${provider.login_text}
        </a>
    </p>
`;

export default (o) => html`
    <fieldset class="oauth-providers">
        ${ o.providers.map(provider => tpl_provider(o, provider)) }
    </fieldset>
`;
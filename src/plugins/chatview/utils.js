import { html } from 'lit-html';


export async function getHeadingDropdownItem (promise_or_data) {
    const data = await promise_or_data;
    return html`
        <a href="#" class="dropdown-item ${data.a_class}" @click=${data.handler} title="${data.i18n_title}"
            ><i class="fa ${data.icon_class}"></i>${data.i18n_text}</a
        >
    `;
}

export async function getHeadingStandaloneButton (promise_or_data) {
    const data = await promise_or_data;
    return html`
        <a
            href="#"
            class="chatbox-btn ${data.a_class} fa ${data.icon_class}"
            @click=${data.handler}
            title="${data.i18n_title}"
        ></a>
    `;
}

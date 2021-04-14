import { html } from "lit";


export default (messages) => {
    return html`
        <div class="alert alert-danger">
            <h3 class="alert-heading disconnect-msg">${messages[0]}</h3>
            ${ messages.slice(1).map(m => html`<p class="disconnect-msg">${m}</p>`) }
        </div>`;
}

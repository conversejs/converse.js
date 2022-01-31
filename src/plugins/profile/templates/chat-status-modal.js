import { html } from "lit";
import { modal_header_close_button } from "plugins/modal/templates/buttons.js";


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="changeStatusModalLabel">${o.modal_title}</h5>
                ${modal_header_close_button}
            </div>
            <div class="modal-body">
                <span class="modal-alert"></span>
                <form class="converse-form set-xmpp-status" id="set-xmpp-status">
                    <div class="form-group">
                        <div class="custom-control custom-radio">
                            <input ?checked=${o.status === 'online'}
                                type="radio" id="radio-online" value="online" name="chat_status" class="custom-control-input"/>
                            <label class="custom-control-label" for="radio-online">
                                <converse-icon size="1em" class="fa fa-circle chat-status chat-status--online"></converse-icon>${o.label_online}</label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input ?checked=${o.status === 'busy'}
                                type="radio" id="radio-busy" value="dnd" name="chat_status" class="custom-control-input"/>
                            <label class="custom-control-label" for="radio-busy">
                                <converse-icon size="1em" class="fa fa-minus-circle  chat-status chat-status--busy"></converse-icon>${o.label_busy}</label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input ?checked=${o.status === 'away'}
                                type="radio" id="radio-away" value="away" name="chat_status" class="custom-control-input"/>
                            <label class="custom-control-label" for="radio-away">
                                <converse-icon size="1em" class="fa fa-circle chat-status chat-status--away"></converse-icon>${o.label_away}</label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input ?checked=${o.status === 'xa'}
                                type="radio" id="radio-xa" value="xa" name="chat_status" class="custom-control-input"/>
                            <label class="custom-control-label" for="radio-xa">
                                <converse-icon size="1em" class="far fa-circle chat-status chat-status--xa"></converse-icon>${o.label_xa}</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="btn-group w-100">
                            <input name="status_message" type="text" class="form-control"
                                value="${o.status_message || ''}" placeholder="${o.placeholder_status_message}"/>
                            <converse-icon size="1em" class="fa fa-times clear-input ${o.status_message ? '' : 'hidden'}"></converse-icon>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">${o.label_save}</button>
                </form>
            </div>
        </div>
    </div>
`;

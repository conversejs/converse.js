import { html } from "lit-html";
import { modal_header_close_button } from "./buttons"


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
                                <span class="fa fa-circle chat-status chat-status--online"></span>${o.label_online}</label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input ?checked=${o.status === 'busy'}
                                type="radio" id="radio-busy" value="dnd" name="chat_status" class="custom-control-input"/>
                            <label class="custom-control-label" for="radio-busy">
                                <span class="fa fa-minus-circle  chat-status chat-status--busy"></span>${o.label_busy}</label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input ?checked=${o.status === 'away'}
                                type="radio" id="radio-away" value="away" name="chat_status" class="custom-control-input"/>
                            <label class="custom-control-label" for="radio-away">
                                <span class="fa fa-circle chat-status chat-status--away"></span>${o.label_away}</label>
                        </div>
                        <div class="custom-control custom-radio">
                            <input ?checked=${o.status === 'xa'}
                                type="radio" id="radio-xa" value="xa" name="chat_status" class="custom-control-input"/>
                            <label class="custom-control-label" for="radio-xa">
                                <span class="far fa-circle chat-status chat-status--xa"></span>${o.label_xa}</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="btn-group w-100">
                            <input name="status_message" type="text" class="form-control"
                                value="${o.status_message || ''}" placeholder="${o.placeholder_status_message}"/>
                            <span class="clear-input fa fa-times ${o.status_message ? '' : 'hidden'}"></span>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">${o.label_save}</button>
                </form>
            </div>
        </div>
    </div>
`;

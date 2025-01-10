import { converse } from  '@converse/headless';
import { html } from 'lit';

const { dayjs } = converse.env;

export default (el) => {
    const isodate = dayjs(el.model.get('time')).toISOString();
    return html`
        <div class="message chat-info message--mep ${ el.getExtraMessageClasses() }"
            data-isodate="${isodate}"
            data-type="${el.data_name}"
            data-value="${el.data_value}">

            <div class="chat-msg__content">
                <div class="chat-msg__body chat-msg__body--${el.model.get('type')} ${el.model.get('is_delayed') ? 'chat-msg__body--delayed' : '' }">
                    <div class="chat-info__message">
                        ${ el.isRetracted() ? el.renderRetraction() : html`
                            <converse-texture
                                .mentions=${el.model.get('references')}
                                render_styling
                                text=${el.model.getMessageText()}>
                            </converse-texture>
                            ${ el.model.get('reason') ?
                                html`<q class="reason"><converse-texture text=${el.model.get('reason')}></converse-texture></q>` : `` }
                        `}
                    </div>
                    <converse-message-actions
                        ?is_retracted=${el.isRetracted()}
                        .model=${el.model}></converse-message-actions>
                </div>
            </div>
        </div>`;
}

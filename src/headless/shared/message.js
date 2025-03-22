import dayjs from "dayjs";
import sizzle from "sizzle";
import { Strophe, $iq } from "strophe.js";
import { Model } from "@converse/skeletor";
import log from "@converse/log";
import _converse from "../shared/_converse.js";
import api from "../shared/api/index.js";
import { SUCCESS, FAILURE } from "../shared/constants.js";
import ColorAwareModel from "../shared/color.js";
import ModelWithContact from "../shared/model-with-contact.js";
import ModelWithVCard from "../shared/model-with-vcard";
import { getUniqueId } from "../utils/index.js";

/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
class BaseMessage extends ModelWithVCard(ModelWithContact(ColorAwareModel(Model))) {
    defaults() {
        return {
            msgid: getUniqueId(),
            time: new Date().toISOString(),
            is_ephemeral: false,
        };
    }

    /**
     * @param {Model[]} [models]
     * @param {object} [options]
     */
    constructor(models, options) {
        super(models, options);
        this.file = null;

        /** @type {import('./types').MessageAttributes} */
        this.attributes;
    }

    initialize() {
        this.lazy_load_vcard = true;
        super.initialize();

        this.chatbox = this.collection?.chatbox;
        if (!this.checkValidity()) return;

        if (this.get('file')) {
            this.on('change:put', () => this.uploadFile());
        }
        this.on('change:is_ephemeral', () => this.setTimerForEphemeralMessage());
        this.setTimerForEphemeralMessage();
    }

    checkValidity() {
        if (Object.keys(this.attributes).length === 3) {
            // XXX: This is an empty message with only the 3 default values.
            // This seems to happen when saving a newly created message
            // fails for some reason.
            // TODO: This is likely fixable by setting `wait` when
            // creating messages. See the wait-for-messages branch.
            this.validationError = "Empty message";
            this.safeDestroy();
            return false;
        }
        return true;
    }

    safeDestroy() {
        try {
            this.destroy();
        } catch (e) {
            log.warn(`safeDestroy: ${e}`);
        }
    }

    /**
     * Sets an auto-destruct timer for this message, if it's is_ephemeral.
     */
    setTimerForEphemeralMessage() {
        if (this.ephemeral_timer) {
            clearTimeout(this.ephemeral_timer);
        }
        const is_ephemeral = this.isEphemeral();
        if (is_ephemeral) {
            const timeout = typeof is_ephemeral === "number" ? is_ephemeral : 10000;
            this.ephemeral_timer = setTimeout(() => this.safeDestroy(), timeout);
        }
    }

    /**
     * Returns a boolean indicating whether this message is ephemeral,
     * meaning it will get automatically removed after ten seconds.
     * @returns {boolean}
     */
    isEphemeral() {
        return this.get("is_ephemeral");
    }

    /**
     * Returns a boolean indicating whether this message is a XEP-0245 /me command.
     * @returns {boolean}
     */
    isMeCommand() {
        const text = this.getMessageText();
        if (!text) {
            return false;
        }
        return text.startsWith("/me ");
    }

    /**
     * @returns {boolean}
     */
    isRetracted() {
        return this.get("retracted") || this.get("moderated") === "retracted";
    }

    /**
     * Returns a boolean indicating whether this message is considered a followup
     * message from the previous one. Followup messages are shown grouped together
     * under one author heading.
     * A message is considered a followup of it's predecessor when it's a chat
     * message from the same author, within 10 minutes.
     * @returns {boolean}
     */
    isFollowup() {
        const messages = this.collection?.models;
        if (!messages) {
            // Happens during tests
            return false;
        }
        const idx = messages.indexOf(this);
        const prev_model = idx ? messages[idx - 1] : null;
        if (prev_model === null) {
            return false;
        }
        const date = dayjs(this.get("time"));
        return (
            this.get("from") === prev_model.get("from") &&
            !this.isRetracted() &&
            !prev_model.isRetracted() &&
            !this.isMeCommand() &&
            !prev_model.isMeCommand() &&
            !!this.get("is_encrypted") === !!prev_model.get("is_encrypted") &&
            this.get("type") === prev_model.get("type") &&
            this.get("type") !== "info" &&
            date.isBefore(dayjs(prev_model.get("time")).add(10, "minutes")) &&
            (this.get("type") === "groupchat" ? this.get("occupant_id") === prev_model.get("occupant_id") : true)
        );
    }

    /**
     * Determines whether this messsage may be retracted by the current user.
     * @returns { Boolean }
     */
    mayBeRetracted() {
        const is_own_message = this.get("sender") === "me";
        const not_canceled = this.get("error_type") !== "cancel";
        return is_own_message && not_canceled && ["all", "own"].includes(api.settings.get("allow_message_retraction"));
    }

    getMessageText() {
        if (this.get("is_encrypted")) {
            const { __ } = _converse;
            return this.get("plaintext") || this.get("body") || __("Undecryptable OMEMO message");
        } else if (["groupchat", "chat", "normal"].includes(this.get("type"))) {
            return this.get("body");
        } else {
            return this.get("message");
        }
    }

    /**
     * Send out an IQ stanza to request a file upload slot.
     * https://xmpp.org/extensions/xep-0363.html#request
     */
    sendSlotRequestStanza() {
        if (!this.file) return Promise.reject(new Error("file is undefined"));

        const iq = $iq({
            "from": _converse.session.get("jid"),
            "to": this.get("slot_request_url"),
            "type": "get",
        }).c("request", {
            "xmlns": Strophe.NS.HTTPUPLOAD,
            "filename": this.file.name,
            "size": this.file.size,
            "content-type": this.file.type,
        });
        return api.sendIQ(iq);
    }

    /**
     * @param {Element} stanza
     */
    getUploadRequestMetadata(stanza) {
        const headers = sizzle(`slot[xmlns="${Strophe.NS.HTTPUPLOAD}"] put header`, stanza);
        // https://xmpp.org/extensions/xep-0363.html#request
        // TODO: Can't set the Cookie header in JavaScipt, instead cookies need
        // to be manually set via document.cookie, so we're leaving it out here.
        return {
            headers: headers
                .map((h) => ({ "name": h.getAttribute("name"), "value": h.textContent }))
                .filter((h) => ["Authorization", "Expires"].includes(h.name)),
        };
    }

    async getRequestSlotURL() {
        const { __ } = _converse;
        let stanza;
        try {
            stanza = await this.sendSlotRequestStanza();
        } catch (e) {
            log.error(e);
            return this.save({
                is_ephemeral: true,
                message: __("Sorry, could not determine upload URL."),
                type: "error",
            });
        }
        const slot = sizzle(`slot[xmlns="${Strophe.NS.HTTPUPLOAD}"]`, stanza).pop();
        if (slot) {
            this.upload_metadata = this.getUploadRequestMetadata(stanza);
            this.save({
                get: slot.querySelector("get").getAttribute("url"),
                put: slot.querySelector("put").getAttribute("url"),
            });
        } else {
            return this.save({
                is_ephemeral: true,
                message: __("Sorry, could not determine file upload URL."),
                type: "error",
            });
        }
    }

    uploadFile() {
        const xhr = new XMLHttpRequest();

        xhr.onreadystatechange = async (event) => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                log.info("Status: " + xhr.status);
                if (xhr.status === 200 || xhr.status === 201) {
                    let attrs = {
                        body: this.get("get"),
                        message: this.get("get"),
                        oob_url: this.get("get"),
                        upload: SUCCESS,
                    };
                    /**
                     * *Hook* which allows plugins to change the attributes
                     * saved on the message once a file has been uploaded.
                     * @event _converse#afterFileUploaded
                     */
                    attrs = await api.hook("afterFileUploaded", this, attrs);
                    this.save(attrs);
                } else {
                    log.error(event);
                    xhr.onerror(new ProgressEvent(`Response status: ${xhr.status}`));
                }
            }
        };

        xhr.upload.addEventListener(
            "progress",
            (evt) => {
                if (evt.lengthComputable) {
                    this.set("progress", evt.loaded / evt.total);
                }
            },
            false
        );

        xhr.onerror = () => {
            const { __ } = _converse;
            let message;
            if (xhr.responseText) {
                message = __(
                    'Sorry, could not succesfully upload your file. Your server’s response: "%1$s"',
                    xhr.responseText
                );
            } else {
                message = __("Sorry, could not succesfully upload your file.");
            }
            this.save({
                is_ephemeral: true,
                message,
                type: "error",
                upload: FAILURE,
            });
        };
        xhr.open("PUT", this.get("put"), true);
        xhr.setRequestHeader("Content-type", this.file.type);
        this.upload_metadata.headers?.forEach((h) => xhr.setRequestHeader(h.name, h.value));
        xhr.send(this.file);
    }
}

export default BaseMessage;

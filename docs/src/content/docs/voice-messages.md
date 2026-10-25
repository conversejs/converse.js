---
title: Voice Messages
description: Recording and sending voice messages in Converse.
---

The `converse-voice-messages` plugin lets users record a voice message in the
browser and send it to a chat or groupchat. The recording is uploaded with
[XEP-0363](https://xmpp.org/extensions/xep-0363.html) HTTP File Upload and sent
like any other shared file, so it's encrypted when OMEMO is on, and recipients
play it with their usual audio player, in Converse or any other client.

## Enabling voice messages

The plugin is enabled by default. To turn it off, add it to
[blacklisted_plugins](/docs/configuration/#blacklisted_plugins):

```javascript
converse.initialize({
    blacklisted_plugins: ['converse-voice-messages'],
});
```

The "Record a voice message" entry in the attachment menu is only shown when:

- your XMPP server supports HTTP File Upload,
- the browser supports the `MediaRecorder` and `getUserMedia` APIs, and
- in a groupchat, the user is allowed to post messages.

The browser asks the user for permission to use the microphone the first time
they record.

## Recording a voice message

Open the attachment menu from the paperclip in the chat toolbar and choose
"Record a voice message" to open the recorder above the message form.
Recording starts once microphone access is granted. You can pause
and resume, send the recording, or cancel it. Pressing `Escape` while the
recorder has focus cancels the recording.

Only one recording can be active at a time. Starting one in another chat
cancels the first.

If the upload fails, the recorder keeps the recording so that it can be sent
again or discarded.

## Configuration

The "Record a voice message" entry can be hidden with the `voice_message` key of
[visible_toolbar_buttons](/docs/configuration/#visible_toolbar_buttons).

### max_voice_message_duration

- **Type**: Number
- **Default**: `0`

The maximum length of a recording, in seconds, or `0` for no fixed limit. When
it's reached, recording stops and the message is sent.

Whatever this is set to, a recording is also stopped before it would outgrow
your upload service's maximum file size, as worked out from that size and
[voice_message_bitrate](#voice_message_bitrate), so that it can always be sent.
A fixed limit is only needed to keep messages short for some other reason.

### voice_message_bitrate

- **Type**: Number
- **Default**: `32000`

The audio bitrate of a recording, in bits per second. The default is plenty
for speech in Opus, the default format, and keeps recordings small, at about a
quarter of a megabyte a minute. Raise it for music, or for a format that
compresses less well.

### voice_message_mime_type

- **Type**: String
- **Default**: `'audio/webm;codecs=opus'`

The preferred audio format. If the browser can't record in this format,
Converse uses the first supported one of Opus in WebM, Opus in Ogg and MP4 audio.

## Customizing the recorder

The recorder is the `converse-audio-recorder` custom element, which can be
[overridden](/docs/development/plugin-development/#overriding-custom-elements)
like any other.

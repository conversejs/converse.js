---
title: Voice Messages
description: Recording and sending voice messages in Converse.
---

Converse can record a voice message in the browser and send it to a chat or
groupchat. The recording is uploaded with
[XEP-0363](https://xmpp.org/extensions/xep-0363.html) HTTP File Upload and sent
like any other shared file, so recipients play it with the usual audio player.

## Requirements

- Your XMPP server must support HTTP File Upload.
- The browser must support the `MediaRecorder` and `getUserMedia` APIs. The
  microphone button is hidden when they're unavailable.
- The user must allow Converse to use the microphone.

## Recording a voice message

Click the microphone button in the chat toolbar to open the recorder. While
recording, the following keys are available:

| Key      | Description                    |
| -------- | ------------------------------ |
| `Space`  | Pause or resume the recording  |
| `Enter`  | Stop the recording and send it |
| `Escape` | Cancel the recording           |

## Configuration

The microphone button can be hidden with the `voice_message` key of
[visible_toolbar_buttons](/docs/configuration/#visible_toolbar_buttons).

### enable_voice_messages

- **Type**: Boolean
- **Default**: `true`

Enables or disables recording voice messages.

### max_voice_message_duration

- **Type**: Number
- **Default**: `300`

The maximum length of a recording, in seconds.

### voice_message_bitrate

- **Type**: Number
- **Default**: `96000`

The audio bitrate of a recording, in bits per second.

### voice_message_mime_type

- **Type**: String
- **Default**: `'audio/webm;codecs=opus'`

The preferred audio format. If the browser can't record in this format,
Converse picks the best one it supports.

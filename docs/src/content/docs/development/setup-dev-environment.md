---
title: Setting up a Dev Environment
description: How to set up a development environment for Converse.
---

## Prerequisites

To develop and customize Converse, you'll first need to check out Converse's Git repository:

```bash
git clone https://github.com/conversejs/converse.js.git
cd converse.js
```

We use development tools which depend on Node.js and NPM (the Node package manager). Make sure you have these installed on your system.

It's recommended that you use [NVM](https://github.com/nvm-sh/nvm) (the Node version manager) to ensure you're using the correct version of Node specified in the project.

Refer to the [NVM GitHub page](https://github.com/nvm-sh/nvm#install--update-script) for installation instructions.

## Setting Up Your Development Environment

Once you have the repository cloned and Node.js installed, run the following commands to set up your development environment:

```bash
npm install
npm run serve &
npm run watch
```

Alternatively, if you have GNU Make installed, you can use these equivalent commands:

```bash
make serve_bg
make watch
```

After running these commands, visit http://localhost:8000/dev.html to load Converse in your browser.

To customize the Converse configuration, modify [dev.html](https://github.com/conversejs/converse.js/blob/master/dev.html) and update the settings passed to `converse.initialize()`.

## Development Workflow

RSPack will automatically monitor ("watch") the source files and rebuild the project whenever you make changes.
You don't need to manually trigger rebuilds, but you will need to reload the browser tab to see your changes.

## Live Reloading

For a more seamless development experience with automatic browser refreshes, you can try the RSPack development server:

```bash
make devserver
# or alternatively
npm run devserver
```

Then visit http://localhost:8080.

## Troubleshooting

After running `npm install`, you should see a new *node_modules* directory containing all the external dependencies
of Converse.

If this directory doesn't exist or appears empty, something went wrong during installation.

Check the terminal output from your `npm install` command for any error messages.

For additional help, you can join our community chatroom: [discuss@conference.conversejs.org](xmpp:discuss@conference.conversejs.org).

If you don't have an XMPP client installed, you can access the chatroom directly through [conversejs.org](https://conversejs.org/fullscreen#converse/room?jid=discuss@conference.conversejs.org) where you can log in and join the conversation.

## Optional: Enabling OMEMO Encryption

If you want to develop with OMEMO end-to-end encryption support, you'll need to load [libsignal](https://github.com/signalapp/libsignal-protocol-javascript) separately in your page:

```html
<script src="3rdparty/libsignal-protocol-javascript/dist/libsignal-protocol.js"></script>
```

Libsignal is loaded separately because it's released under the [GPLv3 license](https://github.com/signalapp/libsignal-protocol-javascript/blob/master/LICENSE), which requires all dependent JavaScript code to also be open-sourced under the same license. Loading it separately gives you the choice of whether to include it based on your licensing requirements.

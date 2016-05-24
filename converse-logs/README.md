# How to use saved Chrome/Chromium logs to replay events

**NOTE**: This feature is very experimental and in many cases doesn't work
without data massaging and ugly hacks.

It's possible to save the log output from Chrome/Chromium (I haven't tried this
yet with any other browser) and then to replay that log output in the browser.

This can be a very helpful technique to track down bugs.

To do this, follow the following steps:

1. Save the log file (right click and then click "Save as" in the browser's console).
2. Rename the log file, making sure it ends in `.html`
3. Move the log file to the `converse-logs` directory in the converse.js repo.
4. Add `<log>` to the top of the log file and `</log>` to the bottom of the log file.
5. In `converse-logs/converse-logs.js`, add a new entry for the log file (don't
   include the `.html` part of the file name.
6. Make sure that `spec/transcripts` is "required"-ed in `tests/main.js`
6. Open `tests.html` in your browser.

Your logs will run first, and then all the other tests will run afterwards.


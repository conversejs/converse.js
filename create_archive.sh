#!/bin/bash
export ASSET_PATH=/dist/
make clean
make pot
make po
tee -a src/i18n/converse.pot src/i18n/de/LC_MESSAGES/converse.po << EOF
msgid "There are no files to download."
msgstr "Es sind keine Dateien zum Download verfügbar."
msgid "The Filename "
msgstr "Der Dateiname "
msgid " is invalid. Recovering last valid Filename."
msgstr " ist ungültig! Der letzte gültige Dateiname wurde wiederhergestellt"
msgid "No Files for Download selected!"
msgstr "Es wurden keine Dateien zum Download ausgewählt"
msgid "Attachements from the Chat"
msgstr "Anlagen aus dem Chatverlauf"
msgid "Please enter the name of the zip file."
msgstr "Bitte geben Sie den Namen der Zip-Datei an."
msgid "Download attachements"
msgstr "Anlagen speichern"
msgid "Timestamp"
msgstr "Zeitstempel"
msgid "User"
msgstr "Nutzer"
msgid "File"
msgstr "Datei"
msgid "Filename"
msgstr "Dateiname"
msgid "Download in Progress..."
msgstr "Dateien werden heruntergeladen"
msgid "Start Download-Dialog"
msgstr "Starte Download-Dialog"
EOF

make dist

curl -o dist/download-dialog.js https://raw.githubusercontent.com/area-42/community-plugins/update_download-dialog_for_v7/packages/download-dialog/dist/download-dialog.js
echo a12382415a01c6b269a65fdd3ad039f69ac3eba8220cb95d623308527847782f  dist/download-dialog.js | sha256sum -c - || exit -1
curl -o dist/download-dialog.js.map https://raw.githubusercontent.com/area-42/community-plugins/update_download-dialog_for_v7/packages/download-dialog/dist/download-dialog.js.map
echo 145ed68450544f157d349bdb97120a21dc72a182c303b994e538aa925573c382  dist/download-dialog.js.map | sha256sum -c - || exit -1

zip -r conversejs7.zip \
	converse_config.js \
	index.html \
	mobile.html \
	fullscreen.html \
	logo \
	twemoji \
	sounds \
	dist \
	images

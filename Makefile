# You can set these variables from the command line.
BOWER           ?= node_modules/.bin/bower
BUILDDIR        = ./docs
PAPER           =
PHANTOMJS       ?= ./node_modules/.bin/phantomjs
SPHINXBUILD     ?= ./bin/sphinx-build
SPHINXOPTS      =
PO2JSON         ?= ./node_modules/.bin/po2json
SASS            ?= sass 
GRUNT           ?= ./node_modules/.bin/grunt
HTTPSERVE		?= ./node_modules/.bin/http-server

# Internal variables.
ALLSPHINXOPTS   = -d $(BUILDDIR)/doctrees $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source
# the i18n builder cannot share the environment and doctrees with the others
I18NSPHINXOPTS  = $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source

.PHONY: all help clean html epub changes linkcheck gettext po pot po2json merge release css minjs build

all: dev

help:
	@echo "Please use \`make <target>' where <target> is one of the following"
	@echo "  build      create minified builds containing converse.js and all its dependencies"
	@echo "  changes    make an overview of all changed/added/deprecated items added to the documentation"
	@echo "  css        generate CSS from the Sass files"
	@echo "  dev        set up the development environment"
	@echo "  epub       export the documentation to epub"
	@echo "  gettext    make PO message catalogs of the documentation"
	@echo "  html       make standalone HTML files of the documentation"
	@echo "  linkcheck  check all documentation external links for integrity"
	@echo "  cssmin     minify the CSS files"
	@echo "  po         generate gettext PO files for each i18n language"
	@echo "  po2json    generate JSON files from the language PO files"
	@echo "  pot        generate a gettext POT file to be used for translations"
	@echo "  release    make a new minified release"
	@echo "  serve      serve this directory via a webserver on port 8000"

########################################################################
## Miscellaneous

serve: dev
	$(HTTPSERVE) -p 8000

########################################################################
## Translation machinery

pot:
	xgettext --keyword=__ --keyword=___ --from-code=UTF-8 --output=locale/converse.pot converse.js --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=0.7.0 -c --language="python";

po:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec msgmerge {}/LC_MESSAGES/converse.po ./locale/converse.pot -U \;

merge: po

po2json:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec $(PO2JSON) -p -f jed -d converse {}/LC_MESSAGES/converse.po {}/LC_MESSAGES/converse.json \;

########################################################################
## Release management

release:
	sed -i s/Project-Id-Version:\ Converse\.js\ [0-9]\.[0-9]\.[0-9]/Project-Id-Version:\ Converse.js\ $(VERSION)/ locale/converse.pot
	sed -i s/\"version\":\ \"[0-9]\.[0-9]\.[0-9]\"/\"version\":\ \"$(VERSION)\"/ bower.json
	sed -i s/\"version\":\ \"[0-9]\.[0-9]\.[0-9]\"/\"version\":\ \"$(VERSION)\"/ package.json
	sed -i s/v[0-9]\.[0-9]\.[0-9]\.zip/v$(VERSION)\.zip/ index.html
	sed -i s/v[0-9]\.[0-9]\.[0-9]\.tar\.gz/v$(VERSION)\.tar\.gz/ index.html
	sed -i s/version\ =\ \'[0-9]\.[0-9]\.[0-9]\'/version\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -i s/release\ =\ \'[0-9]\.[0-9]\.[0-9]\'/release\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -i "s/(Unreleased)/(`date +%Y-%m-%d`)/" docs/CHANGES.rst
	make pot
	make po
	make po2json
	make build

########################################################################
## Install dependencies

stamp-npm: package.json
	npm install
	touch stamp-npm

stamp-bower: stamp-npm bower.json
	$(BOWER) install
	touch stamp-bower

clean::
	rm -f stamp-npm stamp-bower
	rm -rf node_modules components

dev: clean
	npm install
	$(BOWER) update;
	bundle install --path=~/

########################################################################
## Builds

css::
	$(SASS) sass/converse.scss > css/converse.css

jsmin:
	./node_modules/requirejs/bin/r.js -o src/build.js && ./node_modules/requirejs/bin/r.js -o src/build-no-locales-no-otr.js && ./node_modules/requirejs/bin/r.js -o src/build-no-otr.js && ./node_modules/requirejs/bin/r.js -o src/build-website.js

cssmin:
	$(GRUNT) cssmin

build::
	$(GRUNT) jst
	$(GRUNT) minify

########################################################################
## Tests

check:: stamp-npm
	$(PHANTOMJS) node_modules/phantom-jasmine/lib/run_jasmine_test.coffee tests.html

########################################################################
## Documentation

html:
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

epub:
	$(SPHINXBUILD) -b epub $(ALLSPHINXOPTS) $(BUILDDIR)/epub
	@echo
	@echo "Build finished. The epub file is in $(BUILDDIR)/epub."

gettext:
	$(SPHINXBUILD) -b gettext $(I18NSPHINXOPTS) $(BUILDDIR)/locale
	@echo
	@echo "Build finished. The message catalogs are in $(BUILDDIR)/locale."

changes:
	$(SPHINXBUILD) -b changes $(ALLSPHINXOPTS) $(BUILDDIR)/changes
	@echo
	@echo "The overview file is in $(BUILDDIR)/changes."

linkcheck:
	$(SPHINXBUILD) -b linkcheck $(ALLSPHINXOPTS) $(BUILDDIR)/linkcheck
	@echo
	@echo "Link check complete; look for any errors in the above output " \
	      "or in $(BUILDDIR)/linkcheck/output.txt."

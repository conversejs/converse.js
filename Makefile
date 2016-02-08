# You can set these variables from the command line.
BOWER           ?= node_modules/.bin/bower
BUILDDIR        = ./docs
BUNDLE          ?= ./.bundle/bin/bundle
GRUNT           ?= ./node_modules/.bin/grunt
HTTPSERVE		?= ./node_modules/.bin/http-server
JSHINT 			?= ./node_modules/.bin/jshint
PAPER           =
PHANTOMJS       ?= ./node_modules/.bin/phantomjs
PO2JSON         ?= ./node_modules/.bin/po2json
SASS            ?= ./.bundle/bin/sass
SPHINXBUILD     ?= ./bin/sphinx-build
SPHINXOPTS      =

# Internal variables.
ALLSPHINXOPTS   = -d $(BUILDDIR)/doctrees $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source
SOURCES	= $(wildcard *.js) $(wildcard spec/*.js) $(wildcard src/*.js)
JSHINTEXCEPTIONS = $(GENERATED) \
		   src/otr.js \
		   src/crypto.js \
		   src/build-no-jquery.js \
		   src/build-no-locales-no-otr.js \
		   src/build-no-otr.js \
		   src/build.js \
		   src/bigint.js
CHECKSOURCES	= $(filter-out $(JSHINTEXCEPTIONS),$(SOURCES))

.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of the following:"
	@echo ""
	@echo " all           A synonym for 'make dev'."
	@echo " build         Create minified builds of converse.js and all its dependencies."
	@echo " changes       Make an overview of all changed/added/deprecated items added to the documentation."
	@echo " clean         Remove downloaded the stamp-* guard files as well as all NPM, bower and Ruby packages."
	@echo " css           Generate CSS from the Sass files."
	@echo " cssmin        Minify the CSS files."
	@echo " dev           Set up the development environment. To force a fresh start, run 'make clean' first."
	@echo " epub          Export the documentation to epub."
	@echo " html          Make standalone HTML files of the documentation."
	@echo " linkcheck     Check all documentation external links for integrity."
	@echo " po            Generate gettext PO files for each i18n language."
	@echo " po2json       Generate JSON files from the language PO files."
	@echo " pot           Generate a gettext POT file to be used for translations."
	@echo " release       Prepare a new release of converse.js. E.g. make release VERSION=0.9.5"
	@echo " serve         Serve this directory via a webserver on port 8000."
	@echo " stamp-bower   Install bower dependencies and create the guard file stamp-bower which will prevent those dependencies from being installed again."
	@echo " stamp-npm     Install NPM dependencies and create the guard file stamp-npm which will prevent those dependencies from being installed again."
	@echo " stamp-bundler Install Bundler (Ruby) dependencies and create the guard file stamp-bundler which will prevent those dependencies from being installed again."
	@echo " watch         Tells Sass to watch the .scss files for changes and then automatically update the CSS files."

.PHONY: all
all: dev

########################################################################
## Miscellaneous

.PHONY: serve
serve: stamp-npm
	$(HTTPSERVE) -p 8000

########################################################################
## Translation machinery

.PHONY: pot
pot:
	xgettext --keyword=__ --keyword=___ --from-code=UTF-8 --output=locale/converse.pot converse.js --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=0.10.1 -c --language="python";

.PHONY: po
po:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec msgmerge {}/LC_MESSAGES/converse.po ./locale/converse.pot -U \;

.PHONY: po2json
po2json:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec $(PO2JSON) -p -f jed -d converse {}/LC_MESSAGES/converse.po {}/LC_MESSAGES/converse.json \;

########################################################################
## Release management

.PHONY: release
release:
	sed -i s/Project-Id-Version:\ Converse\.js\ [0-9]\.[0-9]\.[0-9]/Project-Id-Version:\ Converse.js\ $(VERSION)/ locale/converse.pot
	sed -i s/\"version\":\ \"[0-9]\.[0-9]\.[0-9]\"/\"version\":\ \"$(VERSION)\"/ bower.json
	sed -i s/\"version\":\ \"[0-9]\.[0-9]\.[0-9]\"/\"version\":\ \"$(VERSION)\"/ package.json
	sed -i s/--package-version=[0-9]\.[0-9]\.[0-9]/--package-version=$(VERSION)/ Makefile
	sed -i s/v[0-9]\.[0-9]\.[0-9]\.zip/v$(VERSION)\.zip/ index.html
	sed -i s/v[0-9]\.[0-9]\.[0-9]\.tar\.gz/v$(VERSION)\.tar\.gz/ index.html
	sed -i s/version\ =\ \'[0-9]\.[0-9]\.[0-9]\'/version\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -i s/release\ =\ \'[0-9]\.[0-9]\.[0-9]\'/release\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -i "s/(Unreleased)/(`date +%Y-%m-%d`)/" docs/CHANGES.md
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

stamp-bundler:
	mkdir -p .bundle
	gem install --user bundler --bindir .bundle/bin
	$(BUNDLE) install --path .bundle --binstubs .bundle/bin
	touch stamp-bundler

.PHONY: clean
clean::
	rm -f stamp-npm stamp-bower stamp-bundler
	rm -rf node_modules components .bundle

.PHONY: dev
dev: stamp-bower stamp-bundler

########################################################################
## Builds

.PHONY: css
css: converse.css

converse.css:: stamp-bundler stamp-bower
	$(SASS) -I ./components/bourbon/app/assets/stylesheets/ sass/converse.scss css/converse.css

.PHONY: watch
watch: stamp-bundler
	$(SASS) --watch -I ./components/bourbon/app/assets/stylesheets/ sass/converse.scss:css/converse.css

.PHONY: jsmin
jsmin:
	$(GRUNT) jsmin

.PHONY: watch
cssmin: stamp-npm
	$(GRUNT) cssmin

.PHONY: build
build:: stamp-npm
	$(GRUNT) jst
	$(GRUNT) minify

########################################################################
## Tests

.PHONY: jshint
jshint: stamp-npm
	$(JSHINT) --config jshintrc $(CHECKSOURCES)

.PHONY: watch
check: stamp-npm jshint
	$(PHANTOMJS) node_modules/phantom-jasmine/lib/run_jasmine_test.coffee tests.html

########################################################################
## Documentation

.PHONY: html
html:
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

.PHONY: epub
epub:
	$(SPHINXBUILD) -b epub $(ALLSPHINXOPTS) $(BUILDDIR)/epub
	@echo
	@echo "Build finished. The epub file is in $(BUILDDIR)/epub."

.PHONY: changes
changes:
	$(SPHINXBUILD) -b changes $(ALLSPHINXOPTS) $(BUILDDIR)/changes
	@echo
	@echo "The overview file is in $(BUILDDIR)/changes."

.PHONY: linkcheck
linkcheck:
	$(SPHINXBUILD) -b linkcheck $(ALLSPHINXOPTS) $(BUILDDIR)/linkcheck
	@echo
	@echo "Link check complete; look for any errors in the above output " \
	      "or in $(BUILDDIR)/linkcheck/output.txt."

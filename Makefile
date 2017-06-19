# You can set these variables from the command line.
BOURBON_TEMPLATES = ./node_modules/bourbon/app/assets/stylesheets/ 
BUILDDIR		= ./docs
BUNDLE		  	?= ./.bundle/bin/bundle
GRUNT		   	?= ./node_modules/.bin/grunt
HTTPSERVE	   	?= ./node_modules/.bin/http-server
ESLINT		  	?= ./node_modules/.bin/eslint
PAPER		   	=
CHROMIUM		?= ./node_modules/.bin/run-headless-chromium
RJS			 	?= ./node_modules/.bin/r.js
PO2JSON		 	?= ./node_modules/.bin/po2json
SASS			?= ./.bundle/bin/sass
CLEANCSS		?= ./node_modules/clean-css-cli/bin/cleancss --skip-rebase
SPHINXBUILD	 	?= ./bin/sphinx-build
SPHINXOPTS	  	=

# Internal variables.
ALLSPHINXOPTS   = -d $(BUILDDIR)/doctrees $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source

.PHONY: all
all: dev dist

.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of the following:"
	@echo ""
	@echo " all           A synonym for 'make dev'."
	@echo " build         Create minified builds of converse.js and all its dependencies."
	@echo " changes       Make an overview of all changed/added/deprecated items added to the documentation."
	@echo " clean         Remove downloaded the stamp-* guard files as well as all NPM and Ruby packages."
	@echo " css           Generate CSS from the Sass files."
	@echo " dev           Set up the development environment. To force a fresh start, run 'make clean' first."
	@echo " epub          Export the documentation to epub."
	@echo " html          Make standalone HTML files of the documentation."
	@echo " doc           Same as "doc". Make standalone HTML files of the documentation."
	@echo " linkcheck     Check all documentation external links for integrity."
	@echo " po            Generate gettext PO files for each i18n language."
	@echo " po2json       Generate JSON files from the language PO files."
	@echo " pot           Generate a gettext POT file to be used for translations."
	@echo " release       Prepare a new release of converse.js. E.g. make release VERSION=0.9.5"
	@echo " serve         Serve this directory via a webserver on port 8000."
	@echo " stamp-npm     Install NPM dependencies and create the guard file stamp-npm which will prevent those dependencies from being installed again."
	@echo " stamp-bundler Install Bundler (Ruby) dependencies and create the guard file stamp-bundler which will prevent those dependencies from being installed again."
	@echo " watch         Tells Sass to watch the .scss files for changes and then automatically update the CSS files."


########################################################################
## Miscellaneous

.PHONY: serve
serve: dev 
	$(HTTPSERVE) -p 8000 -c-1

.PHONY: serve_bg
serve_bg: dev
	$(HTTPSERVE) -p 8000 -c-1 -s &

########################################################################
## Translation machinery

GETTEXT = xgettext --keyword=__ --keyword=___ --from-code=UTF-8 --output=locale/converse.pot src/*.js --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=3.0.2 -c

.PHONY: pot
pot:
	$(GETTEXT) --language="javascript" 2>&1 > /dev/null; test $$? -eq 0 && exit 0 || $(GETTEXT) --language="python" && exit $$?;

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
	sed -ri s/Version:\ [0-9]\+\.[0-9]\+\.[0-9]\+/Version:\ $(VERSION)/ src/start.frag
	sed -ri s/Project-Id-Version:\ Converse\.js\ [0-9]\+\.[0-9]\+\.[0-9]\+/Project-Id-Version:\ Converse.js\ $(VERSION)/ locale/converse.pot
	sed -ri s/\"version\":\ \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\":\ \"$(VERSION)\"/ bower.json
	sed -ri s/\"version\":\ \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\":\ \"$(VERSION)\"/ package.json
	sed -ri s/--package-version=[0-9]\+\.[0-9]\+\.[0-9]\+/--package-version=$(VERSION)/ Makefile
	sed -ri s/v[0-9]\+\.[0-9]\+\.[0-9]\+\.zip/v$(VERSION)\.zip/ index.html
	sed -ri s/v[0-9]\+\.[0-9]\+\.[0-9]\+\.tar\.gz/v$(VERSION)\.tar\.gz/ index.html
	sed -ri s/version\ =\ \'[0-9]\+\.[0-9]\+\.[0-9]\+\'/version\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -ri s/release\ =\ \'[0-9]\+\.[0-9]\+\.[0-9]\+\'/release\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -ri "s/(Unreleased)/(`date +%Y-%m-%d`)/" docs/CHANGES.md
	make pot
	make po
	make po2json
	make build

########################################################################
## Install dependencies

stamp-npm: package.json
	npm install
	touch stamp-npm

stamp-bundler: Gemfile
	mkdir -p .bundle
	gem install --user bundler --bindir .bundle/bin
	$(BUNDLE) install --path .bundle --binstubs .bundle/bin
	touch stamp-bundler

.PHONY: clean
clean:
	-rm -f stamp-npm stamp-bundler
	-rm -rf node_modules .bundle

.PHONY: dev
dev: stamp-bundler stamp-npm

########################################################################
## Builds

.PHONY: css
css: sass/*.scss css/converse.css css/converse.min.css css/mobile.min.css css/theme.min.css css/converse-muc-embedded.min.css css/inverse.css css/inverse.min.css

css/inverse.css:: stamp-bundler sass sass/*
	$(SASS) -I $(BOURBON_TEMPLATES) sass/inverse/inverse.scss css/inverse.css

css/inverse.min.css:: css/inverse.css
	$(CLEANCSS) css/inverse.css > css/inverse.min.css

css/converse-muc-embedded.css:: stamp-bundler sass/*
	$(SASS) -I $(BOURBON_TEMPLATES) sass/_muc_embedded.scss css/converse-muc-embedded.css

css/converse-muc-embedded.min.css:: stamp-bundler sass css/converse-muc-embedded.css
	$(CLEANCSS) css/converse-muc-embedded.css > css/converse-muc-embedded.min.css

css/converse.css:: stamp-bundler sass/*
	$(SASS) -I $(BOURBON_TEMPLATES) sass/converse/converse.scss css/converse.css

css/converse.min.css:: css/converse.css
	$(CLEANCSS) css/converse.css > css/converse.min.css

css/theme.min.css:: stamp-npm css/theme.css
	$(CLEANCSS) css/theme.css > css/theme.min.css

css/mobile.min.css:: stamp-npm sass/*
	$(CLEANCSS) css/mobile.css > css/mobile.min.css

.PHONY: watch
watch: stamp-bundler
	$(SASS) --watch -I ./node_modules/bourbon/app/assets/stylesheets/ sass/converse.scss:css/converse.css sass/_muc_embedded.scss:css/converse-muc-embedded.css

BUILDS = dist/converse.js \
		 dist/converse.min.js \
         dist/inverse.js \
		 dist/inverse.min.js \
         dist/converse-mobile.js \
         dist/converse-mobile.min.js \
         dist/converse-muc-embedded.js \
         dist/converse-muc-embedded.min.js \
         dist/converse-no-jquery.js \
 		 dist/converse-no-jquery.min.js \
		 dist/converse-no-dependencies.min.js \
		 dist/converse-no-dependencies.js

dist/converse.min.js: src locale node_modules *.js
	$(RJS) -o src/build.js include=converse out=dist/converse.min.js
dist/converse.js: src locale node_modules *.js
	$(RJS) -o src/build.js include=converse out=dist/converse.js optimize=none 
dist/inverse.js: src locale node_modules *.js
	$(RJS) -o src/build-inverse.js include=inverse out=dist/inverse.js optimize=none 
dist/inverse.min.js: src locale node_modules *.js
	$(RJS) -o src/build-inverse.js include=inverse out=dist/inverse.min.js
dist/converse-no-jquery.min.js: src locale node_modules *.js
	$(RJS) -o src/build.js include=converse wrap.endFile=end-no-jquery.frag exclude=jquery exclude=jquery.noconflict out=dist/converse-no-jquery.min.js
dist/converse-no-jquery.js: src locale node_modules *.js
	$(RJS) -o src/build.js include=converse wrap.endFile=end-no-jquery.frag exclude=jquery exclude=jquery.noconflict out=dist/converse-no-jquery.js optimize=none 
dist/converse-no-dependencies.min.js: src locale node_modules *.js
	$(RJS) -o src/build-no-dependencies.js
dist/converse-no-dependencies.js: src locale node_modules *.js
	$(RJS) -o src/build-no-dependencies.js optimize=none out=dist/converse-no-dependencies.js
dist/converse-mobile.min.js: src locale node_modules *.js
	$(RJS) -o src/build.js paths.converse=src/converse-mobile include=converse out=dist/converse-mobile.min.js
dist/converse-mobile.js: src locale node_modules *.js
	$(RJS) -o src/build.js paths.converse=src/converse-mobile include=converse out=dist/converse-mobile.js optimize=none 
dist/converse-muc-embedded.min.js: src locale node_modules *.js
	$(RJS) -o src/build.js paths.converse=src/converse-embedded include=converse out=dist/converse-muc-embedded.min.js
dist/converse-muc-embedded.js: src locale node_modules *.js
	$(RJS) -o src/build.js paths.converse=src/converse-embedded include=converse out=dist/converse-muc-embedded.js optimize=none 

.PHONY: jsmin
jsmin: $(BUILDS)

.PHONY: dist
dist:: build

.PHONY: build
build:: dev css
	$(GRUNT) json
	make jsmin

########################################################################
## Tests

.PHONY: eslint
eslint: stamp-npm
	# $(ESLINT) src/
	# $(ESLINT) spec/

.PHONY: check
check: eslint
	LOG_CR_VERBOSITY=INFO $(CHROMIUM) http://localhost:8000/tests.html


########################################################################
## Documentation

.PHONY: html
html:
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

.PHONY: html
doc: html

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

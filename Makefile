# You can set these variables from the command line.
UGLIFYJS		?= node_modules/.bin/uglifyjs
BABEL			?= node_modules/.bin/babel
BOURBON 		= ./node_modules/bourbon/app/assets/stylesheets/ 
BOOTSTRAP		= ./node_modules/ 
BUILDDIR		= ./docs
BUNDLE		  	?= ./.bundle/bin/bundle
CHROMIUM		?= ./node_modules/.bin/run-headless-chromium
CLEANCSS		?= ./node_modules/clean-css-cli/bin/cleancss --skip-rebase
ESLINT		  	?= ./node_modules/.bin/eslint
HTTPSERVE	   	?= ./node_modules/.bin/http-server
HTTPSERVE_PORT  ?= 8000
INKSCAPE        ?= inkscape
PAPER		   	=
PO2JSON		 	?= ./node_modules/.bin/po2json
RJS			 	?= ./node_modules/.bin/r.js
SASS			?= ./.bundle/bin/sass
SPHINXBUILD	 	?= ./bin/sphinx-build
SED				?= sed
SPHINXOPTS	  	=
OXIPNG          ?= oxipng


# In the case user wishes to use RVM 
USE_RVM                 ?= false
RVM_RUBY_VERSION        ?= 2.4.2
ifeq ($(USE_RVM),true)
	RVM_USE                 = rvm use $(RVM_RUBY_VERSION)
endif

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
	@echo " clean         Remove all NPM and Ruby packages."
	@echo " css           Generate CSS from the Sass files."
	@echo " dev           Set up the development environment. To force a fresh start, run 'make clean' first."
	@echo " html          Make standalone HTML files of the documentation."
	@echo " po            Generate gettext PO files for each i18n language."
	@echo " po2json       Generate JSON files from the language PO files."
	@echo " pot           Generate a gettext POT file to be used for translations."
	@echo " release       Prepare a new release of converse.js. E.g. make release VERSION=0.9.5"
	@echo " serve         Serve this directory via a webserver on port 8000."
	@echo " stamp-npm     Install NPM dependencies"
	@echo " stamp-bundler Install Bundler (Ruby) dependencies"
	@echo " watch         Tells Sass to watch the .scss files for changes and then automatically update the CSS files."
	@echo " logo          Generate PNG logos of multiple sizes."


########################################################################
## Miscellaneous

.PHONY: serve
serve: dev 
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1

.PHONY: serve_bg
serve_bg: dev
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1 -s &

########################################################################
## Translation machinery

GETTEXT = xgettext --language="JavaScript" --keyword=__ --keyword=___ --from-code=UTF-8 --output=locale/converse.pot dist/converse-no-dependencies.js --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=3.3.4 -c

.PHONY: pot
pot: dist/converse-no-dependencies.js
	$(GETTEXT) 2>&1 > /dev/null; exit $$?;

.PHONY: po
po:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec msgmerge {}/LC_MESSAGES/converse.po ./locale/converse.pot -U \;

.PHONY: po2json
po2json:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec $(PO2JSON) -f jed1.x -d converse {}/LC_MESSAGES/converse.po {}/LC_MESSAGES/converse.json \;

########################################################################
## Release management

.PHONY: release
release:
	$(SED) -ri s/Version:\ [0-9]\+\.[0-9]\+\.[0-9]\+/Version:\ $(VERSION)/ COPYRIGHT
	$(SED) -ri s/Version:\ [0-9]\+\.[0-9]\+\.[0-9]\+/Version:\ $(VERSION)/ src/start.frag
	$(SED) -ri s/Project-Id-Version:\ Converse\.js\ [0-9]\+\.[0-9]\+\.[0-9]\+/Project-Id-Version:\ Converse.js\ $(VERSION)/ locale/converse.pot
	$(SED) -ri s/\"version\":\ \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\":\ \"$(VERSION)\"/ package.json
	$(SED) -ri s/--package-version=[0-9]\+\.[0-9]\+\.[0-9]\+/--package-version=$(VERSION)/ Makefile
	$(SED) -ri s/v[0-9]\+\.[0-9]\+\.[0-9]\+\.zip/v$(VERSION)\.zip/ index.html
	$(SED) -ri s/v[0-9]\+\.[0-9]\+\.[0-9]\+\.tar\.gz/v$(VERSION)\.tar\.gz/ index.html
	$(SED) -ri s/version\ =\ \'[0-9]\+\.[0-9]\+\.[0-9]\+\'/version\ =\ \'$(VERSION)\'/ docs/source/conf.py
	$(SED) -ri s/release\ =\ \'[0-9]\+\.[0-9]\+\.[0-9]\+\'/release\ =\ \'$(VERSION)\'/ docs/source/conf.py
	$(SED) -ri "s/(Unreleased)/`date +%Y-%m-%d`/" CHANGES.md
	$(SED) -ri "s/cdn.conversejs.org\/[0-9]+\.[0-9]+\.[0-9]+/cdn.conversejs.org\/$(VERSION)/" docs/source/quickstart.rst
	make pot
	make po
	make po2json
	make build

########################################################################
## Install dependencies

stamp-npm: package.json package-lock.json
	npm install
	touch stamp-npm

stamp-bundler: Gemfile
	mkdir -p .bundle
	$(RVM_USE)
	gem install --user bundler --bindir .bundle/bin
	$(BUNDLE) install --path .bundle --binstubs .bundle/bin
	touch stamp-bundler

.PHONY: clean
clean:
	rm -rf node_modules .bundle stamp-npm
	rm dist/*.min.js
	rm css/theme.min.css
	rm css/converse.min.css
	rm css/*.map

.PHONY: dev
dev: stamp-bundler stamp-npm

########################################################################
## Builds

.PHONY: css
css: dev sass/*.scss css/converse.css css/converse.min.css css/theme.min.css css/inverse.css css/inverse.min.css css/fonts.css

css/inverse.css:: dev sass sass
	$(SASS) -I $(BOURBON) -I $(BOOTSTRAP) sass/inverse/inverse.scss css/inverse.css

css/converse.css:: dev sass
	$(SASS) -I $(BOURBON) -I $(BOOTSTRAP) sass/converse/converse.scss css/converse.css

css/fonts.css:: dev sass
	$(SASS) -I $(BOURBON) -I $(BOOTSTRAP) sass/font-awesome.scss $@

css/%.min.css:: css/%.css
	make dev
	$(CLEANCSS) $< > $@

.PHONY: watch
watch: dev
	$(SASS) --watch -I $(BOURBON) -I $(BOOTSTRAP) sass:css

.PHONY: watchjs
watchjs: dev
	$(BABEL) --source-maps --watch=./src --out-dir=./builds

transpile: dev src
	$(BABEL) --source-maps --out-dir=./builds ./src
	$(BABEL) --source-maps --out-dir=./builds ./node_modules/backbone.vdomview/backbone.vdomview.js
	touch transpile

.PHONY: logo
logo: logo/conversejs-transparent16.png \
      logo/conversejs-transparent19.png \
      logo/conversejs-transparent48.png \
      logo/conversejs-transparent128.png \
      logo/conversejs-transparent512.png \
      logo/conversejs-filled16.png \
      logo/conversejs-filled19.png \
      logo/conversejs-filled48.png \
      logo/conversejs-filled128.png \
      logo/conversejs-filled512.png \

logo/conversejs-transparent%.png:: logo/conversejs-transparent.svg
	$(INKSCAPE) -e $@ -w $* $<
	$(OXIPNG) $@

logo/conversejs-filled%.png:: logo/conversejs-filled.svg
	$(INKSCAPE) -e $@ -w $* $<
	$(OXIPNG) $@

BUILDS = dist/converse.js \
		 dist/converse.min.js \
         dist/converse-headless.js \
		 dist/converse-headless.min.js \
		 dist/converse-muc-embedded.js \
		 dist/converse-muc-embedded.min.js \
		 dist/converse-no-dependencies.min.js \
		 dist/converse-no-dependencies.js

# dist/converse-esnext.js \
# dist/converse-esnext.min.js \

dist/converse.js: transpile src stamp-npm
	$(RJS) -o src/build.js include=converse out=dist/converse.js optimize=none 
dist/converse.min.js: transpile src stamp-npm
	$(RJS) -o src/build.js include=converse out=dist/converse.min.js
dist/converse-headless.js: transpile src stamp-npm
	$(RJS) -o src/build.js paths.converse=src/headless include=converse out=dist/converse-headless.js optimize=none 
dist/converse-headless.min.js: transpile src stamp-npm
	$(RJS) -o src/build.js paths.converse=src/headless include=converse out=dist/converse-headless.min.js
dist/converse-esnext.js: src stamp-npm
	$(RJS) -o src/build-esnext.js include=converse out=dist/converse-esnext.js optimize=none 
dist/converse-esnext.min.js: src stamp-npm
	$(RJS) -o src/build-esnext.js include=converse out=dist/converse-esnext.min.js
dist/converse-no-dependencies.js: transpile src stamp-npm
	$(RJS) -o src/build-no-dependencies.js optimize=none out=dist/converse-no-dependencies.js
dist/converse-no-dependencies.min.js: transpile src stamp-npm
	$(RJS) -o src/build-no-dependencies.js out=dist/converse-no-dependencies.min.js
dist/converse-muc-embedded.js: transpile src stamp-npm
	$(RJS) -o src/build.js paths.converse=src/converse-embedded include=converse out=dist/converse-muc-embedded.js optimize=none 
dist/converse-muc-embedded.min.js: transpile src stamp-npm
	$(RJS) -o src/build.js paths.converse=src/converse-embedded include=converse out=dist/converse-muc-embedded.min.js

.PHONY: dist
dist:: build

.PHONY: build
build:: dev css transpile $(BUILDS)

########################################################################
## Tests

.PHONY: eslint
eslint: stamp-npm
	$(ESLINT) src/
	$(ESLINT) spec/

.PHONY: check
check: eslint
	LOG_CR_VERBOSITY=INFO $(CHROMIUM) --no-sandbox http://localhost:$(HTTPSERVE_PORT)/tests/index.html

########################################################################
## Documentation

.PHONY: html
html:
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

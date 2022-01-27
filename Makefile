# You can set these variables from the command line.
BABEL			?= node_modules/.bin/babel
BOOTSTRAP		= ./node_modules/
BUILDDIR		= ./docs
KARMA			?= ./node_modules/.bin/karma
CLEANCSS		?= ./node_modules/clean-css-cli/bin/cleancss
ESLINT			?= ./node_modules/.bin/eslint
HTTPSERVE	 	?= ./node_modules/.bin/http-server
HTTPSERVE_PORT	?= 8000
INKSCAPE		?= inkscape
INSTALL			?= install
JSDOC			?=	./node_modules/.bin/jsdoc
LERNA			?= ./node_modules/.bin/lerna
OXIPNG			?= oxipng
PAPER		 	=
RJS				?= ./node_modules/.bin/r.js
NPX				?= ./node_modules/.bin/npx
SASS			?= ./node_modules/.bin/sass
SED				?= sed
SPHINXBUILD	 	?= ./bin/sphinx-build
SPHINXOPTS		=
XGETTEXT		= xgettext


# Internal variables.
ALLSPHINXOPTS	= -d $(BUILDDIR)/doctrees $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source
VERSION_FORMAT	= [0-9]+\.[0-9]+\.[0-9]+

.PHONY: all
all: node_modules dist

.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of the following:"
	@echo ""
	@echo " all         	Set up dev environment and create all builds"
	@echo " dist       		Create minified builds of converse.js and all its dependencies."
	@echo " clean       	Remove all NPM packages."
	@echo " check       	Run all tests."
	@echo " dev         	Set up the development environment and build unminified resources. To force a fresh start, run 'make clean' first."
	@echo " devserver   	Set up the development environment and start the webpack dev server."
	@echo " doc         	Make standalone HTML files of the documentation."
	@echo " po          	Generate gettext PO files for each i18n language."
	@echo " pot         	Generate a gettext POT file to be used for translations."
	@echo " release     	Prepare a new release of converse.js. E.g. make release VERSION=0.9.5"
	@echo " serve       	Serve this directory via a webserver on port 8000."
	@echo " serve_bg    	Same as \"serve\", but do it in the background"
	@echo " node_modules	Install NPM dependencies"
	@echo " watch       	Watch for changes on JS and scss files and automatically update the generated files."
	@echo " logo        	Generate PNG logos of multiple sizes."


########################################################################
## Miscellaneous

.PHONY: serve
serve: node_modules dist
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1

.PHONY: serve_bg
serve_bg: node_modules
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1 -s &

########################################################################
## Translation machinery

dist/converse-no-dependencies.js: src webpack/webpack.common.js webpack/webpack.nodeps.js @converse/headless node_modules
	npm run nodeps

GETTEXT = $(XGETTEXT) --from-code=UTF-8 --language=JavaScript --keyword=__ --keyword=___ --keyword=i18n_ --force-po --output=src/i18n/converse.pot --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=9.0.0 dist/converse-no-dependencies.js -c

src/i18n/converse.pot: dist/converse-no-dependencies.js
	$(GETTEXT) 2>&1 > /dev/null; exit $$?;
	rm dist/converse-no-dependencies.js
	rm dist/tmp.css

.PHONY: pot
pot: src/i18n/converse.pot

.PHONY: po
po:
	find ./src/i18n -maxdepth 1 -mindepth 1 -type d -exec msgmerge {}/LC_MESSAGES/converse.po ./src/i18n/converse.pot -U \;

########################################################################
## Release management

.PHONY: release
release:
	$(SED) -i '/^_converse.VERSION_NAME =/s/=.*/= "v$(VERSION)";/' src/headless/core.js
	$(SED) -i '/Version:/s/:.*/: $(VERSION)/' COPYRIGHT
	$(SED) -i '/Project-Id-Version:/s/:.*/: Converse.js $(VERSION)\n"/' src/i18n/converse.pot
	$(SED) -i '/"version":/s/:.*/: "$(VERSION)",/' manifest.json
	$(SED) -i '/"version":/s/:.*/: "$(VERSION)",/' package.json
	$(SED) -i '/"version":/s/:.*/: "$(VERSION)",/' src/headless/package.json
	$(SED) -ri 's/--package-version=$(VERSION_FORMAT)/--package-version=$(VERSION)/' Makefile
	$(SED) -i -e "/version =/s/=.*/= '$(VERSION)'/" -e "/release =/s/=.*/= '$(VERSION)'/" docs/source/conf.py
	$(SED) -i "s/[Uu]nreleased/`date +%Y-%m-%d`/" CHANGES.md
	$(SED) -ri 's,cdn.conversejs.org/$(VERSION_FORMAT),cdn.conversejs.org/$(VERSION),' docs/source/quickstart.rst
	$(SED) -ri 's,cdn.conversejs.org/$(VERSION_FORMAT),cdn.conversejs.org/$(VERSION),' *.html
	$(SED) -ri 's,cdn.conversejs.org/$(VERSION_FORMAT),cdn.conversejs.org/$(VERSION),' demo/*.html
	make pot
	make po
	make dist
	npm pack
	cd src/headless && npm pack

.PHONY: postrelease
postrelease:
	$(SED) -i '/^_converse.VERSION_NAME =/s/=.*/= "v$(VERSION)dev";/' src/headless/core.js

########################################################################
## Install dependencies

$(LERNA):
	npm install lerna

${NVM_DIR}/nvm.sh:
	wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
	source ~/.bashrc

.PHONY: nvm
nvm: ${NVM_DIR}/nvm.sh

.PHONY: node
node: .nvmrc
	. $(HOME)/.nvm/nvm.sh && nvm install

package-lock.json: package.json
	npm install

node_modules: $(LERNA) package.json package-lock.json src/headless/package.json src/headless/package-lock.json
	npm run lerna

.PHONY: clean
clean:
	npm run clean
	rm -rf lib bin include parts

.PHONY: dev
dev: node_modules
	npm run dev

.PHONY: devserver
devserver: node_modules
	npm run serve

########################################################################
## Builds

dist/converse.js:: node_modules
	npm run dev

dist/converse.css:: node_modules
	npm run dev

dist/website.css:: node_modules src/shared/styles/website.scss
	$(SASS) --load-path=$(BOOTSTRAP) src/shared/styles/website.scss $@

dist/website.min.css:: node_modules dist/website.css
	$(CLEANCSS) dist/website.css > $@

.PHONY: watch
watch: node_modules
	npm run watch

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

@converse/headless: src/headless

src/headless/dist/converse-headless.js: src webpack/webpack.common.js node_modules @converse/headless
	npm run headless-dev

src/headless/dist/converse-headless.min.js: src webpack/webpack.common.js node_modules @converse/headless
	npm run headless

dist:: node_modules src/* | dist/converse.js dist/converse.css dist/website.css dist/website.min.css src/headless/dist/converse-headless.min.js src/headless/dist/converse-headless.js
	npm run prod

.PHONY: install
install:: dist

.PHONY: cdn
cdn:: node_modules
	npm run cdn

########################################################################
## Tests

.PHONY: eslint
eslint: node_modules
	$(ESLINT) src/*.js
	$(ESLINT) src/utils/*.js
	$(ESLINT) src/headless/*.js
	$(ESLINT) src/headless/utils/*.js

.PHONY: check
check: eslint | dist/converse.js dist/converse.css
	$(KARMA) start karma.conf.js $(ARGS)

.PHONY: test
test:
	$(KARMA) start karma.conf.js $(ARGS)

########################################################################
## Documentation

./bin/activate:
	python3 -m venv .

.installed.cfg: requirements.txt buildout.cfg
	./bin/pip install -r requirements.txt
	./bin/pip install --upgrade pip==19.2.1
	./bin/pip install --upgrade setuptools==41.0.1
	./bin/buildout -v

docsdev: ./bin/activate .installed.cfg

.PHONY: html
html: doc

.PHONY: doc
doc: node_modules docsdev apidoc
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	make apidoc
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

PHONY: apidoc
apidoc:
	find ./src -type d -name node_modules -prune -false -o -name "*.js" | xargs $(JSDOC) --private --readme docs/source/jsdoc_intro.md -c docs/source/conf.json -d docs/html/api

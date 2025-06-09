# You can set these variables from the command line.
BOOTSTRAP			= ./node_modules/
BUILDDIR			= ./docs
KARMA				?= ./node_modules/.bin/karma
CLEANCSS			?= ./node_modules/clean-css-cli/bin/cleancss
HTTPSERVE_PORT		?= 8008
HTTPS_SERVE_PORT	?= 8443
INKSCAPE			?= inkscape
INSTALL				?= install
OXIPNG				?= oxipng
PAPER		 		=
RJS					?= ./node_modules/.bin/r.js
NPX					?= ./node_modules/.bin/npx
SASS				?= ./node_modules/.bin/sass
SED					?= sed
SPHINXBUILD	 		?= ./bin/sphinx-build
SPHINXOPTS			=
XGETTEXT			= xgettext


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
	npm run serve -- -p $(HTTPSERVE_PORT)

.PHONY: serve_bg
serve_bg: node_modules
	npm run serve -- -p $(HTTPSERVE_PORT) -s &
	npm run serve-tls -- -p $(HTTPS_SERVE_PORT) -s &

certs:
	mkdir certs
	cd certs && openssl req -newkey rsa:4096 -x509 -sha256 -days 365 -nodes -out chat.example.org.crt -keyout chat.example.org.key

########################################################################
## Translation machinery

GETTEXT = $(XGETTEXT) --from-code=UTF-8 --language=JavaScript --keyword=__ --keyword=___ --keyword=i18n_ --force-po --output=src/i18n/converse.pot --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=11.0.1 dist/converse-no-dependencies.js -c

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

.PHONY: version
version:
	$(SED) -i '/^export const VERSION_NAME =/s/=.*/= "v$(VERSION)";/' src/headless/shared/constants.js
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

release-checkout:
	git clone git@github.com:conversejs/converse.js.git --depth 1 --branch $(BRANCH) release-$(BRANCH)
	cd release-$(BRANCH) && make dist

.PHONY: publish
publish:
	make release-checkout
	cd release-$(BRANCH) && npm pack && npm publish
	cd release-$(BRANCH)/src/headless && npm pack && npm publish
	find ./release-$(BRANCH)/ -name "converse.js-*.tgz" -exec mv {} . \;
	find ./release-$(BRANCH)/src/headless -name "converse-headless-*.tgz" -exec mv {} . \;
	rm -rf release-$(BRANCH)

.PHONY: postrelease
postrelease:
	$(SED) -i '/^export const VERSION_NAME =/s/=.*/= "v$(VERSION)dev";/' src/headless/shared/constants.js

.PHONY: deploy
deploy:
	git clone --branch v$(VERSION) git@github.com:conversejs/converse.js.git --depth 1 $(VERSION)
	cd $(VERSION) && make node && ASSET_PATH=https://cdn.conversejs.org/$(VERSION)/dist/ make dist && make doc
	cd .. && git pull && make node && ASSET_PATH=https://cdn.conversejs.org/dist/ make dist && make doc

########################################################################
## Install dependencies

${NVM_DIR}/nvm.sh:
	wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
	source ~/.bashrc

.PHONY: nvm
nvm: ${NVM_DIR}/nvm.sh

.PHONY: node
node: .nvmrc
	. $(HOME)/.nvm/nvm.sh && nvm install

node_modules: package.json src/headless/package.json
	npm install

.PHONY: clean
clean:
	npm run clean
	rm -rf lib bin include parts

.PHONY: dev
dev: node_modules
	npm run dev

.PHONY: devserver
devserver: node_modules
	npm run devserver

########################################################################
## Builds

dist/converse-no-dependencies.js: src webpack/webpack.common.js webpack/webpack.nodeps.js @converse/headless node_modules
	npm run nodeps

dist/converse.js:: node_modules
	npm run build

dist/converse.css:: node_modules
	npm run build

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

dist:: node_modules src/**/* | dist/website.css dist/website.min.css
	npm run headless
	# Ideally this should just be `npm run build`.
	# The additional steps are necessary to properly generate JSON chunk files
	# from the .po files. The nodeps config uses preset-env with IE11.
	# Somehow this is necessary.
	npm run nodeps
	$(eval TMPD := $(shell mktemp -d))
	mv dist/locales $(TMPD) && \
	npm run build && \
	mv $(TMPD)/locales/*-po.js dist/locales/ && \
	rm -rf $(TMPD)

.PHONY: install
install:: dist

.PHONY: cdn
cdn:: node_modules
	npm run cdn

.PHONY: types
types:: node_modules
	npm run types

########################################################################
## Tests

.PHONY: check-git-clean
check-git-clean:
	@if ! git diff-index --quiet HEAD src/types src/headless/types; then\
		echo "Error: uncommitted type changes. Please include all type changes in your commit"\
		exit 1;\
	fi

.PHONY: eslint
eslint: node_modules
	npm run lint

.PHONY: check
check: eslint | dist/converse.js dist/converse.css
	npm run types
	make check-git-clean
	npm run test -- $(ARGS)

.PHONY: test
test:
	npm run test -- $(ARGS)

########################################################################
## Documentation

./bin/activate:
	python3 -m venv .

.PHONY: docsdev
docsdev: ./bin/activate requirements.txt
	./bin/python -m ensurepip --upgrade
	./bin/python -m pip install --upgrade setuptools
	./bin/pip3 install -r requirements.txt

.PHONY: html
html: doc

.PHONY: sphinx
sphinx: node_modules docsdev
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html

.PHONY: doc
doc:
	make sphinx
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

# Release checklist

1. Run `make check` to check that all tests pass.
2. Run `make release VERSION=7.0.0`
3. Do a `git diff` to check if things look sane.
4. Do a quick manual test with the `dist` files (via `index.html`)
5. `git commit -am "Release 7.0.0"`
6. `git tag -s v7.0.0 -m "Release 7.0.0"`
7. Run `git push && git push --tags`
8. Update https://conversejs.org
    * `cd /home/conversejs/converse.js`
    * `git clone --branch v7.0.0 git@github.com:conversejs/converse.js.git 7.0.0`
    * `cd 7.0.0 && ASSET_PATH=https://cdn.conversejs.org/7.0.0/dist/ make dist`
    * `cd .. && git pull && ASSET_PATH=https://cdn.conversejs.org/dist/ make dist`
9. Update release page on Github
11. Run `npm publish && cd src/headless/ && npm publish`
12. Update the repository on weblate
13. Decide on next release number and run `make postrelease VERSION=7.0.1`

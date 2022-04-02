# Release checklist

1. Check that weblate translations are all merged in
2. Run `make check` to check that all tests pass.
3. Run `make release VERSION=9.1.1`
4. Do a `git diff` to check if things look sane.
5. Do a quick manual test with the `dist` files (via `index.html`)
6. `git commit -am "Release 9.1.1"`
7. `git tag -s v9.1.1 -m "Release 9.1.1"`
8. Run `git push && git push origin v9.1.1`
9. Update https://conversejs.org
    * `cd /home/conversejs/converse.js`
    * `git clone --branch v9.1.1 git@github.com:conversejs/converse.js.git 9.1.1`
    * `cd 9.1.1 && nvm install && ASSET_PATH=https://cdn.conversejs.org/9.1.1/dist/ make dist && make doc`
    * `cd .. && git pull && nvm install && ASSET_PATH=https://cdn.conversejs.org/dist/ make dist && make doc`
10. Update release page on Github
11. Run `npm publish && cd src/headless/ && npm publish`
12. Update the repository on weblate
13. Decide on next release number and run `make postrelease VERSION=9.1.2`

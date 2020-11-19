# Release checklist

1. Check that weblate translations are all merged in
2. Run `make check` to check that all tests pass.
3. Run `make release VERSION=7.0.1`
4. Do a `git diff` to check if things look sane.
5. Do a quick manual test with the `dist` files (via `index.html`)
6. `git commit -am "Release 7.0.1"`
7. `git tag -s v7.0.1 -m "Release 7.0.1"`
8. Run `git push && git push --tags`
9. Update https://conversejs.org
    * `cd /home/conversejs/converse.js`
    * `git clone --branch v7.0.1 git@github.com:conversejs/converse.js.git 7.0.1`
    * `cd 7.0.1 && ASSET_PATH=https://cdn.conversejs.org/7.0.1/dist/ make dist && make doc`
    * `cd .. && git pull && ASSET_PATH=https://cdn.conversejs.org/dist/ make dist && make doc`
10. Update release page on Github
11. Run `npm pack` to generate tarballs and upload them to the Github release page
12. Run `npm publish && cd src/headless/ && npm publish`
13. Update the repository on weblate
14. Decide on next release number and run `make postrelease VERSION=7.0.2`

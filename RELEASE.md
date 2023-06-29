# Release checklist

1. Merge weblate translations: https://hosted.weblate.org/projects/conversejs/translations/#repository
2. Run `make check` to check that all tests pass.
3. Run `make version VERSION=10.1.5`
4. Do a `git diff` to check if things look sane.
5. Do a quick manual test with the `dist` files (via `index.html`)
6. `git commit -am "Release 10.1.5"`
7. `git tag -s v10.1.5 -m "Release 10.1.5"`
8. `git push && git push origin v10.1.5`
9. `make publish BRANCH=v10.1.5`
10. Update release page on Github
    * Upload tar files
11. Update https://conversejs.org
    * `cd /home/conversejs/converse.js`
    * `make deploy VERSION=10.1.5`
12. Update the repository on weblate
13. Decide on next release number and run `make postrelease VERSION=10.1.6`

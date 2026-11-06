# Release checklist

For a **pre-release** (beta/rc), use a SemVer pre-release version such as
`14.0.0-beta.1` (later `-beta.2`, `-rc.1`, …). It sorts *before* `14.0.0`, so a
plain `npm install converse.js` and `^14`-style ranges won't pick it up —
integrators opt in with `npm install converse.js@beta`. Follow the same steps
below, applying the _(pre-release)_ notes where they appear.

1. Merge weblate translations: https://hosted.weblate.org/projects/conversejs/translations/#repository
2. Run `make check` to check that all tests pass.
3. Run `make version VERSION=10.1.5`
    * `@converse/log` is released separately and `make version` doesn't touch it.
      If `src/log` changed since its last release, bump its version, publish
      `@converse/log` first and update its range in `src/headless/package.json`.
      `make check` fails if the range doesn't match the `src/log` version, but it
      can't tell that `src/log` changed without a bump.
    * _(pre-release)_ e.g. `make version VERSION=14.0.0-beta.1`. This stamps
      today's date into `CHANGES.md` (replacing `Unreleased`) and points the demo
      HTML at a `.../14.0.0-beta.1/` CDN path. Keep the `Unreleased` header for the
      final release, and `git checkout` the demo HTML since you're skipping the
      deploy in step 11.
4. Do a `git diff` to check if things look sane.
    * Besides the version bumps, expect `package-lock.json` to change: `make version`
      updates the `@converse/headless` pin and both workspace versions in it (this
      needs network access).
5. Do a quick manual test with the `dist` files (via `index.html`)
6. `git commit -am "Release 10.1.5"`
7. `git tag -s v10.1.5 -m "Release 10.1.5"`
8. `git push && git push origin v10.1.5`
9. `make publish BRANCH=v10.1.5`
    * This publishes `@converse/headless` first, because converse.js depends on
      that exact version. If only the converse.js publish failed, don't rerun
      `make publish` (npm refuses to publish the same headless version twice).
      The `release-v10.1.5` checkout is still there, so finish by hand:
      ```
      cd release-v10.1.5 && npm publish --tag latest && cd ..
      mv release-v10.1.5/converse.js-*.tgz release-v10.1.5/src/headless/converse-headless-*.tgz .
      rm -rf release-v10.1.5
      ```
      For a pre-release, use the same `NPM_TAG` as below (`--tag beta`).
    * _(pre-release)_ publish to the `beta` dist-tag so the stable `latest` tag is
      left untouched: `make publish BRANCH=v14.0.0-beta.1 NPM_TAG=beta`
10. Update release page on Github
    * Upload tar files
    * _(pre-release)_ mark the GitHub release as a **pre-release**
11. Update https://conversejs.org
    * `cd /home/conversejs/converse.js`
    * `make deploy VERSION=10.1.5`
    * _(pre-release)_ **skip this step** — it updates the production site and the
      stable `/dist/` CDN path
12. Update the repository on weblate
13. Decide on next release number and run `make postrelease VERSION=10.1.6`
    * _(pre-release)_ **skip** — keep iterating toward the final `14.0.0`, which
      then follows this checklist as a normal release

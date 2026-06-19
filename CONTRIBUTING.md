# Contributing

The developer docs are here:
https://conversejs.org/docs/html/development.html

See also AGENTS.md which has useful information even for humans.

## Using AI / LLM assistance

Contributions with the help of LLMs or coding agents are accepted, but the same
quality bar applies as to any contribution: understand and be able to explain
your changes, make sure they build and pass the tests, and disclose AI usage in
your pull request. Unreviewed, untested, auto-generated "slop" will be closed.
See [LLM and GenAI usage](README.md#llm-and-genai-usage) in the README for the
full policy.

## Quickstart

```
npm install
npm run serve &
npm run watch
```

Go to http://localhost:8000/dev.html

Then modify `dev.html` so that `converse.initialize()` is called with relevant settings.

Webpack will "watch" the source files and automatically recreate the build if they
are modified. So you don't have to do anything to rebuild whenever you've
change something in a file but you will have to manually reload the browser tab
to see the changes in the browser.

## Live reloading

If you want to have live reloading whenever any of the source files change, you
can run `make devserver` (or `npm run devserver`).

Then go to http://localhost:8080

Then modify `webpack.html` so that `converse.initialize()` is called with relevant settings.

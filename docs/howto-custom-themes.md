# Custom Themes - Draft Guide

This is a minimal draft to help users set up a custom theme. Maintainers, please advise on structure and config keys.

## Goal
Show how to:
- Place theme files in a predictable folder.
- Register or select a theme.
- Override a small component as an example.
- Verify that the theme is applied.

## Suggested structure (to be confirmed)
```
project-root/
  themes/
    my-theme/
      variables.css
      components/
        button.css
```

## Minimal example
1) Create themes/my-theme/variables.css with a single color var:
```
:root {
  --brand-color: #4b8bf4;
}
```
2) Override one component style in themes/my-theme/components/button.css:
```
.myapp-button {
  background: var(--brand-color);
}
```

## Selecting the theme
- If there is an official config key to select a theme, document it here.
- Otherwise, document how to load the theme assets at startup.

## Checklist to verify
- [ ] Run the app and navigate to a button component.
- [ ] Confirm the button background uses the new brand color.
- [ ] Screenshot before and after.

## Troubleshooting
- If the styles do not apply, confirm the theme files are loaded after the core styles.
- Check the network panel for 404s on theme assets.

## Maintainer guidance requested
- Preferred docs location and navigation entry.
- Official config keys for theme selection.
- Best practice for variables and component overrides.

## Where does this page belong?
- This draft lives under `docs/`. Maintainers may prefer another folder or filename.

## Selecting a theme (placeholder until maintainers confirm)
- If an official config key exists, document it here.
- Otherwise describe how to load theme assets at startup.

## Verification checklist (quick)
- [ ] App loads without errors
- [ ] Overridden button uses brand color
- [ ] Before/after screenshots captured

> Note: This is intentionally minimal to reduce review time. We will expand once maintainers confirm details.


## Verification

- Locally verified the docs build.
- Added a minimal checklist to ensure theme variables and overrides render as expected.
- Please advise if you prefer a different heading/section.

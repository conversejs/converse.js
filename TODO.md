# RSPack Migration Plan

## Implementation Prompt
"Migrate the Converse.js build system from Webpack to RSPack by:
1. Replacing all Webpack configuration files with RSPack equivalents
2. Using RSPack's built-in plugins instead of Webpack plugins where possible
3. Removing unnecessary loaders since RSPack has SWC built-in
4. Maintaining all existing functionality while improving build performance
5. Keeping the existing file structure and build process intact"

## Migration Checklist

### Configuration Files
- [x] Create `rspack.common.js` base configuration
- [x] Convert `webpack.build.js` to `rspack.build.js`
- [x] Convert `webpack.headless.js` to `rspack.headless.js` 
- [x] Convert `webpack.nodeps.js` to `rspack.nodeps.js`
- [x] Convert `webpack.serve.js` to `rspack.serve.js`

### Plugin Replacements
- [x] Replace `CircularDependencyPlugin` with `CircularDependencyRspackPlugin`
- [x] Replace `CopyWebpackPlugin` with `CopyRspackPlugin`
- [ ] Replace `MiniCssExtractPlugin` with `CssExtractRspackPlugin`
- [ ] Replace `DefinePlugin` with RSPack's version
- [ ] Remove `TerserPlugin` (handled by RSPack internally)

### Loader Optimizations
- [ ] Remove `swc-loader` (use RSPack's built-in SWC)
- [ ] Update SCSS/CSS loaders to work with RSPack
- [ ] Keep `po-loader` as is (still needed)
- [ ] Update asset handling for fonts/images

### Package.json Updates
- [x] Add RSPack dependencies
- [x] Update build scripts
- [x] Remove unused Webpack dependencies
- [x] Verify all other dependencies still work

### Testing
- [ ] Test production build
- [ ] Test headless build  
- [ ] Test development server
- [ ] Verify all assets are included correctly
- [ ] Check for circular dependency warnings

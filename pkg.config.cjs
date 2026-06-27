/**
 * @yao-pkg/pkg configuration.
 * Assets list lives here because the CLI does not expose --assets.
 * Target and final output name are passed by scripts/build-binary.js via CLI.
 */
const pkg = require('./package.json');

/** @type {import('@yao-pkg/pkg').PkgConfig} */
module.exports = {
  pkg: {
    assets: ['client.html']
  }
};

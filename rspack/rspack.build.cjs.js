import { merge } from 'webpack-merge';
import buildConfig from '../rspack/rspack.build.js';

export default (env, argv) =>
    merge(buildConfig(env, argv), {
        output: {
            filename: '[name].js',
            chunkFilename: 'chunkjs.cjs/[name].js',
        },
    });

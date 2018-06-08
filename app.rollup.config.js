import typescript from 'rollup-plugin-typescript2';
import * as RollupUtils from 'rollup-pluginutils';

export default {
  input: 'src/main.ts',
  indent: false,
  output: {
    file: 'scripts/app.js',
    format: 'iife'
  },
  // name: 'core',
  plugins: [
    typescript({
      tsconfig: 'tsconfig.json',
      tsconfigOverride: {
        compilerOptions: {
          noUnusedLocals: false,
        }
      },
      cacheRoot: '.rollupcache'
    })
  ]
};

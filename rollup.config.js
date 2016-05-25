import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  plugins: [
    babel(),
    nodeResolve({
      jsnext: true,  // Default: false
      main: true,  // Default: true
      browser: true,  // Default: false
    }), commonjs({
      include: 'node_modules/**',  // Default: undefined
      sourceMap: false,  // Default: true
    })
  ],
  entry: 'src/snapback.js',
  format: 'umd',
  moduleName: 'Snapback'
};

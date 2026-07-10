const path = require('path');
const { DefinePlugin } = require('webpack');
const Dotenv = require('dotenv-webpack');
const { VueLoaderPlugin } = require('vue-loader');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

module.exports = {
  mode: "development",
  entry: './src/client/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'public/js'),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.vue'],
    alias: {
      'vue': '@vue/runtime-dom',
      '@': path.resolve(__dirname, 'src/client'),
      '@common': path.resolve(__dirname, 'src/common')
    }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: 'vue-loader',
        exclude: /(node_modules)/,
      },
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            appendTsSuffixTo: [/\.vue$/], // required for <script setup lang="ts">. see: https://github.com/vuejs/vue-loader/issues/1955#issuecomment-1125835335 and https://github.com/TypeStrong/ts-loader#appendtssuffixto
            transpileOnly: true // disable type checking. We use ForkTsCheckerWebpackPlugin instead. see https://shzhangji.com/blog/2022/07/24/add-typescript-support-to-vue-2-project/
          },
        },
        exclude: /(node_modules)/,
      },
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'postcss-loader'
        ],
        exclude: /(node_modules)/,
      }
    ],
  },
  plugins: [
    new Dotenv(),
    new VueLoaderPlugin(),
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: path.resolve(__dirname, 'src', 'client', 'tsconfig.json'),
        extensions: {
          vue: {
            enabled: true,
            compiler: '@vue/compiler-sfc'
          }
        }
      }
    }),
    new DefinePlugin({
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
    })
  ]
};
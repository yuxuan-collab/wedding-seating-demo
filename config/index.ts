import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'wedding-seating-demo',
  date: '2026-05-12',
  designWidth: 375,
  deviceRatio: {
    375: 2,
    750: 1,
    828: 1.81
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  framework: 'react',
  compiler: {
    type: 'vite'
  },
  cache: {
    enable: false
  },
  mini: {},
  h5: {
    publicPath: '/',
    staticDirectory: 'static'
  }
})

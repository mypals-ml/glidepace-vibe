module.exports = {
  configureWebpack: {
    devtool: 'eval-source-map'
  },
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  }
};

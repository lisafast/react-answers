const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api', // This is the path prefix you want to proxy
    createProxyMiddleware({
      target: 'http://localhost:3001', // Your backend server
      changeOrigin: true,
    })
  );
};

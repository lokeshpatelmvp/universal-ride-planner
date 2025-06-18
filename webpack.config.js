const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './client/app.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'client/index.html', to: 'index.html' },
        { from: 'styles.css', to: 'styles.css' }
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  }
}; 
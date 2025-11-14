const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const ExtensionReloader = require('@reorx/webpack-ext-reloader');

// 1. Export a function instead of an object
// This lets us read the "mode" (development vs. production)
module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';

  // 2. This is your base config
  const config = {
    mode: isDevelopment ? 'development' : 'production',

    // 3. Your entry is simple again. The plugin adds its own.
    entry: {
      'main': './script.ts',
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "dist"),
      clean: true,
    },
    plugins: [
      // 4. CopyPlugin is always needed
      new CopyPlugin({
        patterns: [
          { from: "manifest.json", to: "manifest.json" },
          { from: "index.html", to: "index.html" },
          { from: "style.css", to: "style.css" },
          { from: "header.svg", to: "header.svg" },
        ],
      }),
    ],
  };

  // 5. ONLY add the reloader plugin in development mode
  if (isDevelopment) {
    config.plugins.push(new ExtensionReloader({
      entries: {
        popup: 'main',
      }
    }));
  }

  return config;
};
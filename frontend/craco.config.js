module.exports = {
  devServer: (devServerConfig, { env, paths, proxy, allowedHost }) => {
    // webpack-dev-server v4以降の互換性のために setupMiddlewares を定義
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      return middlewares;
    };

    // 古いバージョンのオプションを削除 (互換性のため)
    delete devServerConfig.onAfterSetupMiddleware;
    delete devServerConfig.onBeforeSetupMiddleware;

    return devServerConfig;
  },
  // style: { // postcss.config.js / tailwind.config.js で設定するため不要
  //   postcss: {
  //     plugins: [
  //       require('tailwindcss'),
  //       require('autoprefixer'),
  //     ],
  //   },
  // },
};

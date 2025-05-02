// frontend/craco.config.js
module.exports = {
  devServer: (devServerConfig, { env, paths, proxy, allowedHost }) => {
    // setupMiddlewares を定義して、古いオプションが使われないようにする
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // 既存のミドルウェアを返す
      return middlewares;
    };

    // 念のため、古いオプションを削除
    delete devServerConfig.onAfterSetupMiddleware;
    delete devServerConfig.onBeforeSetupMiddleware;

    // 変更した設定を返す
    return devServerConfig;
  },
  // style: { // このセクション全体を削除またはコメントアウト
  //   postcss: {
  //     plugins: [
  //       require('tailwindcss'),
  //       require('autoprefixer'),
  //     ],
  //   },
  // },
};

// tailwind.config.js

module.exports = {
  darkMode: 'class', // ← これを追加
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // フォントファミリー設定
      fontFamily: {
        'reasoning': [
          '"Noto Sans"',         // 英語などラテン文字
          '"Noto Sans SC"',      // 簡体字中国語
          '"Noto Sans TC"',      // 繁体字中国語
          '"Noto Sans JP"',      // 日本語
          'sans-serif'           // フォールバック
        ],
      },
      // ダークモード用カラーパレット
      colors: {
        dark: {
          background: '#1a202c', // 例: gray-900
          text: '#e2e8f0',       // 例: gray-200
          card: '#2d3748',       // 例: gray-800
          primary: '#63b3ed',    // 例: blue-400
          // 必要に応じて追加
        },
      },
      // typography プラグインのダークモード設定
      typography: (theme) => ({
        DEFAULT: { css: { /* ライトモードの調整が必要なら記述 */ } },
        invert: { // dark:prose-invert で適用
          css: {
            '--tw-prose-body': theme('colors.dark.text'),
            '--tw-prose-headings': theme('colors.dark.text'),
            '--tw-prose-links': theme('colors.dark.primary'),
            // 必要に応じて他の要素も設定
            '--tw-prose-pre-bg': theme('colors.gray[800]'), // コードブロック背景など
            '--tw-prose-quotes': theme('colors.dark.text'),
            '--tw-prose-quote-borders': theme('colors.gray[700]'),
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

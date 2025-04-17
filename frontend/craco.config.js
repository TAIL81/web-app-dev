// craco.config.js
module.exports = {
  style: {
    postcss: {
      mode: 'file',
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
};

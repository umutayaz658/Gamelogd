module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin must be listed last (Reanimated 4 delegates its
    // worklet transform to the separately-installed react-native-worklets package).
    plugins: ['react-native-worklets/plugin'],
  };
};

const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withWorkManagerDisabled(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;
    config.modResults.manifest.$ = {
      ...config.modResults.manifest.$,
      "xmlns:tools": "http://schemas.android.com/tools",
    };
    application.provider = [
      ...(application.provider ?? []),
      {
        $: {
          "android:name": "androidx.startup.InitializationProvider",
          "tools:node": "remove",
        },
      },
    ];
    return config;
  });
};

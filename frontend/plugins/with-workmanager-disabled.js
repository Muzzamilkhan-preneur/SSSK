const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withWorkManagerDisabled(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const provider = application?.provider?.find(
      (item) =>
        item.$?.["android:name"] ===
        "androidx.startup.InitializationProvider",
    );
    if (provider?.["meta-data"]) {
      provider["meta-data"] = provider["meta-data"].filter(
        (item) =>
          item.$?.["android:name"] !==
          "androidx.work.WorkManagerInitializer",
      );
    }
    return config;
  });
};

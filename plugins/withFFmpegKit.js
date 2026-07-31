const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withFFmpegKit(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const extBlock = `
        ext {
            ffmpegKitPackage = "min-lts"
        }
      `;
      if (!config.modResults.contents.includes('ffmpegKitPackage')) {
        config.modResults.contents = config.modResults.contents.replace(
          /buildscript\s*{/,
          `buildscript {\n${extBlock}`
        );
      }
    }
    return config;
  });
};

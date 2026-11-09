const fs = require('fs/promises');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const GRADLE_WRAPPER_NETWORK_TIMEOUT_MS = 120000;

module.exports = function withGradleWrapperNetworkTimeout(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const wrapperPropertiesPath = path.join(
        config.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );
      const properties = await fs.readFile(wrapperPropertiesPath, 'utf8');
      const timeoutProperty = `networkTimeout=${GRADLE_WRAPPER_NETWORK_TIMEOUT_MS}`;
      const updatedProperties = /^networkTimeout=.*$/m.test(properties)
        ? properties.replace(/^networkTimeout=.*$/m, timeoutProperty)
        : `${properties.trimEnd()}\n${timeoutProperty}\n`;

      if (updatedProperties !== properties) {
        await fs.writeFile(wrapperPropertiesPath, updatedProperties, 'utf8');
      }

      return config;
    },
  ]);
};

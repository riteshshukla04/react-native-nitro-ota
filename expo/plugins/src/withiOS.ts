/* eslint-disable */
import { withAppDelegate,withPodfile } from '@expo/config-plugins';

const withIosAction: any = (config: any) => {
  // First, modify AppDelegate
  config = withAppDelegate(config, (config: any) => {
    if (!config.modResults.contents.includes('import NitroOtaBundleManager')) {
      config.modResults.contents = `import NitroOtaBundleManager\n${config.modResults.contents}`;
    }

    // Replace the bundle URL return with OTA bundle check
    if (
      !config.modResults.contents.includes(
        'NitroOtaBundleManager.shared.getStoredBundlePath()'
      )
    ) {
      config.modResults.contents = config.modResults.contents.replace(
        /return\s+Bundle\.main\.url\(forResource:\s*"main",\s*withExtension:\s*"jsbundle"\)/g,
        `// Check for OTA bundle
            if let bundlePath = NitroOtaBundleManager.shared.getStoredBundlePath() {
            let bundleURL = URL(fileURLWithPath: bundlePath)
            return bundleURL
            }

            // Fallback to default bundle
            return Bundle.main.url(forResource: "main", withExtension: "jsbundle")`
      );
    }

    return config;
  });

  // Then, modify Podfile
  config = withPodfile(config, (config: any) => {
    if (!config.modResults.contents.includes('pod "NitroOtaBundleManager"')) {
      config.modResults.contents = config.modResults.contents.replace(
        /(\s*)use_react_native!/g,
        `$1pod "NitroOtaBundleManager", :path => "../node_modules/react-native-nitro-ota"

$1use_react_native!`
      );
    }
    return config;
  });

  return config;
};

export default withIosAction;

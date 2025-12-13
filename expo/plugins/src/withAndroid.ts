/* eslint-disable */
import { withMainApplication } from '@expo/config-plugins';

const withAndroidAction = (config: any) => {
  return withMainApplication(config, (config) => {
    let content = config.modResults.contents;

    const isNewReactHost = content.includes('context = applicationContext');

    if (
      !content.includes(
        'import com.margelo.nitro.nitroota.core.getStoredBundlePath'
      )
    ) {
      content = content.replace(
        /import android.app.Application/g,
        `
    import android.app.Application
    import com.margelo.nitro.nitroota.core.getStoredBundlePath`
      );
    }
    if (isNewReactHost) {
      if (!content.includes('getStoredBundlePath')) {
        content = content.replace(
          /context = applicationContext,/,
          `context = applicationContext,
            jsBundleFilePath = getStoredBundlePath(applicationContext),`
        );
      }

      config.modResults.contents = content;
      return config;
    }

    if (!content.includes('getStoredBundlePath(this@MainApplication)')) {
      content = content.replace(
        /DefaultReactNativeHost\s*\(this\)\s*\{/,
        `
            DefaultReactNativeHost(this) {
  
            override fun getJSBundleFile(): String = getStoredBundlePath(this@MainApplication)`
      );
    }

    config.modResults.contents = content;
    return config;
  });
};

export default withAndroidAction;

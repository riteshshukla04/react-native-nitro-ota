import withIosAction from './withiOS';
import withAndroidAction from './withAndroid';

const withAction: any = (config: any) => {
  config = withAndroidAction(config);
  config = withIosAction(config);
  return config;
};

export default withAction;

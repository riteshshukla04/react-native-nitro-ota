import { NitroModules } from 'react-native-nitro-modules';
import type { NitroOta } from './NitroOta.nitro';

const NitroOtaHybridObject =
  NitroModules.createHybridObject<NitroOta>('NitroOta');

export function multiply(a: number, b: number): number {
  return NitroOtaHybridObject.multiply(a, b);
}

#include <jni.h>
#include "NitroOtaOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitroota::initialize(vm);
}

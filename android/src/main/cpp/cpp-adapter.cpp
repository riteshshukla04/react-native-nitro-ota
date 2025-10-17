#include <jni.h>
#include "nitrootaOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitroota::initialize(vm);
}

package com.margelo.nitro.nitroota
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroOta : HybridNitroOtaSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}

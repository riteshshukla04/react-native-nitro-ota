require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroOtaBundleManager"
  s.version      = package["version"]
  s.summary      = "Standalone Bundle Manager for NitroOta without C++ interop"
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => '13.0' }
  s.source       = { :git => "https://github.com/riteshshukla04/react-native-nitro-ota.git", :tag => "#{s.version}" }

  # Only include the bundle manager file
  s.source_files = "ios/NitroOta/Core/NitroOtaBundleManager.swift"
  
  # Set module name explicitly
  s.module_name = 'NitroOtaBundleManager'
  
  # No C++ interop - pure Swift/Objective-C mode
  s.pod_target_xcconfig = {
    'SWIFT_OBJC_INTEROP_MODE' => 'objc',
    'DEFINES_MODULE' => 'YES'
  }
  
  s.user_target_xcconfig = {
    'SWIFT_OBJC_INTEROP_MODE' => 'objc'
  }

  # No other dependencies needed
end


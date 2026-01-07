require "json"

# Get the directory where this podspec file is located
podspec_dir = File.dirname(File.expand_path(__FILE__))
package_path = File.join(podspec_dir, "package.json")
package = JSON.parse(File.read(package_path))

Pod::Spec.new do |s|
  s.name         = "NitroOtaBundleManager"
  s.version      = package["version"]
  s.summary      = "Standalone Bundle Manager for NitroOta without C++ interop"
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => '13.0' }
  s.source       = { :git => "https://github.com/riteshshukla04/react-native-nitro-ota.git", :tag => "v#{s.version}" }

  # Only include the bundle manager file
  s.source_files = "NitroIsolatedBundle/NitroIsolatedBundle.swift"
  
  # Set module name explicitly
  s.module_name = 'NitroOtaBundleManager'
  
  # Swift version
  s.swift_version = '5.8'
  
  # No dependencies needed - standalone module
end


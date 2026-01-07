require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroOta"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  # Use min_ios_version_supported if available (React Native), otherwise fallback
  s.platforms    = { :ios => defined?(min_ios_version_supported) ? min_ios_version_supported : '13.0' }
  s.source       = { :git => "https://github.com/riteshshukla04/react-native-nitro-ota.git", :tag => "v#{s.version}" }


  s.source_files = [
    "ios/**/*.{swift,h,m,mm}",
    "cpp/**/*.{hpp,cpp}",
  ]

  s.public_header_files = "ios/**/*.h"

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  s.dependency 'React-Core'
  s.dependency 'SSZipArchive'
  s.dependency 'NitroOtaBundleManager', s.version.to_s
  # Only load nitrogen files if available (React Native project context)
  nitrogen_path = File.join(__dir__, 'nitrogen/generated/ios/NitroOta+autolinking.rb')
  if File.exist?(nitrogen_path)
    load nitrogen_path
    add_nitrogen_files(s) if defined?(add_nitrogen_files)
  end

  # Only call install_modules_dependencies if available (React Native project context)
  install_modules_dependencies(s) if defined?(install_modules_dependencies)
end

#!/bin/bash
version=$1
bun clean 
bun prepare
bun build:plugin
bun release-it $version
pod trunk push NitroOtaBundleManager.podspec --allow-warnings 
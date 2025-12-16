/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Button, Alert } from 'react-native';
import { OTAUpdateManager, githubOTA, reloadApp } from 'react-native-nitro-ota';

const githubUrl = 'https://github.com/riteshshukla04/nitro-ota-bundle';
const otaVersionPath = 'ota.version';
const ref = 'iOS';

export default function App() {
  const [result, setResult] = useState<string | null>(null);
  const [otaVersion, setOtaVersion] = useState<string | null>(null);
  const [unzippedPath, setUnzippedPath] = useState<string | null>(null);

  // Initialize OTA manager with download URL and version check URL
  const otaManager = new OTAUpdateManager(
    githubOTA({ githubUrl, otaVersionPath, ref }).downloadUrl,
    githubOTA({ githubUrl, otaVersionPath, ref }).versionUrl
  );

  useEffect(() => {
    // Load stored data on app start
    setOtaVersion(otaManager.getVersion());
    setUnzippedPath(otaManager.getUnzippedPath());
  }, []);

  const handleDownload = async () => {
    try {
      const path = await otaManager.downloadUpdate();
      setResult(`Downloaded to: ${path}`);

      // Refresh stored data after download
      setOtaVersion(otaManager.getVersion());
      setUnzippedPath(otaManager.getUnzippedPath());
    } catch (error) {
      console.error('Download failed:', error);
      setResult('Download failed');
      Alert.alert('Error', 'Failed to download and extract OTA package');
    }
  };

  const handleCheckUpdates = async () => {
    try {
      const updateResult = await otaManager.checkForUpdatesJS();
      console.log('Update check result:', updateResult);

      if (updateResult?.hasUpdate && updateResult.isCompatible) {
        Alert.alert(
          'Update Available',
          `New version: ${updateResult.remoteVersion}\n${updateResult.metadata?.releaseNotes || ''}`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Download', onPress: handleDownload },
          ]
        );
      } else if (updateResult?.hasUpdate && !updateResult.isCompatible) {
        Alert.alert(
          'Update Not Compatible',
          'An update is available but not compatible with your app version'
        );
      } else {
        Alert.alert('No Updates', 'You are on the latest version');
      }
    } catch (error) {
      console.error('Update check failed:', error);
      Alert.alert('Error', 'Failed to check for updates');
    }
  };

  const handleScheduleBackgroundCheckForUpdates = () => {
    otaManager.scheduleBackgroundCheckForUpdates(10);
  };

  const handleReloadApp = () => {
    reloadApp();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OTA Download Demo</Text>

      <Text style={styles.label}>Unzipped Path:</Text>
      <Text style={styles.value}>{unzippedPath || 'None'}</Text>

      <Text style={styles.label}>OTA Version:</Text>
      <Text style={styles.value}>{otaVersion || 'None'}</Text>

      <Text style={styles.label}>Last Downloading Result:</Text>
      <Text style={styles.value}>{result || 'None'}</Text>

      <View style={styles.buttonContainer}>
        <Button title="Handle Download" onPress={handleDownload} />
        <Button title="Check for Updates" onPress={handleCheckUpdates} />
        <Button title="Reload App" onPress={handleReloadApp} />
        <Button title="Schedule Background Check for Updates" onPress={handleScheduleBackgroundCheckForUpdates} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  value: {
    fontSize: 14,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    textAlign: 'center',
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
});

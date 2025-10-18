import { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Button, Alert } from 'react-native';
import { OTAUpdateManager, githubOTA } from 'react-native-nitro-ota';







const githubUrl = "https://github.com/riteshshukla04/nitro-ota-bundle";
const otaVersionPath = "ota.version";
const ref = "main";
 


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
      const hasUpdate = await otaManager.checkForUpdates();
      if (hasUpdate) {
        Alert.alert('Update Available', 'A new OTA version is available!');
      } else {
        Alert.alert('Up to Date', 'You are running the latest version.');
      }

      // Refresh version info
      setOtaVersion(otaManager.getVersion());
    } catch (error) {
      console.error('Update check failed:', error);
      Alert.alert('Error', 'Failed to check for updates');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OTA Download Demo</Text>

      <Text style={styles.label}>Unzipped Path:</Text>
      <Text style={styles.value}>{unzippedPath || 'None'}</Text>

      <Text style={styles.label}>OTA Version:</Text>
      <Text style={styles.value}>{otaVersion || 'None'}</Text>

      <Text style={styles.label}>Last Download Result:</Text>
      <Text style={styles.value}>{result || 'None'}</Text>

      <View style={styles.buttonContainer}>
        <Button title="Download & Extract OTA" onPress={handleDownload} />
        <Button title="Check for Updates" onPress={handleCheckUpdates} />
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

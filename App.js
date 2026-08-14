import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
          <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 18, marginBottom: 10 }}>App Crashed!</Text>
          <Text style={{ color: '#333' }}>{this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function FrontScreenFlash() {
  const layers = [
    { inset: 0, borderWidth: 24, borderColor: 'rgba(255, 255, 255, 1.0)' },
    { inset: 24, borderWidth: 16, borderColor: 'rgba(255, 255, 255, 0.8)' },
    { inset: 40, borderWidth: 16, borderColor: 'rgba(255, 255, 255, 0.6)' },
    { inset: 56, borderWidth: 16, borderColor: 'rgba(255, 255, 255, 0.42)' },
    { inset: 72, borderWidth: 16, borderColor: 'rgba(255, 255, 255, 0.26)' },
    { inset: 88, borderWidth: 16, borderColor: 'rgba(255, 255, 255, 0.14)' },
    { inset: 104, borderWidth: 16, borderColor: 'rgba(255, 255, 255, 0.05)' },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {layers.map((layer, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: layer.inset,
            bottom: layer.inset,
            left: layer.inset,
            right: layer.inset,
            borderWidth: layer.borderWidth,
            borderColor: layer.borderColor,
          }}
        />
      ))}
    </View>
  );
}

function MainApp() {
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  
  const [facing, setFacing] = useState('back');
  const [isRecording, setIsRecording] = useState(false);
  const [torch, setTorch] = useState('off');
  const device = useCameraDevice(facing);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (!hasCameraPermission) await requestCameraPermission();
      if (!hasMicPermission) await requestMicPermission();
      if (!mediaPermission?.granted) await requestMediaPermission();
    })();
  }, [hasCameraPermission, hasMicPermission, mediaPermission]);

  if (!hasCameraPermission || !hasMicPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need camera and microphone permissions to record videos.</Text>
        <TouchableOpacity style={styles.buttonPrimary} onPress={() => { requestCameraPermission(); requestMicPermission(); }}>
          <Text style={styles.buttonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading camera...</Text>
      </View>
    );
  }

  const startRecordingFlow = () => {
    if (!cameraRef.current) return;
    setIsRecording(true);
    
    cameraRef.current.startRecording({
      onRecordingFinished: async (video) => {
        setIsRecording(false);
        try {
          const asset = await MediaLibrary.createAssetAsync(`file://${video.path}`);
          await MediaLibrary.createAlbumAsync("RunCamera", asset, false);
          Alert.alert("Success", "Video saved to gallery!");
        } catch (error) {
          console.error("Save error:", error);
          Alert.alert("Error", "Failed to save video to gallery.");
        }
      },
      onRecordingError: (error) => {
        console.error("Recording error:", error);
        setIsRecording(false);
      }
    });
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await cameraRef.current.stopRecording();
    } else {
      startRecordingFlow();
    }
  };

  const flipCamera = async () => {
    if (isRecording) {
      // Pause, switch, and resume to keep it in a single file
      const wasRecording = isRecording;
      await cameraRef.current.pauseRecording();
      setFacing(f => (f === 'back' ? 'front' : 'back'));
      setTorch('off');
      
      if (wasRecording) {
        // Attempt to resume immediately. We use requestAnimationFrame to ensure React has updated the device prop.
        requestAnimationFrame(async () => {
          try {
            if (cameraRef.current) {
              await cameraRef.current.resumeRecording();
            }
          } catch (e) {
            console.error("Failed to resume", e);
          }
        });
      }
    } else {
      setFacing(f => (f === 'back' ? 'front' : 'back'));
      setTorch('off'); // Turn off torch when flipping
    }
  };

  const toggleTorch = () => {
    setTorch(t => (t === 'on' ? 'off' : 'on'));
  };

  return (
    <View style={styles.container}>
      <Camera 
        style={styles.camera} 
        device={device}
        isActive={true}
        ref={cameraRef}
        video={true}
        audio={true}
        torch={facing === 'back' ? torch : 'off'}
      />
      {facing === 'front' && torch === 'on' && <FrontScreenFlash />}
      <SafeAreaView style={styles.uiContainer} pointerEvents="box-none">
        <View style={styles.bottomControls}>
          <View style={styles.sideColumn}>
            {(facing === 'front' || device?.hasTorch) && (
              <TouchableOpacity 
                style={[styles.sideButton, torch === 'on' && styles.sideButtonActive]} 
                onPress={toggleTorch}
              >
                <Ionicons 
                  name={torch === 'on' ? 'flash' : 'flash-off'} 
                  size={28} 
                  color={torch === 'on' ? '#FFD700' : '#fff'} 
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.recordButton, isRecording && styles.recordingButton]}
            onPress={toggleRecording}
          >
            <View style={styles.recordButtonInner}>
              {isRecording ? <Ionicons name="square" size={24} color="red" /> : <Ionicons name="ellipse" size={32} color="red" />}
            </View>
          </TouchableOpacity>

          <View style={[styles.sideColumn, { alignItems: 'flex-end' }]}>
            <TouchableOpacity style={styles.sideButton} onPress={flipCamera}>
              <Ionicons name="camera-reverse" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  uiContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    zIndex: 10,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 40,
    width: '100%',
  },
  sideColumn: {
    flex: 1,
  },
  sideButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  recordingButton: {
    borderColor: 'red',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 20,
    color: '#fff',
  },
  buttonPrimary: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

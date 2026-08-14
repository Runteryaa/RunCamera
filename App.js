import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const gradientStops = [
    'rgba(255, 255, 255, 1.0)',
    'rgba(255, 255, 255, 0.90)',
    'rgba(255, 255, 255, 0.72)',
    'rgba(255, 255, 255, 0.48)',
    'rgba(255, 255, 255, 0.28)',
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.03)',
    'rgba(255, 255, 255, 0.0)',
  ];

  const reverseGradientStops = [
    'rgba(255, 255, 255, 0.0)',
    'rgba(255, 255, 255, 0.03)',
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.28)',
    'rgba(255, 255, 255, 0.48)',
    'rgba(255, 255, 255, 0.72)',
    'rgba(255, 255, 255, 0.90)',
    'rgba(255, 255, 255, 1.0)',
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Outer Solid Ring for Maximum Illumination */}
      <View style={styles.flashOuterBorder} />

      {/* Top Cloud Fade */}
      <LinearGradient
        colors={gradientStops}
        style={styles.flashGradientTop}
      />

      {/* Bottom Cloud Fade */}
      <LinearGradient
        colors={reverseGradientStops}
        style={styles.flashGradientBottom}
      />

      {/* Left Cloud Fade */}
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={gradientStops}
        style={styles.flashGradientLeft}
      />

      {/* Right Cloud Fade */}
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={reverseGradientStops}
        style={styles.flashGradientRight}
      />

      {/* Soft Center Glow */}
      <View style={styles.flashCenterAmbient} />
    </View>
  );
}

function MainApp() {
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  
  const [facing, setFacing] = useState('back');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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
    setIsPaused(false);
    
    cameraRef.current.startRecording({
      onRecordingFinished: async (video) => {
        setIsRecording(false);
        setIsPaused(false);
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
        setIsPaused(false);
      }
    });
  };

  const handleRecordButtonPress = async () => {
    if (!isRecording) {
      startRecordingFlow();
    } else if (isPaused) {
      // Resume recording
      try {
        if (cameraRef.current) {
          await cameraRef.current.resumeRecording();
          setIsPaused(false);
        }
      } catch (e) {
        console.error("Resume error:", e);
      }
    } else {
      // Stop recording completely
      try {
        if (cameraRef.current) {
          await cameraRef.current.stopRecording();
        }
      } catch (e) {
        console.error("Stop error:", e);
      }
    }
  };

  const handleRecordButtonLongPress = async () => {
    if (isRecording && !isPaused) {
      // Short long-press while recording pauses
      try {
        if (cameraRef.current) {
          await cameraRef.current.pauseRecording();
          setIsPaused(true);
        }
      } catch (e) {
        console.error("Pause error:", e);
      }
    } else if (isRecording && isPaused) {
      // Long press while paused stops
      try {
        if (cameraRef.current) {
          await cameraRef.current.stopRecording();
        }
      } catch (e) {
        console.error("Stop error:", e);
      }
    }
  };

  const flipCamera = async () => {
    if (isRecording) {
      const wasPaused = isPaused;
      if (!wasPaused && cameraRef.current) {
        await cameraRef.current.pauseRecording();
      }
      setFacing(f => (f === 'back' ? 'front' : 'back'));
      setTorch('off');
      
      if (!wasPaused) {
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

      {isRecording && (
        <SafeAreaView style={styles.statusBadgeContainer} pointerEvents="none">
          <View style={styles.recordingStatusBadge}>
            <View style={[styles.statusDot, isPaused ? styles.statusDotPaused : styles.statusDotRecording]} />
            <Text style={styles.statusText}>{isPaused ? 'DURAKLATILDI' : 'KAYIT'}</Text>
          </View>
        </SafeAreaView>
      )}

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
            style={[
              styles.recordButton, 
              isRecording && (isPaused ? styles.recordingButtonPaused : styles.recordingButton)
            ]}
            onPress={handleRecordButtonPress}
            onLongPress={handleRecordButtonLongPress}
            delayLongPress={350}
            activeOpacity={0.7}
          >
            <View style={styles.recordButtonInner}>
              {!isRecording ? (
                <Ionicons name="ellipse" size={32} color="red" />
              ) : isPaused ? (
                <Ionicons name="play" size={30} color="#FF9500" style={{ marginLeft: 3 }} />
              ) : (
                <Ionicons name="square" size={24} color="red" />
              )}
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
  flashOuterBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 10,
    borderColor: '#FFFFFF',
    zIndex: 1,
  },
  flashGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 2,
  },
  flashGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 2,
  },
  flashGradientLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 85,
    zIndex: 2,
  },
  flashGradientRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 85,
    zIndex: 2,
  },
  flashCenterAmbient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusBadgeContainer: {
    position: 'absolute',
    top: 15,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  recordingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 8,
  },
  statusDotRecording: {
    backgroundColor: '#FF3B30',
  },
  statusDotPaused: {
    backgroundColor: '#FF9500',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.6,
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
    borderColor: '#FF3B30',
  },
  recordingButtonPaused: {
    borderColor: '#FF9500',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
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

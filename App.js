import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, SafeAreaView, AppState, StatusBar, Platform } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Brightness from 'expo-brightness';

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
    'rgba(255, 255, 255, 0.95)',
    'rgba(255, 255, 255, 0.80)',
    'rgba(255, 255, 255, 0.55)',
    'rgba(255, 255, 255, 0.30)',
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.0)',
  ];

  const reverseGradientStops = [
    'rgba(255, 255, 255, 0.0)',
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.30)',
    'rgba(255, 255, 255, 0.55)',
    'rgba(255, 255, 255, 0.80)',
    'rgba(255, 255, 255, 0.95)',
    'rgba(255, 255, 255, 1.0)',
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* 1. Broad Solid White Bars for Maximum Screen Lumens (TikTok Style) */}
      <View style={styles.flashSolidTop} />
      <View style={styles.flashSolidBottom} />
      <View style={styles.flashSolidLeft} />
      <View style={styles.flashSolidRight} />

      {/* 2. Deep Inward Cloud Fade */}
      <LinearGradient
        colors={gradientStops}
        style={styles.flashGradientTop}
      />
      <LinearGradient
        colors={reverseGradientStops}
        style={styles.flashGradientBottom}
      />
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={gradientStops}
        style={styles.flashGradientLeft}
      />
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={reverseGradientStops}
        style={styles.flashGradientRight}
      />
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
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isMirrored, setIsMirrored] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);
  const [torch, setTorch] = useState('off');
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const originalBrightnessRef = useRef(null);
  const device = useCameraDevice(facing);
  const cameraRef = useRef(null);

  // Timer Effect
  useEffect(() => {
    let interval = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  // Focus Box Auto-Dismiss
  useEffect(() => {
    if (focusPoint) {
      const timeout = setTimeout(() => {
        setFocusPoint(null);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [focusPoint]);

  // Screen Brightness Boost for Front Camera Flash (TikTok Style)
  useEffect(() => {
    const manageBrightness = async () => {
      try {
        if (facing === 'front' && torch === 'on' && isAppActive) {
          if (originalBrightnessRef.current === null) {
            const cur = await Brightness.getBrightnessAsync();
            originalBrightnessRef.current = cur;
          }
          await Brightness.setBrightnessAsync(1.0);
        } else {
          if (originalBrightnessRef.current !== null) {
            await Brightness.setBrightnessAsync(originalBrightnessRef.current);
            originalBrightnessRef.current = null;
          }
        }
      } catch (e) {
        console.warn("Brightness control error:", e);
      }
    };

    manageBrightness();

    return () => {
      if (originalBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(originalBrightnessRef.current).catch(() => {});
      }
    };
  }, [facing, torch, isAppActive]);

  useEffect(() => {
    (async () => {
      if (!hasCameraPermission) await requestCameraPermission();
      if (!hasMicPermission) await requestMicPermission();
      if (!mediaPermission?.granted) await requestMediaPermission();
    })();
  }, [hasCameraPermission, hasMicPermission, mediaPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const active = nextAppState === 'active';
      setIsAppActive(active);

      if (!active) {
        // App went to background - safely stop recording if in progress
        if (cameraRef.current && isRecording) {
          try {
            await cameraRef.current.stopRecording();
          } catch (e) {
            console.error("Stop recording on background error:", e);
          }
          setIsRecording(false);
          setIsPaused(false);
          setDuration(0);
        }
      } else {
        // App returned to foreground - ensure permissions are fresh
        if (!hasCameraPermission) await requestCameraPermission();
        if (!hasMicPermission) await requestMicPermission();
      }
    });

    return () => subscription.remove();
  }, [isRecording, hasCameraPermission, hasMicPermission]);

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

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTapToFocus = async (event) => {
    const { locationX, locationY } = event.nativeEvent;
    setFocusPoint({ x: locationX, y: locationY });

    try {
      if (cameraRef.current) {
        await cameraRef.current.focus({ x: locationX, y: locationY });
      }
    } catch (e) {
      console.warn("Focus error:", e);
    }
  };

  const startRecordingFlow = () => {
    if (!cameraRef.current) return;
    setIsRecording(true);
    setIsPaused(false);
    setDuration(0);
    
    cameraRef.current.startRecording({
      onRecordingFinished: async (video) => {
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
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
        setDuration(0);
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
      setZoom(1);
      
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
      setZoom(1);
    }
  };

  const toggleTorch = () => {
    setTorch(t => (t === 'on' ? 'off' : 'on'));
  };

  const minZoom = device?.minZoom ?? 1;
  const zoomLevels = minZoom < 1 ? [0.5, 1, 2, 3] : [1, 2, 3];

  return (
    <View style={styles.container}>
      <Camera 
        style={[styles.camera, isMirrored && styles.mirroredCamera]} 
        device={device}
        isActive={isAppActive}
        ref={cameraRef}
        video={true}
        audio={true}
        zoom={zoom}
        enableZoomGesture={true}
        torch={facing === 'back' ? torch : 'off'}
      />

      {/* Tap to Focus Tap Area */}
      <TouchableOpacity 
        style={StyleSheet.absoluteFillObject} 
        activeOpacity={1} 
        onPress={handleTapToFocus} 
      />

      {/* Tap to Focus Visual Box */}
      {focusPoint && (
        <View 
          pointerEvents="none" 
          style={[
            styles.focusIndicator, 
            { left: focusPoint.x - 32, top: focusPoint.y - 32 }
          ]}
        >
          <View style={styles.focusCenterDot} />
        </View>
      )}

      {facing === 'front' && torch === 'on' && <FrontScreenFlash />}

      {/* Top Status & Duration Badge (Notch Safe) */}
      {isRecording && (
        <SafeAreaView style={styles.topHeaderContainer} pointerEvents="none">
          <View style={styles.recordingStatusBadge}>
            <View style={[styles.statusDot, isPaused ? styles.statusDotPaused : styles.statusDotRecording]} />
            <Text style={styles.statusText}>
              {isPaused ? `DURAKLATILDI  ${formatDuration(duration)}` : `KAYIT  ${formatDuration(duration)}`}
            </Text>
          </View>
        </SafeAreaView>
      )}

      <SafeAreaView style={styles.uiContainer} pointerEvents="box-none">
        {/* Quick Zoom & Mirror Controls */}
        <View style={styles.zoomContainer} pointerEvents="box-none">
          {zoomLevels.map((lvl) => {
            const isActiveZoom = Math.abs(zoom - lvl) < 0.2;
            return (
              <TouchableOpacity
                key={lvl}
                style={[styles.zoomPill, isActiveZoom && styles.zoomPillActive]}
                onPress={() => setZoom(lvl)}
              >
                <Text style={[styles.zoomText, isActiveZoom && styles.zoomTextActive]}>
                  {lvl}x
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.zoomDivider} />

          {/* Mirror Camera Toggle */}
          <TouchableOpacity
            style={[styles.mirrorPill, isMirrored && styles.mirrorPillActive]}
            onPress={() => setIsMirrored(m => !m)}
          >
            <Ionicons 
              name="swap-horizontal" 
              size={18} 
              color={isMirrored ? '#000' : '#fff'} 
            />
          </TouchableOpacity>
        </View>

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
  mirroredCamera: {
    transform: [{ scaleX: -1 }],
  },
  flashSolidTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  flashSolidBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  flashSolidLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 32,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  flashSolidRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 32,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  flashGradientTop: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 3,
  },
  flashGradientBottom: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    height: 170,
    zIndex: 3,
  },
  flashGradientLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 32,
    width: 95,
    zIndex: 3,
  },
  flashGradientRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 32,
    width: 95,
    zIndex: 3,
  },
  topHeaderContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 20,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  recordingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  focusIndicator: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  focusCenterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD700',
  },
  zoomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 24,
    marginBottom: 16,
    gap: 6,
    zIndex: 15,
  },
  zoomDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginHorizontal: 2,
  },
  zoomPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  zoomPillActive: {
    backgroundColor: '#FFD700',
  },
  zoomText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  zoomTextActive: {
    color: '#000',
  },
  mirrorPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  mirrorPillActive: {
    backgroundColor: '#FFD700',
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

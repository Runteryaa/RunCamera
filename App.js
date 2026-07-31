import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import * as MediaLibrary from 'expo-media-library';
import { SwitchCamera, Circle, Square } from 'lucide-react-native';

export default function App() {
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  
  const [facing, setFacing] = useState('back');
  const [isRecording, setIsRecording] = useState(false);
  
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
      await cameraRef.current.pauseRecording();
      setFacing(current => (current === 'back' ? 'front' : 'back'));
      
      // Give the new camera device a moment to initialize before resuming
      setTimeout(async () => {
        if (cameraRef.current) {
          await cameraRef.current.resumeRecording();
        }
      }, 800);
    } else {
      setFacing(current => (current === 'back' ? 'front' : 'back'));
    }
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
      />
      <SafeAreaView style={styles.uiContainer} pointerEvents="box-none">
        <View style={styles.bottomControls}>
          <View style={styles.controlSpacer} />
          
          <TouchableOpacity 
            style={styles.recordButtonWrapper} 
            onPress={toggleRecording}
            activeOpacity={0.7}
          >
            <View style={[styles.recordButton, isRecording && styles.recordButtonActive]}>
              {isRecording ? (
                <Square color="#fff" size={24} fill="#fff" />
              ) : (
                <Circle color="#FF3B30" size={56} fill="#FF3B30" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlSpacer} onPress={flipCamera}>
            <View style={styles.flipButton}>
              <SwitchCamera color="#fff" size={32} />
            </View>
          </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  controlSpacer: {
    flex: 1,
    alignItems: 'center',
  },
  recordButtonWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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

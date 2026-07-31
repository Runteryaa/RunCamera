import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system';
import { CameraReverse, Circle, Square } from 'lucide-react-native';

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  
  const [facing, setFacing] = useState('back');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const cameraRef = useRef(null);
  const segmentsRef = useRef([]);
  const resumeRecordingRef = useRef(false);
  const isFinalStopRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!micPermission?.granted) await requestMicPermission();
      if (!mediaPermission?.granted) await requestMediaPermission();
    })();
  }, []);

  // When camera facing changes and we need to resume recording
  useEffect(() => {
    if (resumeRecordingRef.current) {
      resumeRecordingRef.current = false;
      // Short delay to ensure camera is ready after flip
      const timer = setTimeout(() => {
        startRecordingFlow();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [facing]);

  if (!cameraPermission || !micPermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need camera and microphone permissions to record videos.</Text>
        <TouchableOpacity style={styles.buttonPrimary} onPress={() => { requestCameraPermission(); requestMicPermission(); }}>
          <Text style={styles.buttonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startRecordingFlow = async () => {
    if (!cameraRef.current) return;
    try {
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 600, // max 10 mins
      });
      
      if (video && video.uri) {
        segmentsRef.current.push(video.uri);
      }

      if (isFinalStopRef.current) {
        // This was the final stop, process the video
        isFinalStopRef.current = false;
        setIsRecording(false);
        processAndSaveVideo();
      }
    } catch (error) {
      console.error("Recording error:", error);
      setIsRecording(false);
      isFinalStopRef.current = false;
      resumeRecordingRef.current = false;
    }
  };

  const processAndSaveVideo = async () => {
    const segments = segmentsRef.current;
    if (segments.length === 0) return;
    
    if (segments.length === 1) {
      // Only one segment, just save it directly
      await saveVideoToGallery(segments[0]);
      segmentsRef.current = [];
      return;
    }

    setIsProcessing(true);
    try {
      // Create a text file listing all video segments for FFmpeg concat
      const listContent = segments.map(uri => `file '${uri.replace('file://', '')}'`).join('\n');
      const listPath = FileSystem.cacheDirectory + 'concat_list.txt';
      await FileSystem.writeAsStringAsync(listPath, listContent);

      const outputPath = FileSystem.cacheDirectory + `final_video_${Date.now()}.mp4`;
      
      // FFmpeg command to concatenate without re-encoding
      const command = `-f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
      
      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        await saveVideoToGallery(outputPath);
      } else {
        const logs = await session.getLogs();
        console.error("FFmpeg Error:", logs);
        Alert.alert("Error", "Failed to merge video segments.");
      }
    } catch (error) {
      console.error("Processing error:", error);
      Alert.alert("Error", "An unexpected error occurred while processing.");
    } finally {
      setIsProcessing(false);
      segmentsRef.current = [];
    }
  };

  const saveVideoToGallery = async (uri) => {
    try {
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync("RunCamera", asset, false);
      Alert.alert("Success", "Video saved to gallery!");
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save video to gallery.");
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      // Final stop
      isFinalStopRef.current = true;
      cameraRef.current.stopRecording();
    } else {
      // Start fresh
      segmentsRef.current = [];
      isFinalStopRef.current = false;
      resumeRecordingRef.current = false;
      startRecordingFlow();
    }
  };

  const flipCamera = () => {
    if (isRecording) {
      // Flip while recording: stop current, flip, then auto-resume
      resumeRecordingRef.current = true;
      cameraRef.current.stopRecording();
      setFacing(current => (current === 'back' ? 'front' : 'back'));
    } else {
      // Just flip
      setFacing(current => (current === 'back' ? 'front' : 'back'));
    }
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing={facing} 
        ref={cameraRef}
        mode="video"
      >
        <SafeAreaView style={styles.uiContainer}>
          {isProcessing ? (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#FF3B30" />
              <Text style={styles.processingText}>Processing Video...</Text>
            </View>
          ) : (
            <View style={styles.bottomControls}>
              {/* Spacer */}
              <View style={styles.controlSpacer} />
              
              {/* Record Button */}
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

              {/* Flip Button */}
              <TouchableOpacity style={styles.controlSpacer} onPress={flipCamera}>
                <View style={styles.flipButton}>
                  <CameraReverse color="#fff" size={32} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </CameraView>
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
    flex: 1,
  },
  uiContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    paddingBottom: 40,
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
    backdropFilter: 'blur(10px)',
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
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

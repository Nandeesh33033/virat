
import React, { useState, useEffect, useRef } from 'react';
import { translations } from '../constants';
import { RegisteredUser } from '../types';

// Declare faceapi as global
declare const faceapi: any;

interface PatientLoginScreenProps {
  onSuccess: (matchedUserPhone: string) => void;
  onBack: () => void;
  registeredUsers: RegisteredUser[]; 
}

const PatientLoginScreen: React.FC<PatientLoginScreenProps> = ({ onSuccess, onBack, registeredUsers }) => {
  const [status, setStatus] = useState<'LOADING_MODELS' | 'READY' | 'ANALYZING' | 'VERIFIED' | 'FAILED' | 'NO_MATCH'>('LOADING_MODELS');
  const [matchName, setMatchName] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadModels = async () => {
        try {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            await Promise.all([
              faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
              faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
              faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            setStatus('READY');
            startCamera();
        } catch(e) {
            console.error(e);
            setStatus('FAILED');
        }
    };
    loadModels();

    return () => {
        stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setStatus('FAILED');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || registeredUsers.length === 0) return;
    
    setStatus('ANALYZING');
    
    try {
        // 1. Prepare Matcher with Registered Data
        const labeledDescriptors = registeredUsers
            .filter(u => u.faceDescriptor && u.faceDescriptor.length > 0)
            .map(user => {
                return new faceapi.LabeledFaceDescriptors(
                    user.patientPhone, // Use phone as the label
                    [new Float32Array(user.faceDescriptor)] // Convert back to Float32Array
                );
            });

        if (labeledDescriptors.length === 0) {
            alert("No registered face data found. Please register first.");
            setStatus('READY');
            return;
        }

        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6); // 0.6 is distance threshold

        // 2. Capture Frame & Detect
        // We can pass the video element directly to detectSingleFace
        const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
            
        if (detection) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            
            if (bestMatch.label !== 'unknown') {
                // MATCH FOUND!
                setStatus('VERIFIED');
                setMatchName(bestMatch.label);
                
                setTimeout(() => {
                    onSuccess(bestMatch.label); // Login with matched phone
                }, 1500);
            } else {
                setStatus('NO_MATCH');
            }
        } else {
            // No face detected in the frame
            setStatus('NO_MATCH'); 
        }
    } catch (e) {
        console.error(e);
        setStatus('FAILED');
    }
  };

  const retry = () => {
      setStatus('READY');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg relative text-center">
        <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 z-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">{translations.patientLoginTitle}</h2>

        <div className="relative w-full aspect-video mx-auto rounded-xl overflow-hidden border-4 border-blue-500 shadow-2xl bg-black">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
            
            {status === 'ANALYZING' && (
                 <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <p className="text-white font-bold text-lg animate-pulse">Analyzing...</p>
                 </div>
            )}
        </div>

        <div className="mt-8 min-h-[60px]">
            {status === 'LOADING_MODELS' && <p className="text-orange-500 font-bold">Loading AI Models...</p>}
            
            {status === 'READY' && (
                <button 
                    onClick={captureAndVerify}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition transform hover:scale-105"
                >
                    Capture & Verify
                </button>
            )}

            {status === 'ANALYZING' && (
                <p className="text-gray-500">Processing image...</p>
            )}
            
            {status === 'VERIFIED' && (
                <div className="flex flex-col items-center justify-center text-green-600 animate-bounce">
                    <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xl font-bold">{translations.faceVerified}</p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">ID: {matchName}</p>
                </div>
            )}

            {status === 'NO_MATCH' && (
                <div className="space-y-3">
                    <p className="text-red-500 font-bold text-lg">Face Not Recognized</p>
                    <p className="text-sm text-gray-500">Ensure good lighting and look at the camera.</p>
                    <button onClick={retry} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium">
                        Try Again
                    </button>
                </div>
            )}
            
            {status === 'FAILED' && (
                <div>
                     <p className="text-red-500 font-semibold mb-2">Camera Error or Models Failed.</p>
                     <button onClick={retry} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Retry</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PatientLoginScreen;

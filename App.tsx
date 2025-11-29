
import React, { useState, useEffect, useCallback } from 'react';
import { Medicine, Log, View, RegisteredUser } from './types';
import { initialMedicines, initialLogs, translations } from './constants';
import CaretakerView from './components/CaretakerView';
import PatientView from './components/PatientView';
import ReminderModal from './components/ReminderModal';
import Header from './components/Header';
import LandingScreen from './components/LandingScreen';
import RegisterScreen from './components/RegisterScreen';
import LoginChoiceScreen from './components/LoginChoiceScreen';
import CaretakerLoginScreen from './components/CaretakerLoginScreen';
import PatientLoginScreen from './components/PatientLoginScreen';

// --- TWILIO CONFIGURATION ---
// IMPORTANT: Keys are now loaded from .env file to prevent GitHub blocking pushes
const TWILIO_ACCOUNT_SID = (import.meta as any).env?.VITE_TWILIO_ACCOUNT_SID || ''; 
const TWILIO_AUTH_TOKEN = (import.meta as any).env?.VITE_TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = (import.meta as any).env?.VITE_TWILIO_FROM_NUMBER || ''; 

const App: React.FC = () => {
  // --- STATE WITH PERSISTENCE (V4 Keys to Wipe Old Data) ---
  
  // 1. ALL USERS (Database Simulation)
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>(() => {
    const saved = localStorage.getItem('users_v4');
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
  });

  // 2. ACTIVE SESSION
  const [currentUser, setCurrentUser] = useState<RegisteredUser | null>(() => {
    const saved = localStorage.getItem('currentUser_v4');
    return saved ? JSON.parse(saved) : null;
  });

  // 3. ALL MEDICINES
  const [allMedicines, setAllMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('medicines_v4');
    return saved ? JSON.parse(saved) : initialMedicines;
  });

  // 4. ALL LOGS
  const [allLogs, setAllLogs] = useState<Log[]>(() => {
     const saved = localStorage.getItem('logs_v4');
     if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
     }
     return initialLogs
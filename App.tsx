
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

// --- CONFIGURATION ---
// SET THIS TO 'false' TO SEND REAL MESSAGES
const SIMULATION_MODE = false; 

// --- GREEN-API CREDENTIALS ---
const GREEN_API_INSTANCE_ID = '7105398017'; 
const GREEN_API_API_TOKEN = '22f985faa53449d4b4b65003ccda72e84815977ea3e745bc82';

const App: React.FC = () => {
  // --- STATE WITH PERSISTENCE (V5 Keys to Wipe Old Data) ---
  
  // 1. ALL USERS (Database Simulation)
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>(() => {
    const saved = localStorage.getItem('users_v5');
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
  });

  // 2. ACTIVE SESSION
  const [currentUser, setCurrentUser] = useState<RegisteredUser | null>(() => {
    const saved = localStorage.getItem('currentUser_v5');
    return saved ? JSON.parse(saved) : null;
  });

  // 3. ALL MEDICINES
  const [allMedicines, setAllMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('medicines_v5');
    return saved ? JSON.parse(saved) : initialMedicines;
  });

  // 4. ALL LOGS
  const [allLogs, setAllLogs] = useState<Log[]>(() => {
     const saved = localStorage.getItem('logs_v5');
     if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
     }
     return initialLogs;
  });

  const [currentView, setCurrentView] = useState<View>(View.Landing);
  const [activeReminder, setActiveReminder] = useState<Medicine | null>(null);
  
  const isLoggedIn = !!currentUser;
  
  // Persist SMS timestamps to avoid duplicate sending on refresh
  const [lastSmsTime, setLastSmsTime] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lastSmsTime_v5');
    return saved ? JSON.parse(saved) : {};
  });

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('users_v5', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    if (currentUser) {
        localStorage.setItem('currentUser_v5', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('currentUser_v5');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('medicines_v5', JSON.stringify(allMedicines));
  }, [allMedicines]);

  useEffect(() => {
    localStorage.setItem('logs_v5', JSON.stringify(allLogs));
  }, [allLogs]);

  useEffect(() => {
    localStorage.setItem('lastSmsTime_v5', JSON.stringify(lastSmsTime));
  }, [lastSmsTime]);

  // --- DEEP LINK HANDLING ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const phoneParam = params.get('phone');

    // 1. Direct Login (Magic Link from WhatsApp)
    if (viewParam === 'patient_direct' && phoneParam) {
        // Read directly from storage to ensure we catch it even on fresh load
        const savedUsersStr = localStorage.getItem('users_v5');
        const users: RegisteredUser[] = savedUsersStr ? JSON.parse(savedUsersStr) : [];
        
        const matchedUser = users.find(u => u.patientPhone === phoneParam);
        
        if (matchedUser) {
            setCurrentUser(matchedUser);
            setCurrentView(View.Patient);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            console.warn("Direct login failed: User not found for phone", phoneParam);
        }
    } 
    // 2. Fallback to Face Auth Login page
    else if (viewParam === 'patient_login') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setCurrentView(View.LoginPatient);
    }
  }, []);

  // --- HELPER FUNCTIONS ---
  const formatTime12Hour = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  // --- DERIVED STATE ---
  const userMedicines = currentUser 
    ? allMedicines.filter(m => m.caretakerId === currentUser.caretakerPhone)
    : [];

  const userLogs = currentUser
    ? allLogs.filter(l => l.caretakerId === currentUser.caretakerPhone)
    : [];

  const addMedicine = (med: Omit<Medicine, 'id' | 'caretakerId'>) => {
    if (!currentUser) return;
    const newMed: Medicine = { 
        ...med, 
        id: Date.now().toString(),
        caretakerId: currentUser.caretakerPhone 
    };
    setAllMedicines(prev => [...prev, newMed].sort((a,b) => a.schedule.time.localeCompare(b.schedule.time)));
  };

  const addLog = (medicineId: string, status: 'taken' | 'missed', ownerId?: string) => {
    const cid = ownerId || currentUser?.caretakerPhone;
    if (!cid) return;

    const newLog: Log = {
      id: Date.now().toString(),
      medicineId,
      caretakerId: cid,
      timestamp: new Date(),
      status,
    };
    setAllLogs(prev => [...prev, newLog]);
    setActiveReminder(null);
  };
  
  const sendSmsViaApi = async (phone: string, message: string): Promise<{ success: boolean; error?: string }> => {
    if (!phone) return { success: false, error: 'Missing Phone' };

    // --- SIMULATION MODE ---
    if (SIMULATION_MODE) {
        console.log(`[SIMULATION] WhatsApp to ${phone}: ${message}`);
        setTimeout(() => {
            alert(`✅ SIMULATION SUCCESS\n\nTo: ${phone}\nMsg: "${message}"\n\n(Real sending is disabled in code)`);
        }, 500);
        return { success: true };
    }
    
    // Ensure clean phone number
    let formattedPhone = phone.replace(/[^\d]/g, '');
    
    // Green API requires country code
    if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone; 
    }

    // Green API Chat ID format: <number>@c.us
    const chatId = `${formattedPhone}@c.us`;

    // Verify keys are present
    if (GREEN_API_INSTANCE_ID.includes('YOUR') || GREEN_API_API_TOKEN.includes('YOUR')) {
        alert("Green API Keys are missing in App.tsx! Switching to Simulation.");
        return { success: false, error: "Missing API Keys" };
    }

    const apiUrl = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_API_TOKEN}`;
    
    try {
        console.log(`Sending WhatsApp via Green-API to ${formattedPhone}...`);
        
        const payload = {
            chatId: chatId,
            message: message
        };

        // Try direct fetch first
        let response = await fetch(apiUrl, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload)
        });
        
        // If direct fails due to CORS (opaque response), try proxy
        if (!response.ok && response.status === 0) {
             console.log("Direct fetch failed (CORS), trying Proxy...");
             const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
             response = await fetch(proxyUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(payload)
            });
        }
        
        if (response.ok) {
            console.log("Green-API Request Sent");
            return { success: true };
        } else {
             const errorData = await response.text();
             console.error("Green-API Error:", errorData);
             return { success: false, error: `HTTP ${response.status}: ${errorData}` };
        }

    } catch (e: any) {
        console.error("WhatsApp Error:", e);
        return { success: false, error: e.message || "Network Error" };
    }
  };

  const handleManualTestSMS = async () => {
      if (!currentUser) return;
      const result = await sendSmsViaApi(currentUser.patientPhone, "🔔 This is a Test Message from MediRemind!");
      if (result.success) {
          if (!SIMULATION_MODE) alert("Test Message Sent!");
      } else {
          alert("Test Failed: " + result.error);
      }
  };

  const handleReminderTimeout = async () => {
    if (activeReminder) {
      const medicineOwner = allUsers.find(u => u.caretakerPhone === activeReminder.caretakerId);
      const cPhone = medicineOwner?.caretakerPhone;

      if (cPhone) {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        // Caretaker Alert Format
        const messageContent = `⚠️ *MISSED DOSE ALERT*\n\nThe patient has NOT taken their medicine.\n\n💊 Medicine: *${activeReminder.name}* (${activeReminder.dosage}mg)\n🔢 Quantity: *${activeReminder.pills} pill(s)*\n🍽️ Instruction: *${activeReminder.beforeFood ? 'BEFORE' : 'AFTER'} food*\n⏰ Scheduled: *${formatTime12Hour(activeReminder.schedule.time)}*\n\nPlease check on the patient immediately.\n[Log: ${timestamp}]`;
        
        const result = await sendSmsViaApi(cPhone, messageContent);
        if (!result.success) {
            console.error("Missed Dose WhatsApp Failed:", result.error);
        }
      }
      addLog(activeReminder.id, 'missed', activeReminder.caretakerId);
    }
  };

  // --- AUTHENTICATION HANDLERS ---

  const handleRegister = (cPhone: string, pPhone: string, password: string, faceImage: string, faceDescriptor: number[]) => {
    if (allUsers.some(u => u.caretakerPhone === cPhone)) {
        alert("An account with this Caretaker Phone Number already exists.");
        return;
    }

    const newUser: RegisteredUser = {
      caretakerPhone: cPhone,
      patientPhone: pPhone,
      password: password,
      faceImage: faceImage,
      faceDescriptor: faceDescriptor 
    };

    setAllUsers(prev => [...prev, newUser]);
    alert("Registration Successful! Please login.");
    setCurrentView(View.Landing);
  };

  const handleCaretakerLogin = (phone: string, password: string) => {
    const user = allUsers.find(u => u.caretakerPhone === phone);
    if (!user) {
        alert("No account found with this Caretaker Phone Number.");
        return;
    }
    if (password === user.password) {
        setCurrentUser(user);
        setCurrentView(View.Caretaker);
    } else {
        alert(translations.incorrectPasswordError);
    }
  };

  const handlePatientLogin = (matchedUserPhone: string) => {
     const user = allUsers.find(u => u.patientPhone === matchedUserPhone);
     if (!user) {
        alert("Authentication Error: User not found.");
        return;
    }
    setCurrentUser(user);
    setCurrentView(View.Patient);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(View.Landing);
  };

  const sendReminderSMS = async (medicine: Medicine, manualTrigger: boolean = false) => {
    const owner = allUsers.find(u => u.caretakerPhone === medicine.caretakerId);
    const targetPhone = owner?.patientPhone;

    if (!targetPhone) {
      if (manualTrigger) alert("Error: No patient phone number found.");
      return;
    }
    
    const now = Date.now();
    if (!manualTrigger && lastSmsTime[medicine.id] && now - lastSmsTime[medicine.id] < 120000) {
      return;
    }
    
    setLastSmsTime(prev => ({ ...prev, [medicine.id]: now }));
    const foodInstruction = medicine.beforeFood ? 'BEFORE' : 'AFTER';
    
    // Direct Login Link (Magic Link)
    // We add the phone number so we know WHO to log in
    const appLink = `${window.location.origin}?view=patient_direct&phone=${targetPhone}`;

    // Patient Reminder Format
    const messageContent = `🔔 *Medicine Reminder*\n\n💊 *${medicine.name}* (${medicine.dosage}mg)\n🔢 Take: *${medicine.pills} pill(s)*\n🍽️ Instruction: *${foodInstruction} food*\n⏰ Time: *${formatTime12Hour(medicine.schedule.time)}*\n\nPlease take it now!\n\n🔗 Tap to Open Dashboard: ${appLink}`;
    
    const result = await sendSmsViaApi(targetPhone, messageContent);
    
    if (manualTrigger) {
        if (result.success) {
            // Success alert handled in simulation mode or silent for auto
            if (!SIMULATION_MODE) console.log("Sent successfully");
        } else {
            alert("WhatsApp Failed: " + result.error);
        }
    } else if (!result.success) {
        console.warn("Automated WhatsApp failed:", result.error);
    }
  };

  const checkReminders = useCallback(() => {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTimeStr = now.toTimeString().substring(0, 5); 
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const medsToCheck = allMedicines;

    for (const med of medsToCheck) {
      if (!med.schedule.day.includes(currentDay)) continue;

      const [schedH, schedM] = med.schedule.time.split(':').map(Number);
      const schedMinutes = schedH * 60 + schedM;
      const diff = currentMinutes - schedMinutes;

      // Smart Reminder: Show if opened within 30 mins
      if (diff >= 0 && diff <= 30) {
        const takenToday = allLogs.some(log => 
          log.medicineId === med.id && 
          log.timestamp.toDateString() === now.toDateString() &&
          log.status === 'taken'
        );
        
        const missedToday = allLogs.some(log =>
            log.medicineId === med.id &&
            log.timestamp.toDateString() === now.toDateString() &&
            log.status === 'missed'
        );

        if (!takenToday && !missedToday) {
           if (!activeReminder || med.schedule.time === currentTimeStr) {
               setActiveReminder(med);
           }
           
           if (med.schedule.time === currentTimeStr) {
               sendReminderSMS(med, false); 
           }
        }
      }
    }
  }, [allMedicines, allLogs, activeReminder, lastSmsTime, allUsers]); 

  useEffect(() => {
    if (allMedicines.length > 0) {
        const interval = setInterval(checkReminders, 1000);
        return () => clearInterval(interval);
    }
  }, [checkReminders, allMedicines]);


  const renderActiveReminder = () => {
    if (activeReminder) {
        return (
            <ReminderModal 
              medicine={activeReminder} 
              onTaken={() => addLog(activeReminder.id, 'taken', activeReminder.caretakerId)}
              onTimeout={handleReminderTimeout}
            />
        );
    }
    return null;
  };

  if (!isLoggedIn) {
      return (
        <>
            {renderActiveReminder()}
            {(() => {
                switch (currentView) {
                    case View.Landing:
                        return <LandingScreen 
                            onRegisterClick={() => setCurrentView(View.Register)}
                            onLoginClick={() => setCurrentView(View.LoginChoice)}
                        />;
                    case View.Register:
                        return <RegisterScreen 
                            onRegister={handleRegister} 
                            onBack={() => setCurrentView(View.Landing)}
                        />;
                    case View.LoginChoice:
                        return <LoginChoiceScreen
                            onCaretakerSelect={() => setCurrentView(View.LoginCaretaker)}
                            onPatientSelect={() => setCurrentView(View.LoginPatient)}
                            onBack={() => setCurrentView(View.Landing)}
                        />;
                    case View.LoginCaretaker:
                        return <CaretakerLoginScreen 
                            onLogin={handleCaretakerLogin}
                            onBack={() => setCurrentView(View.LoginChoice)}
                        />;
                    case View.LoginPatient:
                        return <PatientLoginScreen 
                            onSuccess={handlePatientLogin}
                            onBack={() => setCurrentView(View.LoginChoice)}
                            registeredUsers={allUsers}
                        />;
                    default:
                        return <LandingScreen onRegisterClick={() => setCurrentView(View.Register)} onLoginClick={() => setCurrentView(View.LoginChoice)} />;
                }
            })()}
        </>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onLogout={handleLogout} />
      <main className="flex-grow p-4">
        {currentView === View.Caretaker ? (
          <CaretakerView 
            medicines={userMedicines} 
            addMedicine={addMedicine} 
            logs={userLogs}
            onTestSMS={handleManualTestSMS}
          />
        ) : (
          <PatientView medicines={userMedicines} logs={userLogs} />
        )}
      </main>
      {renderActiveReminder()}
    </div>
  );
};

export default App;


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
  // --- STATE WITH PERSISTENCE (V6 Keys to Wipe Old Data) ---
  
  // 1. ALL USERS (Database Simulation - Shared across tabs via localStorage)
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>(() => {
    const saved = localStorage.getItem('users_v6');
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
  });

  // 2. ACTIVE SESSION (Session Storage - Unique per tab)
  const [currentUser, setCurrentUser] = useState<RegisteredUser | null>(() => {
    const saved = sessionStorage.getItem('currentUser_v6');
    return saved ? JSON.parse(saved) : null;
  });

  // 2.1 CURRENT VIEW (Session Storage - Unique per tab)
  const [currentView, setCurrentView] = useState<View>(() => {
    const saved = sessionStorage.getItem('currentView_v6');
    return saved ? (saved as View) : View.Landing;
  });

  // 3. ALL MEDICINES (Shared)
  const [allMedicines, setAllMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('medicines_v6');
    return saved ? JSON.parse(saved) : initialMedicines;
  });

  // 4. ALL LOGS (Shared)
  const [allLogs, setAllLogs] = useState<Log[]>(() => {
     const saved = localStorage.getItem('logs_v6');
     if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
     }
     return initialLogs;
  });

  const [activeReminder, setActiveReminder] = useState<Medicine | null>(null);
  
  const isLoggedIn = !!currentUser;
  
  // Persist SMS timestamps to avoid duplicate sending on refresh (Shared)
  const [lastSmsTime, setLastSmsTime] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lastSmsTime_v6');
    return saved ? JSON.parse(saved) : {};
  });

  // --- PERSISTENCE EFFECTS ---

  // Sync Shared Data to LocalStorage
  useEffect(() => {
    localStorage.setItem('users_v6', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem('medicines_v6', JSON.stringify(allMedicines));
  }, [allMedicines]);

  useEffect(() => {
    localStorage.setItem('logs_v6', JSON.stringify(allLogs));
  }, [allLogs]);

  useEffect(() => {
    localStorage.setItem('lastSmsTime_v6', JSON.stringify(lastSmsTime));
  }, [lastSmsTime]);

  // Sync Session Data to SessionStorage
  useEffect(() => {
    if (currentUser) {
        sessionStorage.setItem('currentUser_v6', JSON.stringify(currentUser));
    } else {
        sessionStorage.removeItem('currentUser_v6');
    }
  }, [currentUser]);

  useEffect(() => {
    sessionStorage.setItem('currentView_v6', currentView);
  }, [currentView]);

  // --- CROSS-TAB SYNCHRONIZATION ---
  // This enables "Two Web" accessibility: One tab Caretaker, One tab Patient
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // If another tab updates data, sync it here
      if (e.key === 'users_v6' && e.newValue) {
        setAllUsers(JSON.parse(e.newValue));
      }
      if (e.key === 'medicines_v6' && e.newValue) {
        setAllMedicines(JSON.parse(e.newValue));
      }
      if (e.key === 'logs_v6' && e.newValue) {
        const parsed = JSON.parse(e.newValue);
        // Restore Date objects
        const fixedLogs = parsed.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
        setAllLogs(fixedLogs);
      }
      if (e.key === 'lastSmsTime_v6' && e.newValue) {
        setLastSmsTime(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  // --- DEEP LINK HANDLING ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const phoneParam = params.get('phone');

    // 1. Direct Login (Magic Link from WhatsApp)
    if (viewParam === 'patient_direct' && phoneParam) {
        // Read directly from storage to ensure we catch it even on fresh load
        const savedUsersStr = localStorage.getItem('users_v6');
        const users: RegisteredUser[] = savedUsersStr ? JSON.parse(savedUsersStr) : [];
        
        const matchedUser = users.find(u => u.patientPhone === phoneParam);
        
        if (matchedUser) {
            setCurrentUser(matchedUser);
            setCurrentView(View.Patient);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            console.warn("Direct login failed: User not found for phone", phoneParam);
            // ALERT THE USER FOR CROSS-DEVICE SCENARIOS
            alert(`Patient Account Not Found!\n\nWe could not find a patient with phone: ${phoneParam} on this device.`);
            setCurrentView(View.Landing);
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
  
  const sendSmsViaApi = async (phone: string, message: string, imageUrl?: string): Promise<{ success: boolean; error?: string }> => {
    if (!phone) return { success: false, error: 'Missing Phone' };

    // --- SIMULATION MODE ---
    if (SIMULATION_MODE) {
        console.log(`[SIMULATION] WhatsApp to ${phone}: ${message} ${imageUrl ? '[+Image]' : ''}`);
        setTimeout(() => {
            alert(`✅ SIMULATION SUCCESS\n\nTo: ${phone}\nMsg: "${message}"\n${imageUrl ? '[Image Included]' : ''}\n\n(Real sending is disabled in code)`);
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

    // Determine Endpoint: Send File if we have a public URL, otherwise Send Text
    const isPublicUrl = imageUrl && imageUrl.startsWith('http');
    const methodEndpoint = isPublicUrl ? 'sendFileByUrl' : 'sendMessage';
    const apiUrl = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/${methodEndpoint}/${GREEN_API_API_TOKEN}`;
    
    try {
        console.log(`Sending WhatsApp via Green-API to ${formattedPhone} using ${methodEndpoint}...`);
        
        let payload: any;
        if (isPublicUrl) {
             payload = {
                chatId: chatId,
                urlFile: imageUrl,
                fileName: 'medicine.jpg',
                caption: message
             };
        } else {
             // Fallback: If image is base64 (local) or missing, send just text
             if (imageUrl) console.warn("Image is not a public URL (likely local base64). Sending text only.");
             payload = {
                chatId: chatId,
                message: message
             };
        }

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

  const handleReminderTimeout = async () => {
    if (activeReminder) {
      const medicineOwner = allUsers.find(u => u.caretakerPhone === activeReminder.caretakerId);
      const cPhone = medicineOwner?.caretakerPhone;

      if (cPhone) {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        // Caretaker Alert Format
        const messageContent = `⚠️ *MISSED DOSE ALERT*\n\nThe patient has NOT taken their medicine.\n\n💊 Medicine: *${activeReminder.name}* (${activeReminder.dosage}mg)\n🔢 Quantity: *${activeReminder.pills} pill(s)*\n🍽️ Instruction: *${activeReminder.beforeFood ? 'BEFORE' : 'AFTER'} food*\n⏰ Scheduled: *${formatTime12Hour(activeReminder.schedule.time)}*\n\nPlease check on the patient immediately.\n[Log: ${timestamp}]`;
        
        const result = await sendSmsViaApi(cPhone, messageContent, activeReminder.image);
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

  // New Utility to reset app data for testing
  const handleResetData = () => {
    if(window.confirm("Are you sure? This will delete all users, medicines, and logs.")) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
  };

  // --- SYNC DATA UTILS ---
  const handleExportData = () => {
      const data = {
          users: allUsers,
          medicines: allMedicines,
          logs: allLogs
      };
      const json = JSON.stringify(data);
      navigator.clipboard.writeText(json).then(() => {
          alert("Data Copied to Clipboard!");
      });
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
    const appLink = `${window.location.origin}?view=patient_direct&phone=${targetPhone}`;

    // Patient Reminder Format
    const messageContent = `🔔 *Medicine Reminder*\n\n💊 *${medicine.name}* (${medicine.dosage}mg)\n🔢 Take: *${medicine.pills} pill(s)*\n🍽️ Instruction: *${foodInstruction} food*\n⏰ Time: *${formatTime12Hour(medicine.schedule.time)}*\n\nPlease take it now!\n\n🔗 Tap to Open Dashboard: ${appLink}`;
    
    const result = await sendSmsViaApi(targetPhone, messageContent, medicine.image);
    
    if (manualTrigger) {
        if (result.success) {
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
           // If we are logged in as the specific patient for this med, show modal
           if (currentUser && currentUser.caretakerPhone === med.caretakerId && currentView === View.Patient) {
               if (!activeReminder || med.schedule.time === currentTimeStr) {
                   setActiveReminder(med);
               }
           }
           
           // Any open tab can trigger the SMS logic to ensure reliable delivery
           if (med.schedule.time === currentTimeStr) {
               sendReminderSMS(med, false); 
           }
        }
      }
    }
  }, [allMedicines, allLogs, activeReminder, lastSmsTime, allUsers, currentUser, currentView]); 

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
        <div className="flex flex-col min-h-screen bg-gray-50">
            {renderActiveReminder()}
            {(() => {
                switch (currentView) {
                    case View.Landing:
                        return <LandingScreen 
                            onRegisterClick={() => setCurrentView(View.Register)}
                            onCaretakerLoginClick={() => setCurrentView(View.LoginCaretaker)}
                            onPatientLoginClick={() => setCurrentView(View.LoginPatient)}
                        />;
                    case View.Register:
                        return <RegisterScreen 
                            onRegister={handleRegister} 
                            onBack={() => setCurrentView(View.Landing)}
                        />;
                    case View.LoginChoice:
                        // Deprecated in new flow but keeping for backup
                        return <LoginChoiceScreen
                            onCaretakerSelect={() => setCurrentView(View.LoginCaretaker)}
                            onPatientSelect={() => setCurrentView(View.LoginPatient)}
                            onBack={() => setCurrentView(View.Landing)}
                        />;
                    case View.LoginCaretaker:
                        return <CaretakerLoginScreen 
                            onLogin={handleCaretakerLogin}
                            onBack={() => setCurrentView(View.Landing)}
                        />;
                    case View.LoginPatient:
                        return <PatientLoginScreen 
                            onSuccess={handlePatientLogin}
                            onBack={() => setCurrentView(View.Landing)}
                            registeredUsers={allUsers}
                        />;
                    default:
                        return <LandingScreen 
                                onRegisterClick={() => setCurrentView(View.Register)} 
                                onCaretakerLoginClick={() => setCurrentView(View.LoginCaretaker)}
                                onPatientLoginClick={() => setCurrentView(View.LoginPatient)}
                               />;
                }
            })()}
        </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onLogout={handleLogout} currentUser={currentUser} currentView={currentView} />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        {currentView === View.Caretaker ? (
          <CaretakerView 
            medicines={userMedicines} 
            addMedicine={addMedicine} 
            logs={userLogs}
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

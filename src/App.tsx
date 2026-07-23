import React, { useState, useEffect, useRef } from 'react';
import { GroupCategory, StudentProgressRecord, TopicProgressState, UserProfile } from './types';
import { STUDENTS_LIST, TOPICS_DATA, sanitizeDocId, getDateConstraints } from './data/studentsAndTopics';
import { db, auth } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, query, orderBy } from 'firebase/firestore';
import { Header } from './components/Header';
import { GlobalProgressOverview } from './components/GlobalProgressOverview';
import { ProgressSidebar } from './components/ProgressSidebar';
import { TopicsChecklist } from './components/TopicsChecklist';
import { CodeReviewModal } from './components/CodeReviewModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { GmailModal } from './components/GmailModal';
import { DoubtClearingModal } from './components/DoubtClearingModal';
import { RevisionReminderBox } from './components/RevisionReminderBox';
import { NextTopicsBox } from './components/NextTopicsBox';
import { StudyResourcesBox } from './components/StudyResourcesBox';
import { RegisterModal } from './components/RegisterModal';
import { AdminUserManagementModal } from './components/AdminUserManagementModal';

const getInitialStudent = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramStudent = urlParams.get('student') || urlParams.get('name');
    if (paramStudent && paramStudent.trim()) {
      return paramStudent.trim();
    }
    const savedLastStudent = localStorage.getItem('ca_last_active_student');
    if (savedLastStudent && savedLastStudent.trim()) {
      return savedLastStudent.trim();
    }
  } catch (e) {
    // fallback
  }
  return '';
};

export default function App() {
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('ca_current_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [currentStudent, setCurrentStudent] = useState<string>(() => {
    if (currentUserProfile && currentUserProfile.fullName) {
      return currentUserProfile.fullName;
    }
    return getInitialStudent();
  });

  const [registeredStudents, setRegisteredStudents] = useState<string[]>([]);

  const [currentGroupFilter, setCurrentGroupFilter] = useState<GroupCategory>(() => {
    if (currentUserProfile && currentUserProfile.groupPreparingFor) {
      return currentUserProfile.groupPreparingFor;
    }
    return 'Both';
  });

  const [studentStoreCache, setStudentStoreCache] = useState<Record<string, StudentProgressRecord>>({});
  const [cloudConnected, setCloudConnected] = useState<boolean>(true);
  const [isCodeReviewOpen, setIsCodeReviewOpen] = useState<boolean>(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState<boolean>(false);
  const [isGmailOpen, setIsGmailOpen] = useState<boolean>(false);
  const [isDoubtChatOpen, setIsDoubtChatOpen] = useState<boolean>(false);
  const [unreadDoubtCount, setUnreadDoubtCount] = useState<number>(0);
  const [lastReadDoubtTime, setLastReadDoubtTime] = useState<number>(() => {
    return Number(localStorage.getItem('ca_doubts_last_read_time')) || 0;
  });

  const [isStudyResourcesOpen, setIsStudyResourcesOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [unseenResourceCount, setUnseenResourceCount] = useState<number>(0);
  const [lastSeenResourceTime, setLastSeenResourceTime] = useState<number>(() => {
    return Number(localStorage.getItem('ca_resources_last_seen_time')) || 0;
  });

  const handleUserDeleted = (deletedFullName: string, deletedEmail: string) => {
    setStudentStoreCache((prev) => {
      const copy = { ...prev };
      delete copy[deletedFullName];
      return copy;
    });

    if (currentStudent.toUpperCase().trim() === deletedFullName.toUpperCase().trim()) {
      setCurrentStudent(currentUserProfile?.fullName || '');
    }
  };

  // Real-time listener for registered users collection
  useEffect(() => {
    if (!db) return;
    try {
      const colRef = collection(db, 'ca_registered_users');
      const unsubUsers = onSnapshot(
        colRef,
        (snapshot) => {
          const names: string[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.fullName) {
              names.push(data.fullName.trim());
            }
          });
          setRegisteredStudents(names);
          if (names.length > 0) {
            setCurrentStudent((prev) => {
              if (!prev || !prev.trim() || !names.some(n => n.toUpperCase().trim() === prev.toUpperCase().trim())) {
                return names[0];
              }
              return prev;
            });
          }
        },
        (err) => {
          console.warn('Registered users listener error:', err);
        }
      );
      return () => unsubUsers();
    } catch (e) {
      console.warn('Registered users setup error:', e);
    }
  }, []);

  // Listen for Firebase Auth user (e.g. Google Sign In) to auto-login if registered
  useEffect(() => {
    if (!auth) return;
    const unsubAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const emailDocId = sanitizeDocId(firebaseUser.email.toLowerCase().trim());
        if (db) {
          try {
            const userRef = doc(db, 'ca_registered_users', emailDocId);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
              const profile = docSnap.data() as UserProfile;
              setCurrentUserProfile(profile);
              localStorage.setItem('ca_current_user_profile', JSON.stringify(profile));
              if (profile.fullName) {
                setCurrentStudent(profile.fullName);
              }
              if (profile.groupPreparingFor) {
                setCurrentGroupFilter(profile.groupPreparingFor);
              }
            }
          } catch (e) {
            console.warn('Auth state sync error:', e);
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // Handle successful registration or login
  const handleRegisterSuccess = (profile: UserProfile) => {
    setCurrentUserProfile(profile);
    localStorage.setItem('ca_current_user_profile', JSON.stringify(profile));
    if (profile.email) {
      const userDocId = sanitizeDocId(profile.email);
      localStorage.setItem(`ca_user_profile_${userDocId}`, JSON.stringify(profile));
    }
    if (profile.fullName) {
      setCurrentStudent(profile.fullName);
      localStorage.setItem('ca_last_active_student', profile.fullName);
    }
    if (profile.groupPreparingFor) {
      setCurrentGroupFilter(profile.groupPreparingFor);
    }
  };

  // Handle sign out
  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out from your student account?')) {
      localStorage.removeItem('ca_current_user_profile');
      if (auth) {
        auth.signOut().catch(() => {});
      }
      setCurrentUserProfile(null);
    }
  };

  // Track unseen study resources count in real time
  useEffect(() => {
    if (!db) return;
    let unsubscribe = () => {};

    try {
      const q = query(collection(db, 'ca_study_resources'));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let unseen = 0;
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const deletedBy = Array.isArray(data.deletedBy) ? data.deletedBy : [];
            if (!deletedBy.includes(currentStudent)) {
              const uploadedAtMs = data.uploadedAtMs || (data.uploadedAt ? new Date(data.uploadedAt).getTime() : 0);
              if (uploadedAtMs > lastSeenResourceTime) {
                unseen++;
              }
            }
          });
          setUnseenResourceCount(unseen);
        },
        (err) => {
          console.warn('Study resources snapshot error:', err);
        }
      );
    } catch (e) {
      console.warn('Firestore study resources listener error:', e);
    }

    return () => unsubscribe();
  }, [currentStudent, lastSeenResourceTime]);

  // Reset unseen count when opening study resources
  useEffect(() => {
    if (isStudyResourcesOpen) {
      const now = Date.now();
      setLastSeenResourceTime(now);
      localStorage.setItem('ca_resources_last_seen_time', now.toString());
      setUnseenResourceCount(0);
    }
  }, [isStudyResourcesOpen]);

  // Track unread doubts count in real time
  useEffect(() => {
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    let unsubscribe = () => {};

    try {
      const q = query(collection(db, 'ca_doubts_chat'), orderBy('createdAt', 'desc'));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let unread = 0;
          const now = Date.now();
          const cutoff = now - TEN_DAYS_MS;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const createdAt = data.createdAt || now;
            if (createdAt >= cutoff && createdAt > lastReadDoubtTime) {
              unread++;
            }
          });

          setUnreadDoubtCount(unread);
        },
        (err) => {
          console.warn('Doubts chat snapshot error:', err);
        }
      );
    } catch (e) {
      console.warn('Firestore doubt listener error:', e);
    }

    return () => unsubscribe();
  }, [lastReadDoubtTime]);

  // Reset unread count when opening doubt chat
  useEffect(() => {
    if (isDoubtChatOpen) {
      const now = Date.now();
      setLastReadDoubtTime(now);
      localStorage.setItem('ca_doubts_last_read_time', now.toString());
      setUnreadDoubtCount(0);
    }
  }, [isDoubtChatOpen]);

  // Save states
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Unsubscribe ref for active student document listener
  const studentUnsubRef = useRef<(() => void) | null>(null);

  // Remember last active student
  useEffect(() => {
    if (currentStudent) {
      localStorage.setItem('ca_last_active_student', currentStudent);
    }
  }, [currentStudent]);

  // Load local storage cache on initial boot
  useEffect(() => {
    const initialCache: Record<string, StudentProgressRecord> = {};

    if (currentStudent) {
      const savedCustom = localStorage.getItem(`ca_progress_${currentStudent}`);
      if (savedCustom) {
        try {
          initialCache[currentStudent] = JSON.parse(savedCustom);
        } catch (e) {
          initialCache[currentStudent] = { studentName: currentStudent, groupFilter: 'Not Selected', topicsData: {} };
        }
      }
    }

    setStudentStoreCache(initialCache);

    // Initial group filter sync for initial student
    if (currentStudent && initialCache[currentStudent]) {
      setCurrentGroupFilter(initialCache[currentStudent].groupFilter || 'Both');
    }
  }, []);

  // Global Firestore listener for all students' progress
  useEffect(() => {
    if (!db) {
      setCloudConnected(false);
      return;
    }

    try {
      const colRef = collection(db, 'progress');
      const unsubGlobal = onSnapshot(
        colRef,
        (snapshot) => {
          setCloudConnected(true);
          const updated: Record<string, StudentProgressRecord> = {};
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.studentName) {
              const rec: StudentProgressRecord = {
                studentName: data.studentName,
                groupFilter: data.groupFilter || 'Not Selected',
                topicsData: data.topicsData || {},
              };
              updated[data.studentName] = rec;
              localStorage.setItem(`ca_progress_${data.studentName}`, JSON.stringify(rec));
            }
          });

          setStudentStoreCache((prev) => ({
            ...prev,
            ...updated,
          }));
        },
        (error) => {
          console.warn('Firestore global listener offline/fallback:', error);
          setCloudConnected(false);
        }
      );

      return () => unsubGlobal();
    } catch (e) {
      setCloudConnected(false);
    }
  }, []);

  // Listen to active student doc
  useEffect(() => {
    if (studentUnsubRef.current) {
      studentUnsubRef.current();
      studentUnsubRef.current = null;
    }

    if (!currentStudent || !db) return;

    const docId = sanitizeDocId(currentStudent);
    if (!docId) return;

    const docRef = doc(db, 'progress', docId);

    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const record: StudentProgressRecord = {
            studentName: currentStudent,
            groupFilter: data.groupFilter || 'Not Selected',
            topicsData: data.topicsData || {},
          };

          setStudentStoreCache((prev) => ({
            ...prev,
            [currentStudent]: record,
          }));
          localStorage.setItem(`ca_progress_${currentStudent}`, JSON.stringify(record));
        }
      },
      (err) => {
        console.warn(`Firestore listener error for ${currentStudent}:`, err);
      }
    );

    studentUnsubRef.current = unsub;

    return () => {
      if (studentUnsubRef.current) {
        studentUnsubRef.current();
        studentUnsubRef.current = null;
      }
    };
  }, [currentStudent]);

  // Handle student change
  const handleStudentChange = (name: string) => {
    setCurrentStudent(name);
    setHasUnsavedChanges(false);
    if (studentStoreCache[name]) {
      setCurrentGroupFilter(studentStoreCache[name].groupFilter || 'Both');
    }
  };

  // Handle group change
  const handleGroupFilterChange = (group: GroupCategory) => {
    setCurrentGroupFilter(group);
    setHasUnsavedChanges(true);
    if (!currentStudent) return;

    const existingRecord = studentStoreCache[currentStudent] || {
      studentName: currentStudent,
      groupFilter: group,
      topicsData: {},
    };

    setStudentStoreCache((prev) => ({
      ...prev,
      [currentStudent]: {
        ...existingRecord,
        groupFilter: group,
      },
    }));
  };

  // Explicit Save Handler to Firebase
  const handleSaveToFirebase = async () => {
    if (!currentStudent || !currentStudent.trim()) {
      alert('Please enter or select a student name first before saving.');
      return;
    }

    const trimmedName = currentStudent.trim();
    setIsSaving(true);

    try {
      const recordToSave: StudentProgressRecord = studentStoreCache[trimmedName] || {
        studentName: trimmedName,
        groupFilter: currentGroupFilter,
        topicsData: {},
      };

      recordToSave.groupFilter = currentGroupFilter;

      // Update LocalStorage
      localStorage.setItem(`ca_progress_${trimmedName}`, JSON.stringify(recordToSave));

      // Update studentStoreCache
      setStudentStoreCache((prev) => ({
        ...prev,
        [trimmedName]: recordToSave,
      }));

      // Write to Firebase Firestore
      if (db) {
        const docId = sanitizeDocId(trimmedName);
        if (docId) {
          await setDoc(
            doc(db, 'progress', docId),
            {
              studentName: trimmedName,
              groupFilter: recordToSave.groupFilter,
              topicsData: recordToSave.topicsData,
              lastUpdated: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }

      setHasUnsavedChanges(false);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(timeStr);
    } catch (err) {
      console.error('Error saving to Firebase:', err);
      alert('Could not save to Firebase Cloud. Please check your network connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update field on topic locally
  const handleUpdateTopicField = (topicName: string, field: keyof TopicProgressState, value: any) => {
    if (!currentStudent) {
      alert('Please select or enter a student name first.');
      return;
    }

    const constraints = getDateConstraints();
    const todayStr = new Date().toISOString().slice(0, 10);

    const currentRecord = studentStoreCache[currentStudent] || {
      studentName: currentStudent,
      groupFilter: currentGroupFilter,
      topicsData: {},
    };

    const existingTopicState = currentRecord.topicsData[topicName] || {
      completed: false,
      schDate: '',
      covDate: '',
      evaluated: false,
      revisions: 0,
    };

    // Validation for Covered Date
    if (field === 'covDate' && value) {
      if (!existingTopicState.schDate) {
        alert('Please fill the Scheduled Date before setting a Covered Date.');
        return;
      }

      if (value < existingTopicState.schDate) {
        alert(`Covered date cannot be earlier than Scheduled Date (${existingTopicState.schDate}).`);
        return;
      }

      if (value > constraints.maxCoveredDate) {
        alert('Covered date cannot be more than 2 months in the future.');
        return;
      }
    }

    // Validation for Completed Checkbox
    if (field === 'completed' && value === true) {
      if (!existingTopicState.schDate) {
        alert('Please fill the Scheduled Date before marking this topic as completed.');
        return;
      }
    }

    // Validation for Scheduled Date
    if (field === 'schDate' && value) {
      if (value < constraints.minScheduleDate || value > constraints.maxScheduleDate) {
        alert('Scheduled date must be within 2 months before or after today.');
        return;
      }

      if (existingTopicState.completed && existingTopicState.covDate && value > existingTopicState.covDate) {
        alert(`Scheduled Date (${value}) cannot be later than the existing Covered Date (${existingTopicState.covDate}). Please update or clear Covered Date first.`);
        return;
      }
    }

    setStudentStoreCache((prev) => {
      const currentTopicsData = { ...currentRecord.topicsData };

      const newTopicState = {
        ...existingTopicState,
        [field]: value,
      };

      // If updating Scheduled Date on an incomplete topic, ensure covDate doesn't conflict
      if (field === 'schDate' && !existingTopicState.completed && newTopicState.covDate && value > newTopicState.covDate) {
        newTopicState.covDate = '';
      }

      // If clearing Scheduled Date, also clear Covered Date and uncheck Completed
      if (field === 'schDate' && !value) {
        newTopicState.covDate = '';
        newTopicState.completed = false;
      }

      // Automatically tick as completed when Covered Date is filled
      if (field === 'covDate' && value) {
        newTopicState.completed = true;
      }

      // Automatically uncheck completed when Covered Date is cleared
      if (field === 'covDate' && !value) {
        newTopicState.completed = false;
      }

      // Automatically set covered date when completed checkbox is ticked if date is empty
      if (field === 'completed' && value === true && !newTopicState.covDate) {
        const defaultCovDate = todayStr < existingTopicState.schDate ? existingTopicState.schDate : todayStr;
        newTopicState.covDate = defaultCovDate;
      }

      // Automatically remove covered date when completed checkbox is unticked
      if (field === 'completed' && value === false) {
        newTopicState.covDate = '';
      }

      currentTopicsData[topicName] = newTopicState;

      const updatedRecord = {
        ...currentRecord,
        topicsData: currentTopicsData,
      };

      localStorage.setItem(`ca_progress_${currentStudent}`, JSON.stringify(updatedRecord));

      return {
        ...prev,
        [currentStudent]: updatedRecord,
      };
    });

    setHasUnsavedChanges(true);
  };

  // Mark revision completed handler
  const handleMarkRevisionCompleted = (topicName: string) => {
    if (!currentStudent) {
      alert('Please select or enter a student name first.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    setStudentStoreCache((prev) => {
      const currentRecord = prev[currentStudent] || {
        studentName: currentStudent,
        groupFilter: currentGroupFilter,
        topicsData: {},
      };

      const currentTopicsData = { ...currentRecord.topicsData };
      const topicState = currentTopicsData[topicName] || {
        completed: false,
        schDate: '',
        covDate: '',
        evaluated: false,
        revisions: 0,
      };

      const currentRevisions = typeof topicState.revisions === 'number' ? topicState.revisions : 0;

      currentTopicsData[topicName] = {
        ...topicState,
        completed: true,
        covDate: topicState.covDate || todayStr,
        revisions: currentRevisions + 1,
        lastRevisionDate: todayStr,
      };

      return {
        ...prev,
        [currentStudent]: {
          ...currentRecord,
          topicsData: currentTopicsData,
        },
      };
    });

    setHasUnsavedChanges(true);
  };

  // Update revision counter
  const handleUpdateRevision = (topicName: string, delta: number) => {
    if (!currentStudent) {
      alert('Please select or enter a student name first.');
      return;
    }

    setStudentStoreCache((prev) => {
      const currentRecord = prev[currentStudent] || {
        studentName: currentStudent,
        groupFilter: currentGroupFilter,
        topicsData: {},
      };

      const currentTopicsData = { ...currentRecord.topicsData };
      const topicState = currentTopicsData[topicName] || {
        completed: false,
        schDate: '',
        covDate: '',
        evaluated: false,
        revisions: 0,
      };

      const currentRev = typeof topicState.revisions === 'number' ? topicState.revisions : 0;
      const newRev = Math.max(0, currentRev + delta);

      currentTopicsData[topicName] = {
        ...topicState,
        revisions: newRev,
      };

      return {
        ...prev,
        [currentStudent]: {
          ...currentRecord,
          topicsData: currentTopicsData,
        },
      };
    });

    setHasUnsavedChanges(true);
  };

  // Clear dates for topic
  const handleClearTopicDates = (topicName: string) => {
    if (!currentStudent) {
      alert('Please select or enter a student name first.');
      return;
    }

    setStudentStoreCache((prev) => {
      const currentRecord = prev[currentStudent] || {
        studentName: currentStudent,
        groupFilter: currentGroupFilter,
        topicsData: {},
      };

      const currentTopicsData = { ...currentRecord.topicsData };
      const currentTopicState = currentTopicsData[topicName] || {
        completed: false,
        evaluated: false,
        revisions: 0,
      };

      currentTopicsData[topicName] = {
        ...currentTopicState,
        schDate: '',
        covDate: '',
      };

      return {
        ...prev,
        [currentStudent]: {
          ...currentRecord,
          topicsData: currentTopicsData,
        },
      };
    });

    setHasUnsavedChanges(true);
  };

  // Batch mark visible topics
  const handleBatchMarkVisible = (completed: boolean, visibleTopics: typeof TOPICS_DATA) => {
    if (!currentStudent) {
      alert('Please select or enter a student name first.');
      return;
    }

    const currentRecord = studentStoreCache[currentStudent] || {
      studentName: currentStudent,
      groupFilter: currentGroupFilter,
      topicsData: {},
    };

    const currentTopicsData = { ...currentRecord.topicsData };

    visibleTopics.forEach((t) => {
      const state = currentTopicsData[t.topicName] || {
        schDate: '',
        covDate: '',
        evaluated: false,
        revisions: 0,
      };
      currentTopicsData[t.topicName] = {
        ...state,
        completed,
      };
    });

    const updatedRecord: StudentProgressRecord = {
      ...currentRecord,
      topicsData: currentTopicsData,
    };

    setStudentStoreCache((prev) => ({
      ...prev,
      [currentStudent]: updatedRecord,
    }));
    setHasUnsavedChanges(true);
  };

  const currentTopicsMap = (studentStoreCache[currentStudent] || {}).topicsData || {};

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* Navigation Header with Timer */}
      <Header
        currentStudent={currentStudent}
        onStudentChange={handleStudentChange}
        currentGroupFilter={currentGroupFilter}
        onGroupFilterChange={handleGroupFilterChange}
        onSaveToFirebase={handleSaveToFirebase}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedTime={lastSavedTime}
        onOpenCodeReview={() => setIsCodeReviewOpen(false)}
        onSendMailForEvaluation={() => setIsGmailOpen(true)}
        onOpenDoubtChat={() => setIsDoubtChatOpen(true)}
        unreadDoubtCount={unreadDoubtCount}
        onOpenStudyResources={() => setIsStudyResourcesOpen(true)}
        unseenResourceCount={unseenResourceCount}
        currentTopicsData={currentTopicsMap}
        studentStoreCache={studentStoreCache}
        currentUserProfile={currentUserProfile}
        onSignOut={handleSignOut}
        onOpenAdminConsole={() => setIsAdminModalOpen(true)}
        registeredStudents={registeredStudents}
      />

      {/* Global Student Progress Bar */}
      <GlobalProgressOverview
        currentStudent={currentStudent}
        studentStoreCache={studentStoreCache}
        onSelectStudent={handleStudentChange}
        registeredStudents={registeredStudents}
      />

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full space-y-6">
        
        {/* 10-Day Spaced Repetition Revision Notification Widget */}
        <RevisionReminderBox
          currentStudent={currentStudent}
          currentGroupFilter={currentGroupFilter}
          currentTopicsData={currentTopicsMap}
          onUpdateTopicField={handleUpdateTopicField}
          onUpdateRevision={handleUpdateRevision}
          onMarkRevisionCompleted={handleMarkRevisionCompleted}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Analytics */}
          <ProgressSidebar
            currentStudent={currentStudent}
            currentGroupFilter={currentGroupFilter}
            studentStoreCache={studentStoreCache}
            cloudConnected={cloudConnected}
            onUpdateTopicField={handleUpdateTopicField}
          />

          {/* Right Main Column: Next 5 Topics + Topics Checklist Grid */}
          <div className="lg:col-span-3 space-y-6">
            {/* Next 5 Topics To Cover Section - JUST BEFORE Syllabus Topics Checklist */}
            <NextTopicsBox
              currentStudent={currentStudent}
              currentGroupFilter={currentGroupFilter}
              currentTopicsData={currentTopicsMap}
              onUpdateTopicField={handleUpdateTopicField}
            />

            {/* Topics Checklist Grid */}
            <TopicsChecklist
              currentStudent={currentStudent}
              currentGroupFilter={currentGroupFilter}
              currentTopicsData={currentTopicsMap}
              onUpdateTopicField={handleUpdateTopicField}
              onUpdateRevision={handleUpdateRevision}
              onClearTopicDates={handleClearTopicDates}
              onBatchMarkVisible={handleBatchMarkVisible}
            />
          </div>
        </div>
      </main>

      {/* Code Review Modal */}
      <CodeReviewModal
        isOpen={isCodeReviewOpen}
        onClose={() => setIsCodeReviewOpen(false)}
      />

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsModal
        isOpen={isGoogleSheetsOpen}
        onClose={() => setIsGoogleSheetsOpen(false)}
        currentStudent={currentStudent}
        currentTopicsData={currentTopicsMap}
        currentGroupFilter={currentGroupFilter}
      />

      {/* Gmail Integration Modal */}
      <GmailModal
        isOpen={isGmailOpen}
        onClose={() => setIsGmailOpen(false)}
        currentStudent={currentStudent}
        currentTopicsData={currentTopicsMap}
        currentGroupFilter={currentGroupFilter}
      />

      {/* Doubt Clearing Chat Modal */}
      <DoubtClearingModal
        isOpen={isDoubtChatOpen}
        onClose={() => setIsDoubtChatOpen(false)}
        currentStudent={currentStudent}
      />

      {/* Study Resources Modal */}
      <StudyResourcesBox
        isOpen={isStudyResourcesOpen}
        onClose={() => setIsStudyResourcesOpen(false)}
        currentStudent={currentStudent}
        currentGroupFilter={currentGroupFilter}
      />

      {/* Registration & Authentication Gate Modal */}
      <RegisterModal
        isOpen={!currentUserProfile}
        onRegisterSuccess={handleRegisterSuccess}
        currentUserProfile={currentUserProfile}
      />

      {/* Admin User Management Modal */}
      <AdminUserManagementModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        adminEmail="johnbosco9947@gmail.com"
        onUserDeleted={handleUserDeleted}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-center py-4 text-xs text-slate-500 mt-auto">
        CA Final Syllabus Tracker &copy; 2026 &bull; Real-time Firebase Cloud Synchronization &bull; Modern React & Tailwind
      </footer>

    </div>
  );
}

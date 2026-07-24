import React, { useState, useEffect } from 'react';
import { AdminRequest, UserProfile, GroupCategory } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { sanitizeDocId } from '../data/studentsAndTopics';
import { 
  ShieldCheck, 
  Trash2, 
  UserPlus, 
  Search, 
  Download, 
  X, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  Crown, 
  Mail, 
  Layers, 
  Loader2, 
  Clock, 
  Check, 
  XCircle,
  Pencil,
  Calendar,
  KeyRound
} from 'lucide-react';

interface AdminUserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail?: string;
  onUserDeleted?: (deletedFullName: string, deletedEmail: string) => void;
  onUserAdded?: (newUser: UserProfile) => void;
}

export const AdminUserManagementModal: React.FC<AdminUserManagementModalProps> = ({
  isOpen,
  onClose,
  adminEmail = 'johnbosco9947@gmail.com',
  onUserDeleted,
  onUserAdded,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [adminTab, setAdminTab] = useState<'students' | 'admin_requests'>('students');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  
  // Deleting state
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editing Student state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editGroup, setEditGroup] = useState<GroupCategory>('Both');
  const [editExamMonth, setEditExamMonth] = useState<string>('May');
  const [editExamYear, setEditExamYear] = useState<string>('2025');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Add User Form State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newFirstName, setNewFirstName] = useState<string>('');
  const [newLastName, setNewLastName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newGroup, setNewGroup] = useState<GroupCategory>('Both');
  const [newExamMonth, setNewExamMonth] = useState<string>('May');
  const [newExamYear, setNewExamYear] = useState<string>('2025');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Subscribe to real-time registered users AND progress collection from Firestore
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    if (!db) {
      setLoading(false);
      return;
    }

    const registeredMap = new Map<string, UserProfile>();
    const progressMap = new Map<string, UserProfile>();

    const updateMergedUsers = () => {
      const mergedMap = new Map<string, UserProfile>();

      // 1. Add all registered users
      registeredMap.forEach((user, key) => {
        const progUser = progressMap.get(key);
        const mergedProgressDocIds = Array.from(
          new Set([...(user.progressDocIds || []), ...(progUser?.progressDocIds || [])])
        );
        mergedMap.set(key, {
          ...user,
          progressDocIds: mergedProgressDocIds,
        });
      });

      // 2. Add progress records for unregistered students
      progressMap.forEach((user, key) => {
        if (!mergedMap.has(key)) {
          mergedMap.set(key, user);
        }
      });

      const loadedUsers = Array.from(mergedMap.values());
      loadedUsers.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      setUsers(loadedUsers);
      setLoading(false);
    };

    try {
      const colRef = collection(db, 'ca_registered_users');
      const unsubReg = onSnapshot(
        colRef,
        (snapshot) => {
          registeredMap.clear();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.fullName) {
              const uName = data.fullName.trim();
              const upperKey = uName.toUpperCase();
              const existing = registeredMap.get(upperKey);
              const userDocIds = existing?.userDocIds ? [...existing.userDocIds, docSnap.id] : [docSnap.id];
              registeredMap.set(upperKey, {
                email: data.email || docSnap.id,
                firstName: data.firstName || '',
                middleName: data.middleName || '',
                lastName: data.lastName || '',
                fullName: uName,
                groupPreparingFor: data.groupPreparingFor || 'Both',
                examMonthYear: data.examMonthYear || 'Not Set',
                registeredAt: data.registeredAt || new Date().toISOString(),
                photoURL: data.photoURL || '',
                role: data.role,
                userDocIds,
              });
            }
          });
          updateMergedUsers();
        },
        (err) => {
          console.warn('Error fetching registered users:', err);
          setLoading(false);
        }
      );

      const progRef = collection(db, 'progress');
      const unsubProg = onSnapshot(
        progRef,
        (snapshot) => {
          progressMap.clear();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const pName = (data?.studentName || docSnap.id).trim();
            if (pName && !pName.toLowerCase().startsWith('unregistered_')) {
              const upperKey = pName.toUpperCase();
              const isSuperAdmin = upperKey.includes('JOHN') || upperKey.includes('MANIKUTTAN');
              if (!isSuperAdmin) {
                const nameParts = pName.split(' ');
                const existing = progressMap.get(upperKey);
                const progressDocIds = existing?.progressDocIds ? [...existing.progressDocIds, docSnap.id] : [docSnap.id];
                progressMap.set(upperKey, {
                  email: `unregistered_${sanitizeDocId(pName)}@progress.local`,
                  firstName: nameParts[0] || pName,
                  lastName: nameParts.slice(1).join(' ') || '',
                  fullName: pName,
                  groupPreparingFor: (data.groupFilter as GroupCategory) || 'Both',
                  examMonthYear: 'Unregistered Progress',
                  registeredAt: data.lastUpdated || new Date().toISOString(),
                  role: 'student',
                  progressDocIds,
                });
              }
            }
          });
          updateMergedUsers();
        },
        (err) => {
          console.warn('Error fetching progress collection:', err);
        }
      );

      return () => {
        unsubReg();
        unsubProg();
      };
    } catch (e) {
      console.warn('Firestore sub error:', e);
      setLoading(false);
    }
  }, [isOpen]);

  // Subscribe to pending admin requests in real time
  useEffect(() => {
    if (!isOpen || !db) return;

    try {
      const reqColRef = collection(db, 'ca_admin_requests');
      const unsubReq = onSnapshot(
        reqColRef,
        (snapshot) => {
          const loadedReqs: AdminRequest[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.email) {
              loadedReqs.push({
                id: docSnap.id,
                email: data.email,
                fullName: data.fullName || 'Admin Candidate',
                requestedAt: data.requestedAt || new Date().toISOString(),
                status: data.status || 'pending',
                reason: data.reason || '',
                approvedBy: data.approvedBy,
              });
            }
          });
          loadedReqs.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
          setAdminRequests(loadedReqs);
        },
        (err) => {
          console.warn('Error fetching admin requests:', err);
        }
      );

      return () => unsubReq();
    } catch (err) {
      console.warn('Admin requests sub error:', err);
    }
  }, [isOpen]);

  // Handle Accept Admin Request
  const handleAcceptAdminRequest = async (req: AdminRequest) => {
    if (!db) return;
    try {
      const docId = sanitizeDocId(req.email);
      await setDoc(doc(db, 'ca_admin_requests', docId), { status: 'approved', approvedBy: adminEmail }, { merge: true });
      await setDoc(doc(db, 'ca_approved_admins', docId), {
        email: req.email.toLowerCase().trim(),
        fullName: req.fullName,
        approvedAt: new Date().toISOString(),
        role: 'admin',
      }, { merge: true });

      await setDoc(doc(db, 'ca_registered_users', docId), {
        email: req.email.toLowerCase().trim(),
        fullName: req.fullName.toUpperCase(),
        role: 'admin',
        registeredAt: new Date().toISOString(),
      }, { merge: true });

      setStatusMessage({
        type: 'success',
        text: `Successfully approved Admin Access for ${req.fullName} (${req.email}).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error approving admin request: ${err.message || 'Unknown error'}`,
      });
    }
  };

  // Handle Reject Admin Request
  const handleRejectAdminRequest = async (req: AdminRequest) => {
    if (!db) return;
    try {
      const docId = sanitizeDocId(req.email);
      await setDoc(doc(db, 'ca_admin_requests', docId), { status: 'rejected' }, { merge: true });
      setStatusMessage({
        type: 'success',
        text: `Rejected Admin Access request for ${req.fullName} (${req.email}).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error rejecting admin request: ${err.message || 'Unknown error'}`,
      });
    }
  };

  // Open Edit Student Dialog
  const handleStartEdit = (user: UserProfile) => {
    setEditingUser(user);
    const names = user.fullName.split(' ');
    setEditFirstName(user.firstName || names[0] || '');
    setEditLastName(user.lastName || names.slice(1).join(' ') || '');
    setEditGroup(user.groupPreparingFor || 'Both');

    if (user.examMonthYear && user.examMonthYear !== 'Not Set') {
      const parts = user.examMonthYear.split(' ');
      if (parts.length >= 2) {
        setEditExamMonth(parts[0]);
        setEditExamYear(parts[1]);
      } else {
        setEditExamMonth('May');
        setEditExamYear('2025');
      }
    } else {
      setEditExamMonth('May');
      setEditExamYear('2025');
    }
  };

  // Save Student Edit
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editFirstName.trim() || !editLastName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter First Name and Last Name.' });
      return;
    }

    setIsSavingEdit(true);
    setStatusMessage(null);

    const newFullName = `${editFirstName.trim()} ${editLastName.trim()}`.toUpperCase();
    const emailDocId = sanitizeDocId(editingUser.email);
    const examMonthYearStr = `${editExamMonth} ${editExamYear}`;

    try {
      if (db) {
        // 1. Update ca_registered_users document
        await setDoc(doc(db, 'ca_registered_users', emailDocId), {
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          fullName: newFullName,
          groupPreparingFor: editGroup,
          examMonthYear: examMonthYearStr,
        }, { merge: true });

        // 2. Update progress record if student name changed or group changed
        const oldProgressId = sanitizeDocId(editingUser.fullName);
        const newProgressId = sanitizeDocId(newFullName);

        if (oldProgressId !== newProgressId) {
          const oldRef = doc(db, 'progress', oldProgressId);
          const oldSnap = await getDoc(oldRef);
          const oldData = oldSnap.exists() ? oldSnap.data() : { topicsData: {} };

          await setDoc(doc(db, 'progress', newProgressId), {
            studentName: newFullName,
            groupFilter: editGroup,
            topicsData: oldData.topicsData || {},
            lastUpdated: new Date().toISOString(),
          }, { merge: true });

          // Clean up old progress document
          await deleteDoc(oldRef);
        } else {
          await setDoc(doc(db, 'progress', newProgressId), {
            studentName: newFullName,
            groupFilter: editGroup,
            lastUpdated: new Date().toISOString(),
          }, { merge: true });
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully updated student details for ${newFullName}!`,
      });
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error saving student edit:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to update student details: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'All' || u.groupPreparingFor === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  // Handle User Deletion
  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setStatusMessage(null);

    const emailToDelete = userToDelete.email.toLowerCase().trim();
    const nameToDelete = userToDelete.fullName;
    const userDocId = sanitizeDocId(emailToDelete);
    const nameDocId = sanitizeDocId(nameToDelete);
    const upperNameDocId = sanitizeDocId(nameToDelete.toUpperCase());

    try {
      if (db) {
        const deletePromises: Promise<void>[] = [];

        // 1. Delete all tracked userDocIds from ca_registered_users
        if (userToDelete.userDocIds && userToDelete.userDocIds.length > 0) {
          userToDelete.userDocIds.forEach((id) => {
            deletePromises.push(deleteDoc(doc(db, 'ca_registered_users', id)).catch(() => {}));
          });
        }

        // 2. Delete all tracked progressDocIds from progress
        if (userToDelete.progressDocIds && userToDelete.progressDocIds.length > 0) {
          userToDelete.progressDocIds.forEach((id) => {
            deletePromises.push(deleteDoc(doc(db, 'progress', id)).catch(() => {}));
          });
        }

        // 3. Candidate fallback IDs for ca_registered_users
        const candidateUserIds = Array.from(
          new Set([
            userDocId,
            emailToDelete,
            userToDelete.email,
            nameDocId,
            upperNameDocId,
            nameToDelete,
            nameToDelete.toUpperCase(),
          ])
        );
        candidateUserIds.forEach((id) => {
          if (id) deletePromises.push(deleteDoc(doc(db, 'ca_registered_users', id)).catch(() => {}));
        });

        // 4. Candidate fallback IDs for progress
        const candidateProgressIds = Array.from(
          new Set([
            nameDocId,
            upperNameDocId,
            nameToDelete,
            nameToDelete.toUpperCase(),
            userDocId,
          ])
        );
        candidateProgressIds.forEach((id) => {
          if (id) deletePromises.push(deleteDoc(doc(db, 'progress', id)).catch(() => {}));
        });

        // 5. Query and delete docs matching fullName or email in ca_registered_users
        try {
          const q1 = query(collection(db, 'ca_registered_users'), where('fullName', '==', nameToDelete));
          const snap1 = await getDocs(q1);
          snap1.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        try {
          const q2 = query(collection(db, 'ca_registered_users'), where('fullName', '==', nameToDelete.toUpperCase()));
          const snap2 = await getDocs(q2);
          snap2.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        if (!emailToDelete.includes('@progress.local')) {
          try {
            const q3 = query(collection(db, 'ca_registered_users'), where('email', '==', emailToDelete));
            const snap3 = await getDocs(q3);
            snap3.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
          } catch (e) {}
        }

        // 6. Query and delete docs matching studentName in progress
        try {
          const q4 = query(collection(db, 'progress'), where('studentName', '==', nameToDelete));
          const snap4 = await getDocs(q4);
          snap4.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        try {
          const q5 = query(collection(db, 'progress'), where('studentName', '==', nameToDelete.toUpperCase()));
          const snap5 = await getDocs(q5);
          snap5.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        // Delete admin requests / approvals if any
        deletePromises.push(deleteDoc(doc(db, 'ca_admin_requests', userDocId)).catch(() => {}));
        deletePromises.push(deleteDoc(doc(db, 'ca_approved_admins', userDocId)).catch(() => {}));

        await Promise.all(deletePromises);
      }

      // Clear local storage entries
      localStorage.removeItem(`ca_user_profile_${userDocId}`);
      localStorage.removeItem(`ca_user_profile_${nameDocId}`);
      localStorage.removeItem(`ca_progress_${nameToDelete}`);
      localStorage.removeItem(`ca_progress_${nameToDelete.toUpperCase()}`);

      // Optimistically remove from modal state so item disappears instantly
      setUsers((prev) =>
        prev.filter(
          (u) =>
            u.fullName.toUpperCase().trim() !== nameToDelete.toUpperCase().trim() &&
            u.email.toLowerCase().trim() !== emailToDelete
        )
      );

      setStatusMessage({
        type: 'success',
        text: `Successfully deleted all data and records for ${nameToDelete}.`,
      });

      if (onUserDeleted) {
        onUserDeleted(nameToDelete, emailToDelete);
      }

      setUserToDelete(null);
    } catch (err: any) {
      console.error('Delete user error:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to delete user: ${err.message || 'Network error'}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Add New User directly by Admin
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) {
      setStatusMessage({ type: 'error', text: 'Please fill in First Name, Last Name, and Email.' });
      return;
    }

    const trimmedEmail = newEmail.toLowerCase().trim();
    if (!trimmedEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Email ID.' });
      return;
    }

    setIsAdding(true);
    setStatusMessage(null);

    const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.toUpperCase();
    const userDocId = sanitizeDocId(trimmedEmail);

    const newUserProfile: UserProfile = {
      email: trimmedEmail,
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      fullName: fullName,
      groupPreparingFor: newGroup,
      examMonthYear: `${newExamMonth} ${newExamYear}`,
      registeredAt: new Date().toISOString(),
    };

    try {
      if (db) {
        // Save user profile in Firestore
        const firestorePayload = JSON.parse(JSON.stringify(newUserProfile));
        await setDoc(doc(db, 'ca_registered_users', userDocId), firestorePayload, { merge: true });

        // Create empty progress document
        const progressRef = doc(db, 'progress', sanitizeDocId(fullName));
        const progressSnap = await getDoc(progressRef);
        if (!progressSnap.exists()) {
          await setDoc(progressRef, {
            studentName: fullName,
            groupFilter: newGroup,
            topicsData: {},
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Student ${fullName} registered successfully!`,
      });

      if (onUserAdded) {
        onUserAdded(newUserProfile);
      }

      // Reset form
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Error adding user:', err);
      setStatusMessage({
        type: 'error',
        text: `Error registering student: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Export Users CSV
  const handleExportCSV = () => {
    if (users.length === 0) return;

    const headers = ['Full Name', 'Email ID', 'Group Preparing For', 'Exam Target', 'Registration Date'];
    const rows = users.map((u) => [
      `"${u.fullName.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      `"${u.groupPreparingFor}"`,
      `"${u.examMonthYear || 'Not Set'}"`,
      `"${new Date(u.registeredAt).toLocaleDateString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CA_Final_Registered_Students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const pendingRequestsCount = adminRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-w-5xl w-full my-auto flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-400/40 rounded-2xl flex items-center justify-center shadow-inner">
              <Crown className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Admin User Management Console
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-300" /> Admin Authorized
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 flex items-center gap-1">
                <span>Manage registered student profiles, edit student names & preparing groups, review exam targets, or manage admin access requests.</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Close Admin Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-3 text-xs sm:text-sm font-bold flex items-center justify-between gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-bold underline hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-900 border-b border-indigo-900/50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdminTab('students')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              adminTab === 'students'
                ? 'bg-white text-slate-900 border-indigo-600 shadow-sm'
                : 'text-indigo-200 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span>Registered Students ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('admin_requests')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              adminTab === 'admin_requests'
                ? 'bg-white text-slate-900 border-amber-500 shadow-sm'
                : 'text-amber-200 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending Admin Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {/* Top Summary Metrics - Only for Students Tab */}
        {adminTab === 'students' && (
          <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Registered</span>
              <div className="text-xl font-black text-slate-900 mt-0.5 flex items-baseline gap-1">
                <span>{users.length}</span>
                <span className="text-xs font-semibold text-slate-500">Students</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Both Groups</span>
              <div className="text-xl font-black text-emerald-950 mt-0.5">
                {users.filter((u) => u.groupPreparingFor === 'Both').length}
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">First Group</span>
              <div className="text-xl font-black text-indigo-950 mt-0.5">
                {users.filter((u) => u.groupPreparingFor === 'First Group').length}
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">Second Group</span>
              <div className="text-xl font-black text-purple-950 mt-0.5">
                {users.filter((u) => u.groupPreparingFor === 'Second Group').length}
              </div>
            </div>
          </div>
        )}

        {/* Toolbar Controls for Students Tab */}
        {adminTab === 'students' && (
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name or email..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Group Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="All">All Groups</option>
                <option value="Both">Both Groups</option>
                <option value="First Group">First Group</option>
                <option value="Second Group">Second Group</option>
              </select>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>{showAddForm ? 'Cancel Add' : 'Add Student'}</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={users.length === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Export registered students list to CSV"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Add Student Form */}
        {adminTab === 'students' && showAddForm && (
          <form
            onSubmit={handleAddUserSubmit}
            className="p-4 sm:p-5 bg-indigo-50/80 border-b border-indigo-100 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end animate-in slide-in-from-top-2 duration-200 shrink-0"
          >
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">First Name</label>
              <input
                type="text"
                required
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="e.g. Rahul"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="e.g. Kumar"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">Email ID</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="rahul@gmail.com"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">Exam Target</label>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={newExamMonth}
                  onChange={(e) => setNewExamMonth(e.target.value)}
                  className="px-2 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="May">May</option>
                  <option value="September">Sept</option>
                  <option value="November">Nov</option>
                  <option value="January">Jan</option>
                </select>
                <select
                  value={newExamYear}
                  onChange={(e) => setNewExamYear(e.target.value)}
                  className="px-2 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isAdding}
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Confirm Register</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Content Section: Pending Admin Requests OR Registered Students Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {adminTab === 'admin_requests' ? (
            /* ADMIN ACCESS REQUESTS TAB */
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-between text-amber-900">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">Faculty & Admin Access Requests</h4>
                    <p className="text-xs text-amber-900 font-medium mt-0.5">
                      Review and accept incoming faculty admin requests to grant progress monitoring access.
                    </p>
                  </div>
                </div>
                <span className="bg-amber-200 text-amber-950 text-xs font-extrabold px-3 py-1 rounded-full border border-amber-300">
                  {pendingRequestsCount} Pending
                </span>
              </div>

              {adminRequests.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-700">No Admin Requests Recorded</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    No users have requested faculty/admin access yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <th className="p-3.5">Candidate Name</th>
                        <th className="p-3.5">Email Address</th>
                        <th className="p-3.5">Purpose / Reason</th>
                        <th className="p-3.5">Requested Date</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Admin Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-amber-50/40 transition">
                          <td className="p-3.5 font-extrabold text-slate-900 uppercase">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-800 font-black flex items-center justify-center text-xs">
                                {req.fullName ? req.fullName.slice(0, 2) : 'AD'}
                              </div>
                              <span>{req.fullName}</span>
                            </div>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-700">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{req.email}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600 text-xs italic max-w-xs truncate">
                            {req.reason || 'No reason specified'}
                          </td>
                          <td className="p-3.5 text-slate-500 font-medium text-xs">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(req.requestedAt).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 border ${
                                req.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : req.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                              }`}
                            >
                              {req.status === 'approved' && <Check className="w-3 h-3 text-emerald-600" />}
                              {req.status === 'rejected' && <XCircle className="w-3 h-3 text-rose-600" />}
                              <span>{req.status}</span>
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {req.status !== 'approved' && (
                                <button
                                  onClick={() => handleAcceptAdminRequest(req)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
                                  title="Approve Admin Access"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve Access</span>
                                </button>
                              )}
                              {req.status !== 'rejected' && (
                                <button
                                  onClick={() => handleRejectAdminRequest(req)}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                                  title="Reject Admin Request"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Reject</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* REGISTERED STUDENTS TAB */
            loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
                <p className="text-xs font-semibold">Loading registered students list from Firestore Cloud...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No Registered Users Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedGroup !== 'All'
                    ? 'No students match your current search query or group filter.'
                    : 'No student registrations recorded yet in the system.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="p-3.5">Student Name</th>
                      <th className="p-3.5">Registered Email</th>
                      <th className="p-3.5">Group Target</th>
                      <th className="p-3.5">Exam Target</th>
                      <th className="p-3.5">Registration Date</th>
                      <th className="p-3.5 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => {
                      const isUserAdmin = 
                        user.email.toLowerCase().trim() === adminEmail.toLowerCase().trim() ||
                        user.role === 'admin' ||
                        user.role === 'superadmin';

                      const isUnregisteredProgress =
                        user.email.includes('@progress.local') ||
                        user.examMonthYear === 'Unregistered Progress';

                      return (
                        <tr key={user.email} className="hover:bg-indigo-50/40 transition">
                          {/* Name */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-extrabold flex items-center justify-center text-xs shadow-xs shrink-0 uppercase">
                                {user.fullName ? user.fullName.slice(0, 2) : 'ST'}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                                  <span>{user.fullName}</span>
                                  {isUserAdmin && (
                                    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                                      ADMIN
                                    </span>
                                  )}
                                  {isUnregisteredProgress && (
                                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                      UNREGISTERED PROGRESS
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium">CA Final Candidate</span>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="p-3.5 font-semibold text-slate-700">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {isUnregisteredProgress ? (
                                <span className="italic text-slate-400 text-xs">No Account Registered</span>
                              ) : (
                                <span>{user.email}</span>
                              )}
                            </div>
                          </td>

                          {/* Group */}
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 border ${
                                user.groupPreparingFor === 'Both'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : user.groupPreparingFor === 'First Group'
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                  : 'bg-purple-100 text-purple-800 border-purple-300'
                              }`}
                            >
                              <Layers className="w-3 h-3" />
                              <span>{user.groupPreparingFor}</span>
                            </span>
                          </td>

                          {/* Exam Target Month & Year */}
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-600" />
                              <span>{user.examMonthYear || 'Not Set'}</span>
                            </span>
                          </td>

                          {/* Date */}
                          <td className="p-3.5 text-slate-500 font-medium text-xs">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(user.registeredAt).toLocaleDateString()}</span>
                            </div>
                          </td>

                          {/* Actions: Edit & Delete */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleStartEdit(user)}
                                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                                title={`Edit ${user.fullName} details (Name, Group, Exam Target)`}
                              >
                                <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-xs font-bold hidden sm:inline">Edit</span>
                              </button>
                              <button
                                onClick={() => setUserToDelete(user)}
                                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                                title={`Delete ${user.fullName} account permanently`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span className="text-xs font-bold hidden sm:inline">Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-semibold">
            {adminTab === 'students'
              ? `Showing ${filteredUsers.length} of ${users.length} registered students`
              : `Total Admin Requests: ${adminRequests.length}`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>

      {/* Edit Student Details Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-indigo-100 text-left relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center font-black">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Edit Student Details</h3>
                  <p className="text-xs text-slate-500">{editingUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Group Preparing For</label>
                <select
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value as GroupCategory)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Both">Both Groups</option>
                  <option value="First Group">First Group</option>
                  <option value="Second Group">Second Group</option>
                  <option value="Not Selected">Not Selected</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Target Examination Month & Year
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editExamMonth}
                    onChange={(e) => setEditExamMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="May">May</option>
                    <option value="September">September</option>
                    <option value="November">November</option>
                    <option value="January">January</option>
                  </select>
                  <select
                    value={editExamYear}
                    onChange={(e) => setEditExamYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for User Deletion */}
      {userToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-rose-100 text-center relative">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              Delete Registered Student?
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 uppercase font-black">{userToDelete.fullName}</strong> (<span className="text-indigo-600 font-semibold">{userToDelete.email}</span>)?
            </p>

            <div className="mt-3 bg-rose-50 border border-rose-200 p-3 rounded-2xl text-left text-xs text-rose-800 font-medium">
              ⚠️ <strong>Warning:</strong> This will erase their user profile and progress record permanently from Firebase Cloud database. This action cannot be undone!
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="w-1/2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs sm:text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUserConfirm}
                disabled={isDeleting}
                className="w-1/2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

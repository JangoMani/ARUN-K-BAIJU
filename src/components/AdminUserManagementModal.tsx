import React, { useState, useEffect } from 'react';
import { AdminRequest, UserProfile, GroupCategory } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
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
  BarChart2,
  RefreshCw,
  Clock,
  Check,
  XCircle,
  Inbox
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
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add User Form State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newFirstName, setNewFirstName] = useState<string>('');
  const [newLastName, setNewLastName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newGroup, setNewGroup] = useState<GroupCategory>('Both');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Subscribe to real-time registered users from Firestore
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      const colRef = collection(db, 'ca_registered_users');
      const unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const loadedUsers: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.fullName) {
              loadedUsers.push({
                email: data.email || docSnap.id,
                firstName: data.firstName || '',
                middleName: data.middleName || '',
                lastName: data.lastName || '',
                fullName: data.fullName,
                groupPreparingFor: data.groupPreparingFor || 'Both',
                registeredAt: data.registeredAt || new Date().toISOString(),
                photoURL: data.photoURL || '',
              });
            }
          });

          // Sort by newest registration first
          loadedUsers.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
          setUsers(loadedUsers);
          setLoading(false);
        },
        (err) => {
          console.warn('Error fetching registered users:', err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
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

  if (!isOpen) return null;

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
    const progressDocId = sanitizeDocId(nameToDelete);

    try {
      if (db) {
        // Delete from ca_registered_users
        const userRef = doc(db, 'ca_registered_users', userDocId);
        await deleteDoc(userRef);

        // Delete progress record if exists
        const progressRef = doc(db, 'progress', progressDocId);
        await deleteDoc(progressRef);
      }

      // Clear local storage entries
      localStorage.removeItem(`ca_user_profile_${userDocId}`);
      localStorage.removeItem(`ca_progress_${nameToDelete}`);

      setStatusMessage({
        type: 'success',
        text: `Successfully deleted student account for ${nameToDelete} (${emailToDelete}).`,
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

    const headers = ['Full Name', 'Email ID', 'Group Preparing For', 'Registration Date'];
    const rows = users.map((u) => [
      `"${u.fullName.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      `"${u.groupPreparingFor}"`,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-w-4xl w-full my-auto flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-400/40 rounded-2xl flex items-center justify-center shadow-inner">
              <Crown className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Admin User Management
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-300" /> Admin Authorized
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 flex items-center gap-1">
                <span>Manage registered CA Final students, register new users, or delete student accounts.</span>
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
            {adminRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                {adminRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
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

        {/* Toolbar Controls */}
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

        {/* Collapsible Add Student Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddUserSubmit}
            className="p-4 sm:p-5 bg-indigo-50/80 border-b border-indigo-100 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end animate-in slide-in-from-top-2 duration-200 shrink-0"
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

        {/* Users List Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
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
                    <th className="p-3.5">Registration Date</th>
                    <th className="p-3.5 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const isUserAdmin = 
                      user.email.toLowerCase().trim() === adminEmail.toLowerCase().trim() ||
                      (user.fullName && user.fullName.toUpperCase().includes('ARUN'));

                    return (
                      <tr key={user.email} className="hover:bg-indigo-50/40 transition">
                        {/* Name */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-extrabold flex items-center justify-center text-xs shadow-xs shrink-0 uppercase">
                              {user.fullName ? user.fullName.slice(0, 2) : 'ST'}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                <span>{user.fullName}</span>
                                {isUserAdmin && (
                                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                                    ADMIN
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
                            <span>{user.email}</span>
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

                        {/* Date */}
                        <td className="p-3.5 text-slate-500 font-medium text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(user.registeredAt).toLocaleDateString()}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                            title={`Delete ${user.fullName} account permanently`}
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                            <span className="text-xs font-bold">Delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-semibold">Showing {filteredUsers.length} of {users.length} registered students</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>

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

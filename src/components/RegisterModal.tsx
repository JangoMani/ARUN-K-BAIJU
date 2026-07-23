import React, { useState, useEffect } from 'react';
import { GroupCategory, UserProfile } from '../types';
import { db, auth, googleProvider } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { sanitizeDocId } from '../data/studentsAndTopics';
import {
  User,
  Mail,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  LogIn,
  UserPlus,
} from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onRegisterSuccess: (userProfile: UserProfile) => void;
  currentUserProfile?: UserProfile | null;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onRegisterSuccess,
  currentUserProfile,
}) => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [groupPreparingFor, setGroupPreparingFor] = useState<GroupCategory>('Both');
  const [loginEmail, setLoginEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-fill if user attempts Google sign-in
  const [googlePhotoURL, setGooglePhotoURL] = useState<string | undefined>(undefined);

  if (!isOpen && currentUserProfile) return null;

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!auth) {
        throw new Error('Firebase Auth is not available.');
      }
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user || !user.email) {
        throw new Error('Google Sign-In failed to retrieve email.');
      }

      const userEmail = user.email.toLowerCase().trim();
      const userDocId = sanitizeDocId(userEmail);

      // Check if user is already registered in Firestore
      let userDocSnap = null;
      if (db) {
        const docRef = doc(db, 'ca_registered_users', userDocId);
        userDocSnap = await getDoc(docRef);
      }

      if (userDocSnap && userDocSnap.exists()) {
        const existingData = userDocSnap.data() as UserProfile;
        setSuccessMessage(`Welcome back, ${existingData.fullName}!`);
        setTimeout(() => {
          onRegisterSuccess(existingData);
        }, 600);
      } else {
        // Pre-fill form from Google account info for new registration
        const nameParts = (user.displayName || '').trim().split(' ');
        const gFirst = nameParts[0] || '';
        const gLast = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        setFirstName(gFirst);
        setLastName(gLast);
        setEmail(userEmail);
        if (user.photoURL) setGooglePhotoURL(user.photoURL);

        setMode('register');
        setSuccessMessage('Google account authenticated! Please confirm your preparing group to complete registration.');
      }
    } catch (err: any) {
      console.warn('Google auth error:', err);
      // Fallback message for iframe or popup restriction or unauthorized domain
      if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setErrorMessage(
          `Google Sign-In needs domain authorization for (${currentDomain}). You can register directly with your name and email below, or whitelist this domain in Firebase Console!`
        );
      } else if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        setErrorMessage('Google Sign-In popup was blocked or closed. Please enter your details below.');
      } else {
        setErrorMessage(err.message || 'Failed to authenticate with Google. You can register manually below.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Form Submission for New Registration
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedFirst = firstName.trim();
    const trimmedMiddle = middleName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.toLowerCase().trim();

    if (!trimmedFirst) {
      setErrorMessage('Please enter your First Name.');
      return;
    }
    if (!trimmedLast) {
      setErrorMessage('Please enter your Last Name.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid Email ID.');
      return;
    }
    if (groupPreparingFor === 'Not Selected') {
      setErrorMessage('Please select the Group you are preparing for.');
      return;
    }

    // Construct full name
    const fullName = `${trimmedFirst} ${trimmedMiddle ? trimmedMiddle + ' ' : ''}${trimmedLast}`.trim();
    const userDocId = sanitizeDocId(trimmedEmail);

    const newUserProfile: UserProfile = {
      email: trimmedEmail,
      firstName: trimmedFirst,
      middleName: trimmedMiddle || undefined,
      lastName: trimmedLast,
      fullName: fullName.toUpperCase(),
      groupPreparingFor: groupPreparingFor,
      registeredAt: new Date().toISOString(),
      photoURL: googlePhotoURL,
    };

    setIsLoading(true);

    try {
      // Save user profile in Firestore
      if (db) {
        const userRef = doc(db, 'ca_registered_users', userDocId);
        await setDoc(userRef, newUserProfile, { merge: true });

        // Initialize progress record in Firestore if not present
        const progressRef = doc(db, 'progress', sanitizeDocId(fullName.toUpperCase()));
        const progressSnap = await getDoc(progressRef);
        if (!progressSnap.exists()) {
          await setDoc(progressRef, {
            studentName: fullName.toUpperCase(),
            groupFilter: groupPreparingFor,
            topicsData: {},
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      setSuccessMessage(`Registration successful! Welcome ${fullName.toUpperCase()}.`);
      setTimeout(() => {
        onRegisterSuccess(newUserProfile);
      }, 600);
    } catch (err: any) {
      console.error('Registration save error:', err);
      // Even if firestore fails, allow local registration
      onRegisterSuccess(newUserProfile);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Quick Email Login for existing registered user
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedLoginEmail = loginEmail.toLowerCase().trim();
    if (!trimmedLoginEmail || !trimmedLoginEmail.includes('@')) {
      setErrorMessage('Please enter a valid registered Email ID.');
      return;
    }

    setIsLoading(true);
    const userDocId = sanitizeDocId(trimmedLoginEmail);

    try {
      let foundProfile: UserProfile | null = null;

      // Check Firestore first
      if (db) {
        const userRef = doc(db, 'ca_registered_users', userDocId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          foundProfile = docSnap.data() as UserProfile;
        }
      }

      // Check localStorage fallback if offline
      if (!foundProfile) {
        const localSaved = localStorage.getItem(`ca_user_profile_${userDocId}`);
        if (localSaved) {
          try {
            foundProfile = JSON.parse(localSaved);
          } catch (e) {
            // ignore
          }
        }
      }

      if (foundProfile) {
        setSuccessMessage(`Welcome back, ${foundProfile.fullName}!`);
        setTimeout(() => {
          onRegisterSuccess(foundProfile!);
        }, 600);
      } else {
        setErrorMessage('No registered user found with this Email ID. Please register first.');
      }
    } catch (err: any) {
      setErrorMessage('Failed to sign in. Please check your internet connection or register again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-w-xl w-full my-8 relative flex flex-col">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7 text-indigo-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            CA Final Mentoring Portal
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-md mx-auto">
            {mode === 'register'
              ? 'Register your student profile to access your personal study checklist, track progress, and secure your data.'
              : 'Sign in with your registered email ID to resume your study schedule.'}
          </p>

          {/* Mode Switch Pills */}
          <div className="flex justify-center gap-2 mt-5 bg-indigo-950/80 p-1 rounded-2xl border border-indigo-800/60 w-fit mx-auto">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-indigo-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              New Student Register
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-indigo-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In (Registered)
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">


          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleSubmitRegistration} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* First Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-600" /> First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Middle Name (Optional) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Middle name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Email ID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" /> Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Preparing Group Selector */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> Preparing Group <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupPreparingFor('Both')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      groupPreparingFor === 'Both'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Both Groups
                  </button>

                  <button
                    type="button"
                    onClick={() => setGroupPreparingFor('First Group')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      groupPreparingFor === 'First Group'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    1st Group
                  </button>

                  <button
                    type="button"
                    onClick={() => setGroupPreparingFor('Second Group')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      groupPreparingFor === 'Second Group'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    2nd Group
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Registration...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Register Student & Enter Portal</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" /> Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter your registered email ID"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking Registration...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Student Account</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

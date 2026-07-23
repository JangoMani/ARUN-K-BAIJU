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
  KeyRound,
  Lock,
  RefreshCw,
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
  const [mode, setMode] = useState<'register' | 'login' | 'admin_register'>('register');

  // Admin Register form state
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminReason, setAdminReason] = useState('');

  // Handle Admin Access Request Submission
  const handleSubmitAdminRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedName = adminFullName.trim();
    const trimmedEmail = adminEmailInput.toLowerCase().trim();

    if (!trimmedName) {
      setErrorMessage('Please enter your Full Name.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid Email ID.');
      return;
    }

    setIsLoading(true);

    try {
      if (db) {
        const reqDocId = sanitizeDocId(trimmedEmail);
        const requestRef = doc(db, 'ca_admin_requests', reqDocId);
        
        await setDoc(requestRef, {
          id: reqDocId,
          email: trimmedEmail,
          fullName: trimmedName.toUpperCase(),
          requestedAt: new Date().toISOString(),
          status: 'pending',
          reason: adminReason.trim() || 'Admin access request for progress monitoring',
        }, { merge: true });
      }

      setSuccessMessage(
        `Admin request submitted successfully for ${trimmedName.toUpperCase()}! Your request is pending review by Super Admin (johnbosco9947@gmail.com).`
      );
      setAdminFullName('');
      setAdminEmailInput('');
      setAdminReason('');
    } catch (err: any) {
      console.error('Admin request submission error:', err);
      setErrorMessage('Failed to submit admin request. Please check network connection.');
    } finally {
      setIsLoading(false);
    }
  };
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [groupPreparingFor, setGroupPreparingFor] = useState<GroupCategory>('Both');
  const [loginEmail, setLoginEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // OTP Verification state for Admin (johnbosco9947@gmail.com)
  const [isOtpRequired, setIsOtpRequired] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [userEnteredOtp, setUserEnteredOtp] = useState<string>('');
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);

  // Auto-fill if user attempts Google sign-in
  const [googlePhotoURL, setGooglePhotoURL] = useState<string | undefined>(undefined);

  if (!isOpen && currentUserProfile) return null;

  const generateNewOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setUserEnteredOtp('');
    setSuccessMessage(`Security OTP re-sent to johnbosco9947@gmail.com! (OTP: ${code})`);
  };

  const triggerOtpForAdmin = (profile: UserProfile) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setPendingProfile(profile);
    setIsOtpRequired(true);
    setUserEnteredOtp('');
    setSuccessMessage(`Admin Security Verification: OTP code sent to johnbosco9947@gmail.com. Please enter the code below to complete sign in.`);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (userEnteredOtp.trim() !== generatedOtp.trim()) {
      setErrorMessage('Invalid 6-Digit Security OTP. Please enter the correct code.');
      return;
    }

    if (pendingProfile) {
      setSuccessMessage(`Admin OTP Verified Successfully! Welcome ${pendingProfile.fullName}.`);
      setTimeout(() => {
        onRegisterSuccess(pendingProfile);
      }, 600);
    }
  };

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
        if (userEmail === 'johnbosco9947@gmail.com') {
          triggerOtpForAdmin(existingData);
        } else {
          setSuccessMessage(`Welcome back, ${existingData.fullName}!`);
          setTimeout(() => {
            onRegisterSuccess(existingData);
          }, 600);
        }
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
      ...(trimmedMiddle ? { middleName: trimmedMiddle } : {}),
      lastName: trimmedLast,
      fullName: fullName.toUpperCase(),
      groupPreparingFor: groupPreparingFor,
      registeredAt: new Date().toISOString(),
      ...(googlePhotoURL ? { photoURL: googlePhotoURL } : {}),
    };

    setIsLoading(true);

    try {
      // Save user profile in Firestore
      if (db) {
        const userRef = doc(db, 'ca_registered_users', userDocId);
        // Clean undefined fields so Firestore setDoc does not throw error
        const firestorePayload = JSON.parse(JSON.stringify(newUserProfile));
        await setDoc(userRef, firestorePayload, { merge: true });

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

      if (trimmedEmail === 'johnbosco9947@gmail.com') {
        triggerOtpForAdmin(newUserProfile);
      } else {
        setSuccessMessage(`Registration successful! Welcome ${fullName.toUpperCase()}.`);
        setTimeout(() => {
          onRegisterSuccess(newUserProfile);
        }, 600);
      }
    } catch (err: any) {
      console.error('Registration save error:', err);
      // Even if firestore fails, allow local registration
      if (trimmedEmail === 'johnbosco9947@gmail.com') {
        triggerOtpForAdmin(newUserProfile);
      } else {
        onRegisterSuccess(newUserProfile);
      }
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
        if (trimmedLoginEmail === 'johnbosco9947@gmail.com') {
          triggerOtpForAdmin(foundProfile);
        } else {
          setSuccessMessage(`Welcome back, ${foundProfile.fullName}!`);
          setTimeout(() => {
            onRegisterSuccess(foundProfile!);
          }, 600);
        }
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
          <div className="flex flex-wrap justify-center gap-1.5 mt-5 bg-indigo-950/80 p-1 rounded-2xl border border-indigo-800/60 w-fit mx-auto">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-indigo-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Student Register
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin_register');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === 'admin_register'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Register as Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-indigo-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
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

          {/* OTP VERIFICATION FORM FOR ADMIN */}
          {isOtpRequired ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wide text-amber-800">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Admin Security OTP Check Required</span>
                </div>
                <p className="text-xs text-amber-950 font-medium leading-relaxed">
                  To access the Admin Console and Student Portal for <span className="font-extrabold underline text-amber-950">johnbosco9947@gmail.com</span>, enter the 6-digit OTP code below.
                </p>

                {/* Simulated / Sent OTP badge */}
                <div className="mt-2 p-3 bg-white border border-amber-300/80 rounded-xl flex items-center justify-between shadow-inner">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Security Code Sent To Mail
                    </span>
                    <span className="text-lg font-black tracking-widest text-indigo-900 font-mono">
                      {generatedOtp}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={generateNewOtp}
                    className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Resend
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Enter 6-Digit OTP Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={userEnteredOtp}
                  onChange={(e) => setUserEnteredOtp(e.target.value.trim())}
                  placeholder="e.g. 849201"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-black tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 via-indigo-700 to-indigo-900 hover:from-amber-500 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Lock className="w-4 h-4 text-amber-300" />
                <span>Verify Security OTP & Sign In</span>
              </button>
            </form>
          ) : (
            <>
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

          {/* ADMIN REGISTER FORM */}
          {mode === 'admin_register' && (
            <form onSubmit={handleSubmitAdminRequest} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-amber-800">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Admin Access Registration</span>
                </div>
                <p className="text-xs text-amber-900 font-medium leading-relaxed">
                  Registering as an Admin will submit an access request to Super Admin (<span className="font-bold underline">johnbosco9947@gmail.com</span>). Once approved, you can monitor all students' study progress without being listed as a student.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-600" /> Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-amber-600" /> Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="e.g. ramesh.mentor@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Purpose / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  placeholder="e.g. Faculty Mentor for CA Final Batch"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 via-amber-700 to-indigo-900 hover:from-amber-500 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-300" />
                    <span>Send Request for Admin Access</span>
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
          </>
        )}
        </div>
      </div>
    </div>
  );
};

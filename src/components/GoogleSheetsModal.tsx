import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  createOrUpdateSyllabusSpreadsheet,
  downloadSyllabusCSV
} from '../services/googleAuthAndSheets';
import { TopicProgressState, GroupCategory } from '../types';
import {
  FileSpreadsheet,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  RefreshCw,
  Download,
  ShieldCheck,
  Table,
  Copy,
  Check
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudent: string;
  currentTopicsData: Record<string, TopicProgressState>;
  currentGroupFilter: GroupCategory;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentStudent,
  currentTopicsData,
  currentGroupFilter
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnauthorizedDomainErr, setIsUnauthorizedDomainErr] = useState<boolean>(false);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);

  const [successResult, setSuccessResult] = useState<{
    spreadsheetId: string;
    spreadsheetUrl: string;
  } | null>(null);

  const [existingSheetId, setExistingSheetId] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  useEffect(() => {
    if (!isOpen) return;

    setIsAuthLoading(true);
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setIsAuthLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setErrorMsg(null);
    setIsUnauthorizedDomainErr(false);
    setIsAuthLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      const msg = err?.message || err?.code || String(err);
      if (msg.includes('auth/unauthorized-domain') || err?.code === 'auth/unauthorized-domain') {
        setIsUnauthorizedDomainErr(true);
        setErrorMsg('Firebase Authentication requires adding this app domain to your Authorized Domains list.');
      } else {
        setErrorMsg(msg || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const copyDomainToClipboard = () => {
    if (currentHostname) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleLogout();
      setUser(null);
      setAccessToken(null);
      setSuccessResult(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error signing out');
    }
  };

  const initiateExport = () => {
    if (!currentStudent || !currentStudent.trim()) {
      alert('Please enter or select a student name before exporting.');
      return;
    }
    setErrorMsg(null);
    setShowConfirmModal(true);
  };

  const confirmAndExecuteExport = async () => {
    setShowConfirmModal(false);
    if (!accessToken) {
      setErrorMsg('Google OAuth session token missing. Please sign in again.');
      return;
    }

    setIsExporting(true);
    setErrorMsg(null);

    try {
      const result = await createOrUpdateSyllabusSpreadsheet(
        currentStudent,
        currentTopicsData,
        currentGroupFilter,
        accessToken,
        existingSheetId.trim() || undefined
      );

      setSuccessResult(result);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMsg(err?.message || 'Failed to export syllabus data to Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Google Sheets Integration</h2>
              <p className="text-xs text-emerald-100">Export & sync CA Final syllabus with Google Sheets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-emerald-100 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">

          {/* Student Banner */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Active Student</span>
              <p className="text-sm font-bold text-slate-800">{currentStudent || 'No Student Selected'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Group Filter</span>
              <p className="text-xs font-semibold text-emerald-700">{currentGroupFilter}</p>
            </div>
          </div>

          {/* Auth State Box */}
          {isAuthLoading ? (
            <div className="py-8 text-center flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
              <p className="text-xs font-medium">Connecting to Google Auth...</p>
            </div>
          ) : !user ? (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Connect Google Account</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Authorize access to Google Sheets & Drive to sync CA Final student syllabus progress seamlessly.
                </p>
              </div>

              {/* Official Google Sign in Button */}
              <button
                onClick={handleSignIn}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm py-2.5 px-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-center gap-3 transition cursor-pointer hover:border-slate-400 active:scale-[0.99]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="pt-2 border-t border-emerald-200/60">
                <button
                  onClick={() => downloadSyllabusCSV(currentStudent, currentTopicsData, currentGroupFilter)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs py-2 px-3 rounded-lg border border-slate-300 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download CSV File (Opens in Google Sheets / Excel)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Account Card */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-9 h-9 rounded-full border border-emerald-300" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                      {user.displayName?.[0] || user.email?.[0] || 'G'}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-800">{user.displayName || 'Google User'}</p>
                    <p className="text-[11px] text-slate-500">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="text-xs text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white transition"
                  title="Sign Out Google Account"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>

              {/* Spreadsheet Target Choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Table className="w-3.5 h-3.5 text-emerald-600" /> Existing Spreadsheet ID (Optional):
                </label>
                <input
                  type="text"
                  value={existingSheetId}
                  onChange={(e) => setExistingSheetId(e.target.value)}
                  placeholder="Leave empty to create a NEW spreadsheet in Google Drive"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500">
                  If left blank, a new spreadsheet named <span className="font-semibold text-slate-700">"CA Final Syllabus Progress - {currentStudent}"</span> will be created.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2">
                <button
                  onClick={initiateExport}
                  disabled={isExporting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Writing data to Google Sheets...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export Progress to Google Sheets</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* Error Banner / Domain Setup Guide */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>

              {isUnauthorizedDomainErr && (
                <div className="mt-2 bg-white p-3 rounded-lg border border-rose-200 space-y-2 text-slate-700">
                  <p className="font-bold text-slate-900 text-xs">How to fix this in Firebase Console:</p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                    <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">Firebase Console</a> and select your project <code className="bg-slate-100 px-1 py-0.5 font-mono text-emerald-800 rounded">mystical-surf-wt3g1</code>.</li>
                    <li>Navigate to <strong className="text-slate-800">Authentication</strong> &rarr; <strong className="text-slate-800">Settings</strong> &rarr; <strong className="text-slate-800">Authorized domains</strong>.</li>
                    <li>Click <strong className="text-slate-800">Add domain</strong> and paste your app's domain:</li>
                  </ol>

                  {/* Copy Domain Pill */}
                  <div className="flex items-center justify-between bg-slate-100 border border-slate-300 rounded-lg p-2 font-mono text-[11px] text-slate-800">
                    <span className="truncate mr-2 font-bold">{currentHostname || 'ais-dev-znmzzppcpcnwvdxuhb324q-280569625382.asia-east1.run.app'}</span>
                    <button
                      onClick={copyDomainToClipboard}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 shrink-0 transition"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-200" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Domain</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">After adding the domain, click <strong>Sign in with Google</strong> again.</p>
                </div>
              )}
            </div>
          )}

          {/* Success Banner with link to Spreadsheet */}
          {successResult && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Successfully exported syllabus progress to Google Sheets!</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Spreadsheet ID: <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-[10px]">{successResult.spreadsheetId}</code>
              </p>
              <a
                href={successResult.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                <span>Open in Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>Protected with Google OAuth 2.0</span>
          <button
            onClick={onClose}
            className="font-semibold text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>

      </div>

      {/* Confirmation Modal for Destructive/Mutating Operations */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Confirm Google Sheets Write</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to export syllabus progress for <strong className="text-slate-800">{currentStudent}</strong> to Google Sheets using your connected Google account.
              {existingSheetId ? (
                <> This will overwrite content in spreadsheet <code className="bg-slate-100 px-1 py-0.5 font-mono text-[10px]">{existingSheetId}</code>.</>
              ) : (
                <> A new spreadsheet will be created in your Google Drive.</>
              )}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndExecuteExport}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Confirm & Export</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

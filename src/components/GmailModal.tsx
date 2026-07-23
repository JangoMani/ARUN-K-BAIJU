import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getGmailProfile,
  sendGmailProgressEmail
} from '../services/googleAuthAndSheets';
import { TOPICS_DATA } from '../data/studentsAndTopics';
import { TopicProgressState, GroupCategory, PaperName } from '../types';
import {
  Mail,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  ShieldCheck,
  Copy,
  Check,
  Calendar,
  Clock,
  Sparkles,
  FileText,
  UserCheck
} from 'lucide-react';

interface GmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudent: string;
  currentTopicsData: Record<string, TopicProgressState>;
  currentGroupFilter: GroupCategory;
}

type TemplateType = 'comprehensive' | 'exam_countdown' | 'overdue' | 'todays_covered' | 'custom';

export const GmailModal: React.FC<GmailModalProps> = ({
  isOpen,
  onClose,
  currentStudent,
  currentTopicsData,
  currentGroupFilter
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [gmailAddress, setGmailAddress] = useState<string>('');
  
  const [recipient, setRecipient] = useState<string>('FinalToCA@outlook.com');
  const [templateType, setTemplateType] = useState<TemplateType>('todays_covered');
  const [subject, setSubject] = useState<string>('');
  const [bodyText, setBodyText] = useState<string>('');

  const [quickCoveredText, setQuickCoveredText] = useState<string>('');

  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnauthorizedDomainErr, setIsUnauthorizedDomainErr] = useState<boolean>(false);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);

  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [sentLog, setSentLog] = useState<Array<{ id: string; recipient: string; subject: string; time: string }>>([]);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // Calculate student stats & today's covered topics
  function getPaperGroup(paper: PaperName): 'First Group' | 'Second Group' {
    return ['Paper 1', 'Paper 2', 'Paper 3'].includes(paper) ? 'First Group' : 'Second Group';
  }

  const filteredTopics = TOPICS_DATA.filter((topic) => {
    const group = getPaperGroup(topic.paper);
    if (currentGroupFilter === 'First Group') return group === 'First Group';
    if (currentGroupFilter === 'Second Group') return group === 'Second Group';
    return true;
  });

  const totalTopics = filteredTopics.length;
  let completedCount = 0;
  let totalRevisions = 0;
  const overdueTopics: string[] = [];
  const todaysCoveredTopicsList: string[] = [];
  const allCompletedTopicsList: string[] = [];

  const todayStr = new Date().toISOString().split('T')[0];

  filteredTopics.forEach((t) => {
    const st = currentTopicsData[t.topicName] || { completed: false, schDate: '', covDate: '', evaluated: false, revisions: 0 };
    if (st.completed) completedCount++;
    totalRevisions += st.revisions || 0;

    if (st.covDate === todayStr || (st.completed && st.covDate === todayStr)) {
      todaysCoveredTopicsList.push(t.topicName);
    }
    if (st.completed) {
      allCompletedTopicsList.push(t.topicName);
    }

    if (!st.completed && st.schDate && st.schDate <= todayStr) {
      overdueTopics.push(t.topicName);
    }
  });

  const todaysCoveredCommas = todaysCoveredTopicsList.length > 0
    ? todaysCoveredTopicsList.join(', ')
    : (allCompletedTopicsList.length > 0 ? allCompletedTopicsList.join(', ') : '');

  const progressPercent = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

  // Initialize & update quickCoveredText when topics data changes
  useEffect(() => {
    setQuickCoveredText(todaysCoveredCommas);
  }, [todaysCoveredCommas, currentStudent]);

  // Retrieve exam date from localStorage
  const examDateStr = localStorage.getItem(`ca_exam_date_${currentStudent}`) || localStorage.getItem('ca_exam_date') || '';
  let daysLeft: number | null = null;
  if (examDateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(examDateStr);
    target.setHours(0,0,0,0);
    if (!isNaN(target.getTime())) {
      daysLeft = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Auth Initialization
  useEffect(() => {
    if (!isOpen) return;

    setIsAuthLoading(true);
    const unsubscribe = initAuth(
      async (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        if (currentUser.email && !recipient) {
          setRecipient(currentUser.email);
        }
        try {
          const profile = await getGmailProfile(token);
          setGmailAddress(profile.emailAddress);
        } catch (e) {
          setGmailAddress(currentUser.email || '');
        }
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

  // Generate Template Text whenever template or stats change
  useEffect(() => {
    if (!currentStudent) return;

    if (templateType === 'comprehensive') {
      setSubject(`[CA Final Update] ${currentStudent} - Progress Report (${progressPercent}% Completed)`);
      setBodyText(
        `Dear Mentor / Parent,\n\nHere is the latest CA Final syllabus progress update for student: ${currentStudent}\n\n` +
        `• Group Category: ${currentGroupFilter}\n` +
        `• Overall Syllabus Progress: ${progressPercent}% (${completedCount} of ${totalTopics} topics completed)\n` +
        `• Total Topic Revisions Logged: ${totalRevisions}x\n` +
        (examDateStr ? `• Continuous Exam Target Date: ${examDateStr} (${daysLeft !== null ? daysLeft + ' days remaining' : ''})\n` : '') +
        `• Overdue Topics Count: ${overdueTopics.length}\n\n` +
        `Keep up the consistent practice and hard work!\n\nSent via CA Final Syllabus Tracker App`
      );
    } else if (templateType === 'exam_countdown') {
      setSubject(`[CA Final Countdown] ${currentStudent} - ${daysLeft !== null ? daysLeft + ' Days Remaining' : 'Exam Schedule Update'}`);
      setBodyText(
        `Hello,\n\nThis is an automated study alert for CA Final aspirant: ${currentStudent}\n\n` +
        `📅 Continuous Exam Date: ${examDateStr || 'Not Set'}\n` +
        `⏳ Days Remaining: ${daysLeft !== null ? daysLeft + ' Days' : 'N/A'}\n` +
        `📊 Current Completion: ${completedCount}/${totalTopics} Topics (${progressPercent}%)\n\n` +
        `Focus areas for upcoming sessions:\n` +
        (overdueTopics.length > 0 ? overdueTopics.slice(0, 5).map((t, idx) => ` ${idx + 1}. ${t}`).join('\n') : ' All scheduled topics up to date!') +
        `\n\nBest regards,\n${currentStudent}`
      );
    } else if (templateType === 'overdue') {
      setSubject(`[Action Required] Overdue Study Topics Alert - ${currentStudent}`);
      setBodyText(
        `Hi,\n\nAttention needed for overdue topics in CA Final preparation for ${currentStudent}:\n\n` +
        `Pending Scheduled Topics (${overdueTopics.length}):\n` +
        (overdueTopics.length > 0 ? overdueTopics.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'No overdue topics currently!') +
        `\n\nOverall Progress: ${completedCount}/${totalTopics} topics completed (${progressPercent}%).\n\nLet's clear these pending chapters today!`
      );
    } else if (templateType === 'todays_covered') {
      setRecipient('FinalToCA@outlook.com');
      setSubject(`EVALUATION TOPICS`);
      setBodyText(todaysCoveredCommas || 'No topics covered today yet.');
    } else if (templateType === 'custom') {
      setSubject(`[CA Final Update] Note for ${currentStudent}`);
      setBodyText(`Hi,\n\nWriting regarding ${currentStudent}'s CA Final preparation:\n\n[Add your message here]\n\nProgress Summary: ${completedCount}/${totalTopics} topics completed (${progressPercent}%).\n\nThanks!`);
    }
  }, [templateType, currentStudent, currentGroupFilter, completedCount, totalTopics, progressPercent, totalRevisions, examDateStr, daysLeft, todaysCoveredCommas]);

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
        if (res.user.email) {
          setRecipient(res.user.email);
        }
        try {
          const profile = await getGmailProfile(res.accessToken);
          setGmailAddress(profile.emailAddress);
        } catch (e) {
          setGmailAddress(res.user.email || '');
        }
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
      setGmailAddress('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error signing out');
    }
  };

  const handleSendTodayCoveredToOutlook = async () => {
    if (!user || !accessToken) {
      alert('Please sign in with Google first to send via Gmail.');
      return;
    }
    if (!quickCoveredText.trim()) {
      alert('Please enter or verify at least one covered topic name.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    try {
      const result = await sendGmailProgressEmail({
        recipientEmail: 'FinalToCA@outlook.com',
        subject: `EVALUATION TOPICS`,
        bodyText: quickCoveredText.trim(),
        accessToken
      });

      setSentLog((prev) => [
        {
          id: result.id,
          recipient: 'FinalToCA@outlook.com',
          subject: `EVALUATION TOPICS`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);

      alert(`Today's covered topics sent successfully to FinalToCA@outlook.com!`);
    } catch (err: any) {
      console.error('Send error:', err);
      setErrorMsg(err?.message || 'Failed to send email to FinalToCA@outlook.com');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenGmailWebDraft = () => {
    const targetRecipient = 'FinalToCA@outlook.com';
    const targetSubject = `EVALUATION TOPICS`;
    const targetBody = quickCoveredText.trim() || bodyText.trim() || 'No topics covered today yet.';
    const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetRecipient)}&su=${encodeURIComponent(targetSubject)}&body=${encodeURIComponent(targetBody)}`;
    window.open(webUrl, '_blank');
  };

  const initiateSend = () => {
    if (!recipient || !recipient.trim()) {
      alert('Please enter a recipient email address.');
      return;
    }
    if (!subject.trim() || !bodyText.trim()) {
      alert('Subject and body message cannot be empty.');
      return;
    }
    setErrorMsg(null);
    setShowConfirmModal(true);
  };

  const confirmAndSendEmail = async () => {
    setShowConfirmModal(false);
    if (!accessToken) {
      setErrorMsg('Google OAuth session token missing. Please sign in again.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    try {
      const result = await sendGmailProgressEmail({
        recipientEmail: recipient.trim(),
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        accessToken
      });

      setSentLog((prev) => [
        {
          id: result.id,
          recipient: recipient.trim(),
          subject: subject.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);

      alert(`Email sent successfully to ${recipient.trim()}!`);
    } catch (err: any) {
      console.error('Send Gmail error:', err);
      setErrorMsg(err?.message || 'Failed to send email via Gmail API.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-700 via-red-600 to-rose-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur border border-white/20">
              <Mail className="w-6 h-6 text-rose-100" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Gmail Integration</h2>
              <p className="text-xs text-rose-100">Send CA Final study updates & progress reports via Gmail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-rose-100 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">

          {/* Student Banner */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-rose-600" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Active Student</span>
                <p className="text-sm font-bold text-slate-800">{currentStudent || 'No Student Selected'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Progress</span>
              <p className="text-xs font-black text-rose-700">{progressPercent}% ({completedCount}/{totalTopics})</p>
            </div>
          </div>

          {/* Auth State Box */}
          {isAuthLoading ? (
            <div className="py-8 text-center flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-rose-600 mb-2" />
              <p className="text-xs font-medium">Connecting to Google Auth...</p>
            </div>
          ) : !user ? (
            <div className="space-y-4">
              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-5 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sign in with Google for Gmail API Access</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Connect your Google account to send study updates directly from your Gmail account via API.
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
              </div>

              {/* Direct Instant Draft Option (No Auth Required) */}
              <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-indigo-900 rounded-xl p-4 text-white shadow-lg border border-rose-700/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded tracking-wide uppercase">
                      ⚡ Instant Mail Draft
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white">Send Today's Covered Topics</h3>
                  </div>
                  <span className="text-[10px] bg-rose-950/80 text-rose-200 px-2 py-0.5 rounded font-mono border border-rose-500/30">
                    To: FinalToCA@outlook.com
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-rose-100 font-semibold flex items-center justify-between">
                    <span>Today's Covered Topics (Comma-Separated):</span>
                    <span className="text-[10px] text-amber-300 font-normal">Topic names required</span>
                  </label>
                  <textarea
                    rows={3}
                    value={quickCoveredText}
                    onChange={(e) => setQuickCoveredText(e.target.value)}
                    placeholder="Enter topic names separated by commas (e.g. Financial Instruments, Leases, Professional Ethics)"
                    className="w-full text-xs p-2.5 bg-white text-slate-900 rounded-lg border border-rose-300 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-[10px] text-rose-200">
                    Auto-formats email to <span className="font-mono text-amber-200">FinalToCA@outlook.com</span>
                  </p>
                  <button
                    onClick={handleOpenGmailWebDraft}
                    className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Open Pre-filled Draft in Gmail</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Account Pill */}
              <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-xs">
                    {user.displayName?.[0] || gmailAddress[0] || 'G'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{user.displayName || 'Google Account'}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{gmailAddress || user.email}</p>
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

              {/* Template Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" /> Choose Email Template:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setTemplateType('comprehensive')}
                    className={`p-2 rounded-lg border text-left font-medium transition cursor-pointer ${
                      templateType === 'comprehensive'
                        ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    📊 Comprehensive Progress
                  </button>
                  <button
                    onClick={() => setTemplateType('exam_countdown')}
                    className={`p-2 rounded-lg border text-left font-medium transition cursor-pointer ${
                      templateType === 'exam_countdown'
                        ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ⏳ Exam Countdown Alert
                  </button>
                  <button
                    onClick={() => setTemplateType('overdue')}
                    className={`p-2 rounded-lg border text-left font-medium transition cursor-pointer ${
                      templateType === 'overdue'
                        ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ⚠️ Overdue Topics
                  </button>
                  <button
                    onClick={() => setTemplateType('todays_covered')}
                    className={`p-2 rounded-lg border text-left font-medium transition cursor-pointer ${
                      templateType === 'todays_covered'
                        ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✅ Today's Covered Topics
                  </button>
                  <button
                    onClick={() => setTemplateType('custom')}
                    className={`p-2 rounded-lg border text-left font-medium transition cursor-pointer ${
                      templateType === 'custom'
                        ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✏️ Custom Message
                  </button>
                </div>
              </div>

              {/* Recipient Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Recipient Email:</label>
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. mentor@example.com or parent@example.com"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              {/* Subject Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Subject Line:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                />
              </div>

              {/* Body Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Message Content:</label>
                <textarea
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-slate-800 leading-relaxed"
                />
              </div>

              {/* Send Button */}
              <div className="pt-1">
                <button
                  onClick={initiateSend}
                  disabled={isSending}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Email via Gmail API...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Email Report</span>
                    </>
                  )}
                </button>
              </div>

              {/* AT THE END: Dedicated Quick Send Section for Today's Covered Topics */}
              <div className="mt-6 border-t-2 border-dashed border-rose-200 pt-5 space-y-3">
                <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-indigo-900 rounded-xl p-4 text-white shadow-lg border border-rose-700/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded tracking-wide uppercase">
                        ⚡ Direct Send
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-white">Send Today's Covered Topics</h3>
                    </div>
                    <span className="text-[10px] bg-rose-950/80 text-rose-200 px-2 py-0.5 rounded font-mono border border-rose-500/30">
                      To: FinalToCA@outlook.com
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-rose-100 font-semibold flex items-center justify-between">
                      <span>Today's Covered Topics (Comma-Separated Names):</span>
                      <span className="text-[10px] text-amber-300 font-normal">Just topic names required</span>
                    </label>
                    <textarea
                      rows={3}
                      value={quickCoveredText}
                      onChange={(e) => setQuickCoveredText(e.target.value)}
                      placeholder="Enter topic names separated by commas (e.g. Financial Instruments, Leases, Professional Ethics)"
                      className="w-full text-xs p-2.5 bg-white text-slate-900 rounded-lg border border-rose-300 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-[10px] text-rose-200">
                      Sends from: <span className="font-mono text-amber-200">{gmailAddress || user?.email || 'Your Gmail'}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleOpenGmailWebDraft}
                        className="flex-1 sm:flex-initial bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-lg border border-white/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Open pre-filled draft in Gmail web app"
                      >
                        <Mail className="w-3.5 h-3.5 text-amber-300" />
                        <span>Draft in Gmail Web</span>
                      </button>

                      <button
                        onClick={handleSendTodayCoveredToOutlook}
                        disabled={isSending || !user}
                        className="flex-1 sm:flex-initial bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-lg shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send to FinalToCA@outlook.com</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>

              {isUnauthorizedDomainErr && (
                <div className="mt-2 bg-white p-3 rounded-lg border border-rose-200 space-y-2 text-slate-700">
                  <p className="font-bold text-slate-900 text-xs">How to fix in Firebase Console:</p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                    <li>Go to Firebase Console project <code className="bg-slate-100 px-1 py-0.5 font-mono text-rose-800 rounded">mystical-surf-wt3g1</code>.</li>
                    <li>Go to <strong>Authentication</strong> &rarr; <strong>Settings</strong> &rarr; <strong>Authorized domains</strong>.</li>
                    <li>Add this domain:</li>
                  </ol>

                  <div className="flex items-center justify-between bg-slate-100 border border-slate-300 rounded-lg p-2 font-mono text-[11px] text-slate-800">
                    <span className="truncate mr-2 font-bold">{currentHostname || 'ais-dev-znmzzppcpcnwvdxuhb324q-280569625382.asia-east1.run.app'}</span>
                    <button
                      onClick={copyDomainToClipboard}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-sans text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 shrink-0 transition cursor-pointer"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sent History Log */}
          {sentLog.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sent Email Log ({sentLog.length})
              </h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {sentLog.map((item) => (
                  <div key={item.id} className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center justify-between">
                    <div className="truncate mr-2">
                      <span className="font-bold text-slate-800">{item.recipient}:</span> {item.subject}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>Protected with Google OAuth 2.0 (Gmail API)</span>
          <button
            onClick={onClose}
            className="font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>

      {/* Mandatory User Confirmation Modal for Email Sending */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Confirm Sending Email via Gmail</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to send an email report for student <strong className="text-slate-800">{currentStudent}</strong> using your Gmail account (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">{gmailAddress || user?.email}</code>).
            </p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <p><strong>To:</strong> {recipient}</p>
              <p><strong>Subject:</strong> {subject}</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSendEmail}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm & Send Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { GroupCategory, StudentProgressRecord, TopicProgressState, UserProfile } from '../types';
import { STUDENTS_LIST } from '../data/studentsAndTopics';
import { downloadSyllabusCSV, downloadAllStudentsMasterCSV } from '../services/googleAuthAndSheets';
import { Play, Pause, RotateCcw, Timer, UserCheck, Layers, AlertCircle, Sparkles, Save, Loader2, Check, FileSpreadsheet, Calendar, Clock, Mail, MessageSquare, FolderOpen, LogOut, ShieldCheck, Crown } from 'lucide-react';

interface HeaderProps {
  currentStudent: string;
  onStudentChange: (student: string) => void;
  currentGroupFilter: GroupCategory;
  onGroupFilterChange: (group: GroupCategory) => void;
  onSaveToFirebase: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedTime: string | null;
  onOpenCodeReview?: () => void;
  onSendMailForEvaluation: () => void;
  onOpenDoubtChat: () => void;
  unreadDoubtCount?: number;
  onOpenStudyResources: () => void;
  unseenResourceCount?: number;
  currentTopicsData?: Record<string, TopicProgressState>;
  studentStoreCache?: Record<string, StudentProgressRecord>;
  currentUserProfile?: UserProfile | null;
  onSignOut?: () => void;
  onOpenAdminConsole?: () => void;
  registeredStudents?: string[];
}

export const Header: React.FC<HeaderProps> = ({
  currentStudent,
  onStudentChange,
  currentGroupFilter,
  onGroupFilterChange,
  onSaveToFirebase,
  isSaving,
  hasUnsavedChanges,
  lastSavedTime,
  onOpenCodeReview,
  onSendMailForEvaluation,
  onOpenDoubtChat,
  unreadDoubtCount = 0,
  onOpenStudyResources,
  unseenResourceCount = 0,
  currentTopicsData = {},
  studentStoreCache = {},
  currentUserProfile,
  onSignOut,
  onOpenAdminConsole,
  registeredStudents,
}) => {
  const isExcludedAdminStudentName = (name: string) => {
    if (!name) return false;
    const upper = name.toUpperCase().trim();
    return (
      upper.includes('MANIKUTTAN') ||
      upper.includes('ADMIN') ||
      upper.includes('SUPERADMIN') ||
      upper.includes('JOHNBOSCO')
    );
  };

  const studentOptions = Array.from(
    new Set([
      ...(registeredStudents || []),
    ].filter(Boolean))
  ).filter((name) => {
    if (isExcludedAdminStudentName(name)) {
      if (
        currentUserProfile?.fullName?.toUpperCase().trim() === name.toUpperCase().trim() &&
        currentUserProfile.role === 'student'
      ) {
        return true;
      }
      return false;
    }
    return true;
  });

  // Check if current logged-in user profile is Admin (johnbosco9947@gmail.com, Manikuttan, or role === 'admin' / 'superadmin')
  const isAdminUser = (userProfile?: UserProfile | null) => {
    if (!userProfile) return false;
    const email = (userProfile.email || '').toLowerCase().trim();
    const role = (userProfile.role || '').toLowerCase().trim();
    const name = (userProfile.fullName || '').toLowerCase().trim();

    return (
      email === 'johnbosco9947@gmail.com' ||
      role === 'admin' ||
      role === 'superadmin' ||
      name.includes('manikuttan') ||
      name.includes('admin')
    );
  };

  const isStudentGroupLocked = !!currentUserProfile && !isAdminUser(currentUserProfile);

  // Check if current selected student is Sumayya or Arun K Baiju for Excel Export
  const isAuthorizedExcelUser = (studentName: string) => {
    if (!studentName) return false;
    const upper = studentName.toUpperCase().trim();
    return upper.includes('SUMAYYA') || upper.includes('ARUN');
  };

  const showExcelButton = isAuthorizedExcelUser(currentStudent);

  // Exam Date state
  const [examDate, setExamDate] = useState<string>(() => {
    return localStorage.getItem(`ca_exam_date_${currentStudent}`) || localStorage.getItem('ca_exam_date') || '';
  });

  useEffect(() => {
    const saved = localStorage.getItem(`ca_exam_date_${currentStudent}`) || localStorage.getItem('ca_exam_date') || '';
    setExamDate(saved);
  }, [currentStudent]);

  const handleExamDateChange = (newDate: string) => {
    setExamDate(newDate);
    if (newDate) {
      localStorage.setItem(`ca_exam_date_${currentStudent}`, newDate);
      localStorage.setItem('ca_exam_date', newDate);
    } else {
      localStorage.removeItem(`ca_exam_date_${currentStudent}`);
    }
  };

  const calculateDaysLeft = (targetDateStr: string) => {
    if (!targetDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);

    if (isNaN(target.getTime())) return null;

    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysLeft = calculateDaysLeft(examDate);

  // Timer state with localStorage backing
  const [secondsElapsed, setSecondsElapsed] = useState<number>(() => {
    const saved = localStorage.getItem('ca_session_timer_sec');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => {
          const next = prev + 1;
          localStorage.setItem('ca_session_timer_sec', next.toString());
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setSecondsElapsed(0);
    localStorage.removeItem('ca_session_timer_sec');
  };

  return (
    <header className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-indigo-900 text-white shadow-lg sticky top-0 z-30">
      {/* Top Warning Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white py-1.5 px-4 text-center font-black text-xs sm:text-xs tracking-wider shadow-md flex items-center justify-center gap-2 border-b border-red-800 relative">
        {/* Top Left Corner Excel Button for Sumayya and Arun K Baiju */}
        {showExcelButton && (
          <button
            onClick={() => downloadAllStudentsMasterCSV(studentStoreCache)}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded flex items-center gap-1 shadow border border-emerald-300/80 transition active:scale-95 cursor-pointer z-20"
            title="Download Master Excel Report for All Students (.csv) - Available to Sumayya & Arun K Baiju"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
            <span>Excel</span>
          </button>
        )}

        <span className="animate-bounce">🧐</span>
        <span className="uppercase">YOU ARE UNDER SURVIVALLENCE OF ARUN AND SUMAYYA 🧐</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Title and Thought */}
        <div className="flex items-center gap-2.5 max-w-md">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Sparkles className="w-4 h-4 text-indigo-200" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">CA Final Syllabus Tracker</h1>
            <p className="text-indigo-100/90 text-xs italic font-normal leading-snug">
              &ldquo;Every morning you have two choices: continue to sleep with your dreams, or wake up and chase them.&rdquo;
            </p>
          </div>
        </div>

        {/* Top Controls Bar */}
        <div className="flex flex-wrap items-end gap-3 bg-indigo-900/70 backdrop-blur p-2.5 rounded-xl border border-indigo-600/50 shadow-inner w-full md:w-auto justify-between sm:justify-end">
          
          {/* 1. Student Name (At the beginning) */}
          <div className="flex flex-col flex-1 sm:flex-initial min-w-[200px]">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="studentSearchInput" className="text-[11px] text-indigo-200 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Registered Student:
              </label>
              {hasUnsavedChanges ? (
                <span className="text-[9px] text-amber-300 font-bold bg-amber-950/70 px-1.5 py-0.2 rounded border border-amber-500/40 animate-pulse">
                  Unsaved Edits
                </span>
              ) : lastSavedTime ? (
                <span className="text-[9px] text-emerald-300 font-medium flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" /> Saved {lastSavedTime}
                </span>
              ) : null}
            </div>

            {currentUserProfile && !isAdminUser(currentUserProfile) ? (
              <div className="bg-white/95 text-slate-900 text-xs sm:text-sm rounded-lg px-3 py-1.5 font-bold shadow-sm border border-emerald-300 flex items-center justify-between gap-2">
                <span className="truncate uppercase text-indigo-950 tracking-wide font-black">
                  {currentUserProfile.fullName || currentStudent}
                </span>
                <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded flex items-center gap-0.5 shrink-0">
                  <Check className="w-3 h-3 text-emerald-600" /> Active Student
                </span>
              </div>
            ) : (
              <div className="flex flex-col w-full">
                {isAdminUser(currentUserProfile) && (
                  <span className="text-[10px] font-extrabold text-amber-300 flex items-center gap-1 mb-0.5">
                    🛡️ Admin Mode &bull; Viewing Student:
                  </span>
                )}
                {studentOptions.length > 0 ? (
                  <select
                    id="studentSearchInput"
                    value={currentStudent}
                    onChange={(e) => onStudentChange(e.target.value)}
                    className="bg-white text-slate-900 text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full font-extrabold shadow-sm border border-slate-200 cursor-pointer uppercase tracking-wide text-indigo-950"
                  >
                    {!currentStudent && <option value="">Select Registered Student</option>}
                    {studentOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="studentSearchInput"
                    autoComplete="off"
                    value={currentStudent}
                    onChange={(e) => onStudentChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSaveToFirebase();
                      }
                    }}
                    placeholder="Enter registered student name"
                    className={`bg-white text-slate-900 text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full font-medium shadow-sm transition ${
                      !currentStudent || !currentStudent.trim()
                        ? 'border-2 border-amber-400 ring-2 ring-amber-400/50 bg-amber-50 placeholder:text-amber-800 animate-pulse font-bold'
                        : 'border border-slate-200 placeholder:text-slate-400'
                    }`}
                  />
                )}
              </div>
            )}
            <datalist id="studentDatalist">
              {studentOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {/* 2. Group Category (At the beginning) */}
          <div className="flex flex-col min-w-[140px]">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="groupCategorySelect" className="text-[11px] text-indigo-200 font-semibold flex items-center gap-1">
                <Layers className="w-3 h-3" /> Group:
              </label>
              {isStudentGroupLocked && (
                <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40" title="Selected during registration. Editable only by Admin.">
                  🔒 Locked
                </span>
              )}
            </div>
            <select
              id="groupCategorySelect"
              value={currentGroupFilter}
              onChange={(e) => onGroupFilterChange(e.target.value as GroupCategory)}
              disabled={isStudentGroupLocked}
              title={isStudentGroupLocked ? "Group was chosen during registration. Only Admin can modify it in the Admin Console." : "Select Group Category"}
              className={`text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:outline-none font-medium shadow-sm transition ${
                isStudentGroupLocked
                  ? 'bg-slate-200 text-slate-700 border border-slate-300 font-bold cursor-not-allowed opacity-90'
                  : 'bg-white text-slate-900 border border-slate-200 cursor-pointer focus:ring-2 focus:ring-indigo-400'
              }`}
            >
              <option value="Not Selected">Group Not Selected</option>
              <option value="Both">Both Groups</option>
              <option value="First Group">First Group</option>
              <option value="Second Group">Second Group</option>
            </select>
          </div>

          {/* 3. Continuous Exam Date Box */}
          <div className="flex flex-col min-w-[135px]">
            <label htmlFor="continuousExamDate" className="text-[11px] text-indigo-200 font-semibold mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-300" /> Continuous Exam:
            </label>
            <input
              id="continuousExamDate"
              type="date"
              value={examDate}
              onChange={(e) => handleExamDateChange(e.target.value)}
              className="bg-white text-slate-900 text-xs sm:text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium shadow-sm cursor-pointer"
            />
          </div>

          {/* 4. HIGH FOCUS Days Left Countdown Box */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-b from-amber-500/25 via-amber-500/15 to-indigo-950/90 px-4 py-1 rounded-xl border-2 border-amber-400/80 shadow-md shadow-amber-500/20 min-w-[110px] relative overflow-hidden group">
            <span className="text-[10px] text-amber-200 uppercase tracking-wider font-extrabold flex items-center gap-1 drop-shadow-xs">
              <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> Days Left
            </span>
            <div className="text-base sm:text-lg font-black tracking-tight text-amber-300 drop-shadow-sm">
              {daysLeft !== null ? (
                daysLeft > 0 ? (
                  <span className="flex items-baseline gap-0.5">
                    <span className="text-xl text-amber-200">{daysLeft}</span>
                    <span className="text-xs font-bold text-amber-300">{daysLeft === 1 ? 'Day' : 'Days'}</span>
                  </span>
                ) : daysLeft === 0 ? (
                  <span className="text-emerald-300 font-bold animate-bounce">Exam Today!</span>
                ) : (
                  <span className="text-rose-300 text-xs">{Math.abs(daysLeft)}d ago</span>
                )
              ) : (
                <span className="text-amber-200/60 font-semibold text-xs">Set Date</span>
              )}
            </div>
          </div>

          {/* 5. Session Timer Box */}
          <div className="flex flex-col items-center bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-500/40 min-w-[115px]">
            <span className="text-[9px] text-indigo-200 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Timer className="w-3 h-3 text-emerald-400" /> Focus Timer
            </span>
            <div className="text-xs font-mono font-bold tracking-widest text-emerald-400 my-0.5">
              {formatTimer(secondsElapsed)}
            </div>
            <div className="flex items-center gap-1">
              {!isTimerRunning ? (
                <button
                  onClick={handleStartTimer}
                  title="Start Timer"
                  className="p-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-[10px] flex items-center gap-0.5 px-1.5 font-medium"
                >
                  <Play className="w-2.5 h-2.5 fill-current" /> Start
                </button>
              ) : (
                <button
                  onClick={handlePauseTimer}
                  title="Pause Timer"
                  className="p-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-[10px] flex items-center gap-0.5 px-1.5 font-medium"
                >
                  <Pause className="w-2.5 h-2.5 fill-current" /> Pause
                </button>
              )}
              <button
                onClick={handleResetTimer}
                title="Reset Timer"
                className="p-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded transition text-[10px] flex items-center gap-0.5 px-1.5 font-medium"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reset
              </button>
            </div>
          </div>

          {/* 6. SAVE BUTTON */}
          <button
            onClick={onSaveToFirebase}
            disabled={isSaving}
            className={`px-3.5 py-2 rounded-lg font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shrink-0 shadow-md cursor-pointer border h-[38px] ${
              hasUnsavedChanges
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/40 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
            }`}
            title="Save current progress and student data to Firebase Cloud"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save</span>
              </>
            )}
          </button>

          {/* 7. DOUBT CLEARING CHAT BUTTON WITH UNREAD COUNTER BADGE */}
          <div className="relative inline-flex flex-col items-center">
            {unreadDoubtCount > 0 ? (
              <span className="absolute -top-3.5 right-0 bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-white animate-bounce flex items-center justify-center gap-1 z-10 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping"></span>
                <span>{unreadDoubtCount} {unreadDoubtCount === 1 ? 'Unread Doubt' : 'Unread Doubts'}</span>
              </span>
            ) : (
              <span className="absolute -top-3 right-1 bg-indigo-950/90 text-amber-300 font-bold text-[9px] px-1.5 py-0.2 rounded-full border border-amber-400/40 z-10">
                0 Unread
              </span>
            )}
            <button
              onClick={onOpenDoubtChat}
              className={`flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border border-amber-300 px-3.5 py-2 rounded-lg text-xs font-black transition shrink-0 cursor-pointer h-[38px] shadow-md hover:shadow-lg active:scale-95 ${
                unreadDoubtCount > 0 ? 'ring-2 ring-rose-500 ring-offset-1 ring-offset-indigo-900 animate-pulse' : ''
              }`}
              title={`Open Doubt Clearing Section (${unreadDoubtCount} unread doubts)`}
            >
              <MessageSquare className="w-4 h-4 text-slate-950" />
              <span>Ask Doubts</span>
            </button>
          </div>

          {/* 7.5 STUDY RESOURCES BUTTON WITH UNSEEN ATTACHMENT BADGE */}
          <div className="relative inline-flex flex-col items-center">
            {unseenResourceCount > 0 ? (
              <span className="absolute -top-3.5 right-0 bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-white animate-bounce flex items-center justify-center gap-1 z-10 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping"></span>
                <span>{unseenResourceCount} {unseenResourceCount === 1 ? 'Unseen File' : 'Unseen Files'}</span>
              </span>
            ) : (
              <span className="absolute -top-3 right-1 bg-indigo-950/90 text-amber-300 font-bold text-[9px] px-1.5 py-0.2 rounded-full border border-amber-400/40 z-10">
                0 Unseen
              </span>
            )}
            <button
              onClick={onOpenStudyResources}
              className={`flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border border-indigo-300/50 px-3.5 py-2 rounded-lg text-xs font-black transition shrink-0 cursor-pointer h-[38px] shadow-md hover:shadow-lg active:scale-95 ${
                unseenResourceCount > 0 ? 'ring-2 ring-rose-500 ring-offset-1 ring-offset-indigo-900 animate-pulse' : ''
              }`}
              title={`Open Study Resources (${unseenResourceCount} unseen files)`}
            >
              <FolderOpen className="w-4 h-4 text-indigo-100" />
              <span>Study Resources</span>
            </button>
          </div>

          {/* 8. SEND MAIL FOR EVALUATION */}
          <button
            onClick={onSendMailForEvaluation}
            className="flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border border-rose-300/40 px-3.5 py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer h-[38px] shadow-md hover:shadow-lg active:scale-95"
            title="Send mail for evaluation with today's covered topics"
          >
            <Mail className="w-4 h-4 text-rose-100" />
            <span>Send Mail for Evaluation</span>
          </button>

          {/* 8.5 ADMIN CONSOLE BUTTON (Only available when logged in with johnbosco9947@gmail.com) */}
          {onOpenAdminConsole && isAdminUser(currentUserProfile) && (
            <button
              onClick={onOpenAdminConsole}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black border border-amber-300 px-3.5 py-2 rounded-lg text-xs transition shrink-0 cursor-pointer h-[38px] shadow-md hover:shadow-lg active:scale-95"
              title="Open Admin User Management Console (Delete/Add Registered Students)"
            >
              <Crown className="w-4 h-4 text-slate-950 fill-amber-300" />
              <span>Admin Console</span>
            </button>
          )}

          {/* 9. SIGN OUT / SWITCH PROFILE BUTTON */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1 bg-slate-800/90 hover:bg-rose-900/80 text-rose-200 hover:text-white border border-slate-700 hover:border-rose-500 px-3 py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer h-[38px] shadow-sm"
              title="Sign Out / Switch Student Profile"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
};

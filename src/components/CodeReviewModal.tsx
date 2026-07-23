import React from 'react';
import { X, CheckCircle2, AlertTriangle, Bug, Code2, ShieldAlert, Zap } from 'lucide-react';

interface CodeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeReviewModal: React.FC<CodeReviewModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const mistakes = [
    {
      id: 1,
      title: 'Placeholder Firebase Configuration Credentials',
      severity: 'Critical',
      issue: 'The original code contained hardcoded placeholder strings ("YOUR_FIREBASE_API_KEY", "YOUR_PROJECT_ID"), causing silent connection failures or falling back entirely to LocalStorage.',
      fix: 'Wired your real Firebase project credentials ("ca-final-mentoring") directly into firebase.ts with proper modular SDK initialization.',
    },
    {
      id: 2,
      title: 'Deprecated CDN Script Compatibility SDK',
      severity: 'High',
      issue: 'Loading firebase-app-compat.js via unversioned script tags bypasses bundle safety, lacks TypeScript types, slows down initial page load, and causes CORS/CSP issues in iframe environments.',
      fix: 'Upgraded to modular Firebase SDK v11 (firebase/app, firebase/firestore) with tree-shaking, type safety, and IndexedDB offline persistence.',
    },
    {
      id: 3,
      title: 'Timezone-Bug in Covered Date Validation',
      severity: 'Medium',
      issue: 'Using new Date().toISOString().split("T")[0] uses UTC time rather than local timezone (e.g. IST GMT+5:30). In late evening hours, UTC is tomorrow or yesterday, blocking valid date entry.',
      fix: 'Implemented getLocalTodayString() based on local system date formatting so date validation works reliably at all hours.',
    },
    {
      id: 4,
      title: 'CSV Export Crash & Unescaped Double-Quotes',
      severity: 'High',
      issue: 'The original download function used encodeURI(csvContent) on long data URI strings. Browsers crash or truncate when exporting 40+ students with 100+ topics (~4,000 rows). Also double quotes inside names broke CSV syntax.',
      fix: 'Switched to Blob objects with URL.createObjectURL() and added standard double-quote escaping (" -> "") for seamless Excel/Sheets export.',
    },
    {
      id: 5,
      title: 'DOM Thrashing & Unbounded Snapshot Re-renders',
      severity: 'High',
      issue: 'The global onSnapshot listener called renderGlobalSummary() inside every single iteration of the Firestore snapshot loop, forcing hundreds of DOM recalculations per second on data changes.',
      fix: 'Migrated to React state management with memoized student store cache, updating state cleanly outside snapshot iteration loops.',
    },
    {
      id: 6,
      title: 'Timer Wipe Bug on Session Stop',
      severity: 'Medium',
      issue: 'Calling stopSessionTimer() immediately wiped secondsElapsed = 0 after alert(), preventing students from pausing/resuming or preserving study session duration across page reloads.',
      fix: 'Added Start, Pause, Resume, and Reset controls backed by LocalStorage, allowing study sessions to survive page refreshes.',
    },
    {
      id: 7,
      title: 'Special Character Sanitization & Document Key Collision',
      severity: 'Medium',
      issue: 'sanitizeDocId replaced special characters with underscores without trim/case-handling, leading to whitespace document mismatch between local state and Firestore.',
      fix: 'Refactored sanitizeDocId() with trim().toLowerCase() for clean, deterministic Firestore document pathing.',
    },
    {
      id: 8,
      title: 'Undefined Revisions Counter Operations',
      severity: 'Low',
      issue: 'When parsing older stored JSON records, topicState.revisions was undefined, causing NaN displays or syntax errors when clicking +/- revision buttons.',
      fix: 'Guarded all numeric math with fallback defaults typeof revisions === "number" ? revisions : 0.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-indigo-900 text-white p-5 flex items-center justify-between border-b border-indigo-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400/20 rounded-xl border border-amber-400/30">
              <Bug className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Code Mistakes & Technical Fixes</h2>
              <p className="text-xs text-indigo-200">Analysis of issues found in the original code snippet and how they were resolved.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 text-xs sm:text-sm">
                8 Key Issues Resolved in the New Application Code
              </p>
              <p className="text-amber-800 text-xs mt-0.5">
                The original HTML file was a good start, but suffered from security, performance, date parsing, and CSV export flaws. Below is a detailed breakdown of each mistake and how it was fixed.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {mistakes.map((m) => (
              <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-black">
                      {m.id}
                    </span>
                    {m.title}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      m.severity === 'Critical'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : m.severity === 'High'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {m.severity}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="text-slate-600">
                    <strong className="text-slate-800 font-semibold">Original Bug:</strong> {m.issue}
                  </p>
                  <p className="text-emerald-700 font-medium flex items-start gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Resolved Fix:</strong> {m.fix}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Close Review
          </button>
        </div>

      </div>
    </div>
  );
};

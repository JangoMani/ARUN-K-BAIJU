import React, { useState } from 'react';
import { GroupCategory, TopicProgressState } from '../types';
import { TOPICS_DATA } from '../data/studentsAndTopics';
import { RefreshCw, CheckCircle2, Flame, ChevronLeft, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';

interface RevisionReminderBoxProps {
  currentStudent: string;
  currentGroupFilter: GroupCategory;
  currentTopicsData: Record<string, TopicProgressState>;
  onUpdateTopicField: (
    topicName: string,
    field: keyof TopicProgressState,
    value: any
  ) => void;
  onUpdateRevision: (topicName: string, delta: number) => void;
  onMarkRevisionCompleted?: (topicName: string) => void;
}

export const RevisionReminderBox: React.FC<RevisionReminderBoxProps> = ({
  currentStudent,
  currentGroupFilter,
  currentTopicsData,
  onUpdateTopicField,
  onUpdateRevision,
  onMarkRevisionCompleted,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Filter topics in scope based on active group filter
  let scopeTopics = TOPICS_DATA;
  if (currentGroupFilter === 'First Group') {
    scopeTopics = TOPICS_DATA.filter((t) => ['Paper 1', 'Paper 2', 'Paper 3'].includes(t.paper));
  } else if (currentGroupFilter === 'Second Group') {
    scopeTopics = TOPICS_DATA.filter((t) =>
      ['Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'].includes(t.paper)
    );
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Calculate topics due for revision (covered & 10+ days since last revision/coverage)
  const dueForRevisionTopics = scopeTopics
    .filter((topic) => {
      const state = currentTopicsData[topic.topicName];
      if (!state || !state.completed) return false;

      const baseDateStr = state.lastRevisionDate || state.covDate;
      if (!baseDateStr) return true; // If no date recorded, prompt revision

      const baseDate = new Date(baseDateStr);
      const diffTime = today.getTime() - baseDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return diffDays >= 10;
    })
    .map((topic) => {
      const state = currentTopicsData[topic.topicName];
      const baseDateStr = state?.lastRevisionDate || state?.covDate || todayStr;
      const baseDate = new Date(baseDateStr);
      const diffTime = today.getTime() - baseDate.getTime();
      const daysOver = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      return {
        topic,
        state,
        daysOver,
        baseDateStr,
      };
    })
    .sort((a, b) => b.daysOver - a.daysOver); // Sort most overdue first

  const activeDueCount = dueForRevisionTopics.length;
  const safeIndex = Math.min(currentIndex, Math.max(0, activeDueCount - 1));
  const currentItem = dueForRevisionTopics[safeIndex];

  const handleMarkRevisionDone = () => {
    if (!currentItem) return;
    const { topic } = currentItem;

    if (onMarkRevisionCompleted) {
      onMarkRevisionCompleted(topic.topicName);
    } else {
      const currentRevisions = typeof currentItem.state?.revisions === 'number' ? currentItem.state.revisions : 0;
      onUpdateTopicField(topic.topicName, 'revisions', currentRevisions + 1);
      onUpdateTopicField(topic.topicName, 'lastRevisionDate', todayStr);
    }

    // Reset index if needed
    if (safeIndex >= activeDueCount - 1) {
      setCurrentIndex(0);
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/80 to-amber-100/40 rounded-2xl p-5 border border-amber-200/80 shadow-xs relative overflow-hidden">
      
      {/* Background Accent Pill */}
      <div className="absolute top-0 right-0 bg-amber-400/20 text-amber-900 font-extrabold text-[10px] px-3 py-1 rounded-bl-xl border-l border-b border-amber-300/60 uppercase tracking-wider flex items-center gap-1">
        <Flame className="w-3 h-3 text-amber-600 fill-amber-500" />
        10-Day Spaced Repetition
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
          <RefreshCw className="w-4.5 h-4.5 animate-spin-slow" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Continuous Revision Notification
            {activeDueCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                {activeDueCount} Due
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-600">
            Revising every 10 days guarantees long-term retention for CA Final exams.
          </p>
        </div>
      </div>

      {/* Main One-Topic-At-A-Time Display */}
      {activeDueCount === 0 ? (
        <div className="bg-white/80 rounded-xl p-4 border border-amber-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                All Covered Topics Are Up to Date! 🎉
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                No topics require 10-day revision right now for {currentStudent || 'the student'}. Keep studying!
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200 shrink-0">
            Memory Retention Optimal
          </span>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs space-y-3">
          
          {/* Top Pagination & Due Badge */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                {currentItem.topic.paper}
              </span>
              <span className="text-slate-500 text-[11px] font-medium">
                Topic <strong className="text-slate-800">{safeIndex + 1}</strong> of <strong className="text-slate-800">{activeDueCount}</strong> Due
              </span>
            </div>

            {/* Prev / Next buttons for cycling through due topics */}
            <div className="flex items-center gap-1">
              <button
                disabled={safeIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition cursor-pointer"
                title="Previous due topic"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={safeIndex >= activeDueCount - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(activeDueCount - 1, prev + 1))}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition cursor-pointer"
                title="Next due topic"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Topic Details */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                {currentItem.topic.topicName}
              </h3>

              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                {/* Difficulty Pill */}
                {currentItem.state?.difficulty ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    currentItem.state.difficulty === 'Easy'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : currentItem.state.difficulty === 'Average'
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : currentItem.state.difficulty === 'Tough'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-purple-50 border-purple-200 text-purple-800'
                  }`}>
                    {currentItem.state.difficulty}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    Difficulty: Not set
                  </span>
                )}

                {/* Overdue Days Pill */}
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  {currentItem.daysOver} days since last cover ({currentItem.baseDateStr})
                </span>

                {/* Revisions Count */}
                <span className="text-[11px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                  Current Revisions: <strong className="text-indigo-700">{currentItem.state?.revisions || 0}</strong>
                </span>
              </div>
            </div>

            {/* Action Button: Mark Revised */}
            <button
              onClick={handleMarkRevisionDone}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Mark Revised (+1 Revision)</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

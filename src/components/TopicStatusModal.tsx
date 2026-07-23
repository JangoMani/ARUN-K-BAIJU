import React, { useState } from 'react';
import { GroupCategory, StudentProgressRecord, TopicProgressState } from '../types';
import { TOPICS_DATA, getLocalTodayString } from '../data/studentsAndTopics';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  Calendar,
  Search,
  Filter,
  Check,
} from 'lucide-react';

export type StatusTabType = 'covered' | 'overdue' | 'pending' | 'all';

interface TopicStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: StatusTabType;
  currentStudent: string;
  currentGroupFilter: GroupCategory;
  studentStoreCache: Record<string, StudentProgressRecord>;
  onUpdateTopicField?: (
    topicName: string,
    field: keyof TopicProgressState,
    value: any
  ) => void;
}

export const TopicStatusModal: React.FC<TopicStatusModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'covered',
  currentStudent,
  currentGroupFilter,
  studentStoreCache,
  onUpdateTopicField,
}) => {
  const [activeTab, setActiveTab] = useState<StatusTabType>(initialTab);
  const [selectedPaper, setSelectedPaper] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync initialTab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const currentRecord = studentStoreCache[currentStudent] || {
    groupFilter: currentGroupFilter,
    topicsData: {},
  };
  const currentTopicsMap = currentRecord.topicsData || {};

  // Compute scope topics based on current group filter
  let scopeTopics = TOPICS_DATA;
  if (currentGroupFilter === 'First Group') {
    scopeTopics = TOPICS_DATA.filter((t) => ['Paper 1', 'Paper 2', 'Paper 3'].includes(t.paper));
  } else if (currentGroupFilter === 'Second Group') {
    scopeTopics = TOPICS_DATA.filter((t) =>
      ['Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'].includes(t.paper)
    );
  }

  const todayStr = getLocalTodayString();

  // Categorize topics
  const coveredTopics: typeof TOPICS_DATA = [];
  const overdueTopics: typeof TOPICS_DATA = [];
  const pendingTopics: typeof TOPICS_DATA = [];

  scopeTopics.forEach((t) => {
    const tState = currentTopicsMap[t.topicName];
    if (tState && tState.completed) {
      coveredTopics.push(t);
    } else if (tState && !tState.completed && tState.schDate && tState.schDate < todayStr) {
      overdueTopics.push(t);
    } else {
      pendingTopics.push(t);
    }
  });

  // Determine active list
  let displayList: typeof TOPICS_DATA = scopeTopics;
  if (activeTab === 'covered') displayList = coveredTopics;
  if (activeTab === 'overdue') displayList = overdueTopics;
  if (activeTab === 'pending') displayList = pendingTopics;

  // Apply Paper Filter
  if (selectedPaper !== 'All') {
    displayList = displayList.filter((t) => t.paper === selectedPaper);
  }

  // Apply Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    displayList = displayList.filter(
      (t) =>
        t.topicName.toLowerCase().includes(q) ||
        t.paper.toLowerCase().includes(q)
    );
  }

  // Calculate days lapsed from scheduled date to today
  const getDaysLapsed = (schDateStr?: string): number => {
    if (!schDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sch = new Date(schDateStr);
    sch.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - sch.getTime();
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  };

  // Calculate excess days taken between schDate and covDate
  const getExcessDays = (schDateStr?: string, covDateStr?: string): number => {
    if (!schDateStr || !covDateStr) return 0;
    const sch = new Date(schDateStr);
    sch.setHours(0, 0, 0, 0);
    const cov = new Date(covDateStr);
    cov.setHours(0, 0, 0, 0);
    const diffTime = cov.getTime() - sch.getTime();
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  // Local date helper for offset days (Today, +1 Day, +3 Days, +1 Wk)
  const getOffsetLocalDateString = (daysAhead: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // List of unique paper names in current scope
  const availablePapers = Array.from(new Set(scopeTopics.map((t) => t.paper))).sort();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-4xl w-full my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <BookOpen className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Topic Status & Schedule Breakdown
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/30 border border-indigo-400/30 text-indigo-100 rounded-full">
                  {currentStudent || 'No Student Selected'}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80">
                View topics by paper & completion status &bull; Reschedule overdue dates directly to checklist
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-800/80 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Tabs Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            {/* Covered Tab */}
            <button
              onClick={() => setActiveTab('covered')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'covered'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Covered Topics</span>
              <span
                className={`px-1.5 py-0.2 text-[11px] rounded-full font-black ${
                  activeTab === 'covered'
                    ? 'bg-emerald-700 text-emerald-100'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {coveredTopics.length}
              </span>
            </button>

            {/* Overdue Tab */}
            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer relative ${
                activeTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Overdue Topics</span>
              <span
                className={`px-1.5 py-0.2 text-[11px] rounded-full font-black ${
                  activeTab === 'overdue'
                    ? 'bg-rose-700 text-rose-100'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {overdueTopics.length}
              </span>
            </button>

            {/* Pending Tab */}
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending</span>
              <span
                className={`px-1.5 py-0.2 text-[11px] rounded-full font-black ${
                  activeTab === 'pending'
                    ? 'bg-amber-700 text-amber-100'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {pendingTopics.length}
              </span>
            </button>

            {/* All Topics Tab */}
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>All Scope</span>
              <span
                className={`px-1.5 py-0.2 text-[11px] rounded-full font-black ${
                  activeTab === 'all'
                    ? 'bg-indigo-700 text-indigo-100'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {scopeTopics.length}
              </span>
            </button>
          </div>

          {/* Paper & Search Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Paper selector */}
            <div className="flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <select
                value={selectedPaper}
                onChange={(e) => setSelectedPaper(e.target.value)}
                className="bg-transparent font-bold focus:outline-none cursor-pointer"
              >
                <option value="All">All Papers ({scopeTopics.length})</option>
                {availablePapers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Search input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topic..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 max-h-[calc(90vh-160px)]">
          {displayList.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No topics found</h3>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'covered' && 'No topics have been marked as covered yet.'}
                {activeTab === 'overdue' && 'Great job! You have zero overdue topics.'}
                {activeTab === 'pending' && 'All topics in this group are covered!'}
                {activeTab === 'all' && 'No topics match your current filter or search criteria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayList.map((t) => {
                const tState = currentTopicsMap[t.topicName] || {};
                const isCompleted = !!tState.completed;
                const schDateStr = tState.schDate || '';
                const covDateStr = tState.covDate || tState.completedDate || '';
                const isOverdue = !isCompleted && schDateStr && schDateStr < todayStr;
                const daysLapsed = isOverdue ? getDaysLapsed(schDateStr) : 0;
                const excessDays = isCompleted ? getExcessDays(schDateStr, covDateStr) : 0;

                return (
                  <div
                    key={t.topicName}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200/80'
                        : isOverdue
                        ? 'bg-rose-50/60 border-rose-200 shadow-2xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Left Info: Paper Badge + Topic Name + Status Badges */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Paper Badge (Paper 1, 2, 3, 4A, 4B, 5A, 5B, 6) */}
                        <span className="px-2.5 py-0.5 text-xs font-black bg-indigo-900 text-indigo-100 rounded-md shadow-2xs uppercase tracking-wider">
                          {t.paper}
                        </span>

                        {isCompleted && (
                          <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Covered
                          </span>
                        )}

                        {isOverdue && (
                          <span className="px-2 py-0.5 text-[11px] font-extrabold bg-rose-600 text-white rounded-md flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-white" />
                            {daysLapsed} {daysLapsed === 1 ? 'day' : 'days'} lapsed from sch date
                          </span>
                        )}

                        {!isCompleted && !isOverdue && schDateStr && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900 rounded-md flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-700" /> Scheduled: {schDateStr}
                          </span>
                        )}

                        {!isCompleted && !schDateStr && (
                          <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-500 rounded-md">
                            Not scheduled yet
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 leading-snug">
                        {t.topicName}
                      </h4>

                      {/* Covered Topic Specific Info: Days Excess Taken from Sch Date */}
                      {isCompleted ? (
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {schDateStr && (
                            <span className="text-xs text-slate-600 font-medium">
                              Sch Date: <strong className="text-slate-800">{schDateStr}</strong>
                            </span>
                          )}
                          {covDateStr && (
                            <span className="text-xs text-slate-600 font-medium">
                              &bull; Covered Date: <strong className="text-emerald-800">{covDateStr}</strong>
                            </span>
                          )}

                          {schDateStr && covDateStr && (
                            excessDays > 0 ? (
                              <span className="px-2.5 py-0.5 text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 rounded-md flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-700" />
                                {excessDays} {excessDays === 1 ? 'day' : 'days'} excess taken from sch date
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Completed on schedule (0 days excess)
                              </span>
                            )
                          )}

                          {!schDateStr && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                              Covered without prior schedule
                            </span>
                          )}
                        </div>
                      ) : (
                        /* Overdue topic extra details */
                        isOverdue && (
                          <p className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                            <span>Scheduled Date:</span>
                            <span className="underline">{schDateStr}</span>
                            <span>&bull; Lapsed by {daysLapsed} {daysLapsed === 1 ? 'day' : 'days'}</span>
                          </p>
                        )
                      )}
                    </div>

                    {/* Right Side: Reschedule Controls ONLY for NON-COVERED topics */}
                    {!isCompleted ? (
                      <div className="flex flex-col sm:items-end gap-2 shrink-0 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Reschedule Date:</span>
                          </label>

                          <input
                            type="date"
                            value={schDateStr}
                            onChange={(e) => {
                              if (onUpdateTopicField) {
                                onUpdateTopicField(t.topicName, 'schDate', e.target.value);
                              }
                            }}
                            className={`text-xs font-bold border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                              isOverdue
                                ? 'border-rose-400 bg-rose-50 text-rose-900 focus:bg-white'
                                : 'border-slate-300 bg-white text-slate-800'
                            }`}
                          />
                        </div>

                        {/* Quick Reschedule Shortcuts using Local Offset Dates */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-400 mr-1">Push To:</span>
                          <button
                            onClick={() => {
                              if (onUpdateTopicField) {
                                onUpdateTopicField(t.topicName, 'schDate', getOffsetLocalDateString(0));
                              }
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition cursor-pointer"
                            title="Reschedule to Today"
                          >
                            Today
                          </button>
                          <button
                            onClick={() => {
                              if (onUpdateTopicField) {
                                onUpdateTopicField(t.topicName, 'schDate', getOffsetLocalDateString(1));
                              }
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition cursor-pointer"
                            title="Reschedule to Tomorrow"
                          >
                            +1 Day
                          </button>
                          <button
                            onClick={() => {
                              if (onUpdateTopicField) {
                                onUpdateTopicField(t.topicName, 'schDate', getOffsetLocalDateString(3));
                              }
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition cursor-pointer"
                            title="Reschedule to +3 Days"
                          >
                            +3 Days
                          </button>
                          <button
                            onClick={() => {
                              if (onUpdateTopicField) {
                                onUpdateTopicField(t.topicName, 'schDate', getOffsetLocalDateString(7));
                              }
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition cursor-pointer"
                            title="Reschedule to +1 Week"
                          >
                            +1 Wk
                          </button>
                        </div>

                        {/* Toggle Covered Checkbox */}
                        <div className="pt-1 flex items-center justify-end w-full">
                          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={(e) => {
                                if (onUpdateTopicField) {
                                  onUpdateTopicField(t.topicName, 'completed', e.target.checked);
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span>Mark as Covered</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      /* For Covered topics: Option to unmark if needed */
                      <div className="shrink-0 flex sm:flex-col items-end justify-center">
                        <button
                          onClick={() => {
                            if (onUpdateTopicField) {
                              onUpdateTopicField(t.topicName, 'completed', false);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg transition cursor-pointer"
                          title="Mark topic as pending again"
                        >
                          Unmark Covered
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { GroupCategory, PaperName, TopicProgressState, UserProfile } from '../types';
import { TOPICS_DATA, getDateConstraints, sanitizeDocId } from '../data/studentsAndTopics';
import { CheckSquare, Square, Search, Filter, CalendarX, Plus, Minus, Check, CheckCircle, ShieldAlert } from 'lucide-react';

interface TopicsChecklistProps {
  currentStudent: string;
  currentGroupFilter: GroupCategory;
  currentTopicsData: Record<string, TopicProgressState>;
  currentUserProfile?: UserProfile | null;
  onUpdateTopicField: (topicName: string, field: keyof TopicProgressState, value: any) => void;
  onUpdateRevision: (topicName: string, delta: number) => void;
  onClearTopicDates: (topicName: string) => void;
  onBatchMarkVisible: (completed: boolean, visibleTopics: typeof TOPICS_DATA) => void;
}

export const TopicsChecklist: React.FC<TopicsChecklistProps> = ({
  currentStudent,
  currentGroupFilter,
  currentTopicsData,
  currentUserProfile,
  onUpdateTopicField,
  onUpdateRevision,
  onClearTopicDates,
  onBatchMarkVisible,
}) => {
  const [currentPaperFilter, setCurrentPaperFilter] = useState<string>('All');
  const [topicSearchTerm, setTopicSearchTerm] = useState<string>('');

  const constraints = getDateConstraints();
  const todayStr = new Date().toISOString().slice(0, 10);

  const isAdmin =
    currentUserProfile?.email?.toLowerCase().trim() === 'johnbosco9947@gmail.com' ||
    currentUserProfile?.role === 'admin' ||
    currentUserProfile?.role === 'superadmin' ||
    (currentStudent && (currentStudent.toLowerCase().includes('arun') || currentStudent.toLowerCase().includes('admin')));

  const isStudentSelected = !!currentStudent && currentStudent.trim().length > 0;

  const requireStudentSelection = (actionFn: () => void) => {
    if (!isStudentSelected) {
      alert('⚠️ Student Name Required! Please select or enter a Student Name in the top header before making any edits.');
      return;
    }
    actionFn();
  };

  // Determine valid papers based on group
  let validPapers: string[] = ['All'];
  if (currentGroupFilter === 'First Group') {
    validPapers = ['All', 'Paper 1', 'Paper 2', 'Paper 3'];
  } else if (currentGroupFilter === 'Second Group') {
    validPapers = ['All', 'Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'];
  } else {
    validPapers = ['All', 'Paper 1', 'Paper 2', 'Paper 3', 'Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'];
  }

  // Active paper filter reset if out of group bounds
  const activePaper = validPapers.includes(currentPaperFilter) ? currentPaperFilter : 'All';

  // Filter topics by group
  let groupTopics = TOPICS_DATA;
  if (currentGroupFilter === 'First Group') {
    groupTopics = TOPICS_DATA.filter((t) => ['Paper 1', 'Paper 2', 'Paper 3'].includes(t.paper));
  } else if (currentGroupFilter === 'Second Group') {
    groupTopics = TOPICS_DATA.filter((t) =>
      ['Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'].includes(t.paper)
    );
  }

  // Filter topics by active paper and search term
  const filteredTopics = groupTopics.filter((t) => {
    const matchesPaper = activePaper === 'All' || t.paper === activePaper;
    const matchesSearch = t.topicName.toLowerCase().includes(topicSearchTerm.toLowerCase());
    return matchesPaper && matchesSearch;
  });

  return (
    <section className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
      
      {/* Student Selection Guard Banner */}
      {!isStudentSelected && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs font-semibold flex items-center gap-2 shadow-xs animate-pulse">
          <span className="p-1 bg-amber-200 text-amber-900 rounded-lg text-sm shrink-0">⚠️</span>
          <span>
            <strong>Student Name Not Selected:</strong> Please select or type a Student Name in the top header first to enable checking topics, setting schedule dates, and editing study records!
          </span>
        </div>
      )}

      {/* Admin Mode Notice Banner */}
      {isAdmin && isStudentSelected && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-indigo-900 text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <span className="p-1 bg-indigo-200 text-indigo-900 rounded-lg text-sm shrink-0">🛡️</span>
          <span>
            <strong>Admin Mode ({currentStudent}):</strong> You can view all student data and <u>reschedule dates for overdue topics</u>. Student-filled fields (completion status, covered dates, revisions, difficulty) cannot be modified.
          </span>
        </div>
      )}

      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600" /> Syllabus Topics Checklist
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage schedule dates, completion status, revisions, and evaluations for {currentStudent || 'the selected student'}.
          </p>
        </div>

        {/* Batch Buttons & Search */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-52">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter topics..."
              value={topicSearchTerm}
              onChange={(e) => setTopicSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <button
            onClick={() => requireStudentSelection(() => onBatchMarkVisible(true, filteredTopics))}
            disabled={isAdmin}
            className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={isAdmin ? 'Admins cannot batch mark student completion' : ''}
          >
            Select All
          </button>
          <button
            onClick={() => requireStudentSelection(() => onBatchMarkVisible(false, filteredTopics))}
            disabled={isAdmin}
            className="text-xs bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={isAdmin ? 'Admins cannot batch mark student completion' : ''}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Paper Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {validPapers.map((p) => {
          const isActive = activePaper === p;
          return (
            <button
              key={p}
              onClick={() => setCurrentPaperFilter(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Topics List Container */}
      <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[580px] pr-1">
        {filteredTopics.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
            No topics match your search or filter criteria.
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const topicState = currentTopicsData[topic.topicName] || {
              completed: false,
              schDate: '',
              covDate: '',
              evaluated: false,
              revisions: 0,
            };

            const isChecked = !!topicState.completed;
            const revisionsCount = typeof topicState.revisions === 'number' ? topicState.revisions : 0;
            const topicId = sanitizeDocId(topic.topicName);

            return (
              <div
                key={topic.topicName}
                className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
                  isChecked
                    ? 'bg-emerald-50/60 border-emerald-200/90 text-slate-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {/* Top Row: Completion Checkbox & Topic Name */}
                <div className="flex items-center gap-3 w-full">
                  <input
                    type="checkbox"
                    id={`chk_${topicId}`}
                    checked={isChecked}
                    disabled={isAdmin || (!topicState.schDate && !isChecked)}
                    onChange={(e) => requireStudentSelection(() => onUpdateTopicField(topic.topicName, 'completed', e.target.checked))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isAdmin ? 'Admins cannot edit student completion status' : (!topicState.schDate && !isChecked ? 'Please fill Scheduled Date first' : '')}
                  />
                  <label
                    htmlFor={`chk_${topicId}`}
                    className={`text-sm font-bold select-none ${
                      isAdmin ? 'cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      isChecked ? 'text-emerald-900 line-through/40' : 'text-slate-800'
                    }`}
                    title={topic.topicName}
                  >
                    {topic.topicName}
                  </label>
                </div>

                {/* Bottom Row: All Input Controls neatly aligned in a row */}
                <div className="flex flex-wrap items-end gap-3 sm:gap-4 pt-1 border-t border-slate-100/80">
                  
                  {/* Difficulty Rating Dropdown */}
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Difficulty
                    </span>
                    <select
                      value={topicState.difficulty || ''}
                      disabled={isAdmin}
                      onChange={(e) => requireStudentSelection(() => onUpdateTopicField(topic.topicName, 'difficulty', e.target.value))}
                      className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 shadow-2xs font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        topicState.difficulty === 'Easy'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : topicState.difficulty === 'Average'
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : topicState.difficulty === 'Tough'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : topicState.difficulty === 'Tricky'
                          ? 'bg-purple-50 border-purple-300 text-purple-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      title={isAdmin ? 'Admins cannot edit student difficulty rating' : ''}
                    >
                      <option value="">-- Optional --</option>
                      <option value="Easy">Easy</option>
                      <option value="Average">Average</option>
                      <option value="Tough">Tough</option>
                      <option value="Tricky">Tricky</option>
                    </select>
                  </div>

                  {/* Revisions Counter */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Revisions
                    </span>
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                      <button
                        onClick={() => requireStudentSelection(() => onUpdateRevision(topic.topicName, -1))}
                        disabled={isAdmin}
                        className="px-2 py-0.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isAdmin ? 'Admins cannot edit student revision count' : 'Decrease Revisions'}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 py-0.5 text-xs font-bold text-indigo-700 min-w-[26px] text-center">
                        {revisionsCount}
                      </span>
                      <button
                        onClick={() => requireStudentSelection(() => onUpdateRevision(topic.topicName, 1))}
                        disabled={isAdmin}
                        className="px-2 py-0.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isAdmin ? 'Admins cannot edit student revision count' : 'Increase Revisions'}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Clear Dates Button */}
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      disabled={isAdmin}
                      onClick={() => requireStudentSelection(() => onClearTopicDates(topic.topicName))}
                      className="text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer h-[28px] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={isAdmin ? 'Admins cannot clear student dates' : 'Clear saved dates for this topic'}
                    >
                      <CalendarX className="w-3 h-3" /> Clear
                    </button>
                  </div>

                  {/* Schedule Date */}
                  {(() => {
                    const isTopicOverdue = !isChecked && !!topicState.schDate && topicState.schDate < todayStr;
                    const canEditSchDate = !isAdmin || isTopicOverdue;

                    return (
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            Sch Date
                          </span>
                          {topicState.schDate && !isAdmin && (
                            <button
                              type="button"
                              onClick={() => requireStudentSelection(() => onUpdateTopicField(topic.topicName, 'schDate', ''))}
                              className="text-[9px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                              title="Clear scheduled date"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="date"
                          value={topicState.schDate || ''}
                          disabled={!canEditSchDate}
                          min={constraints.minScheduleDate}
                          max={constraints.maxScheduleDate}
                          onChange={(e) => requireStudentSelection(() => onUpdateTopicField(topic.topicName, 'schDate', e.target.value))}
                          className={`text-xs border rounded-lg px-2 py-1 shadow-2xs ${
                            isTopicOverdue && isAdmin
                              ? 'bg-rose-50 border-rose-400 font-bold text-rose-900 focus:bg-white focus:ring-rose-500'
                              : 'bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400'
                          } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
                          title={
                            isAdmin
                              ? isTopicOverdue
                                ? 'Admin: Reschedule overdue topic date'
                                : 'Admin Restriction: Only overdue topic reschedule dates can be edited by Admin'
                              : ''
                          }
                        />
                      </div>
                    );
                  })()}

                  {/* Covered Date */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        Covered Date
                      </span>
                      {topicState.covDate && !isAdmin && (
                        <button
                          type="button"
                          onClick={() => requireStudentSelection(() => onUpdateTopicField(topic.topicName, 'covDate', ''))}
                          className="text-[9px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                          title="Clear covered date"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={topicState.covDate || ''}
                      disabled={isAdmin || !topicState.schDate}
                      min={topicState.schDate || undefined}
                      max={constraints.maxCoveredDate}
                      onChange={(e) => requireStudentSelection(() => onUpdateTopicField(topic.topicName, 'covDate', e.target.value))}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed"
                      title={isAdmin ? 'Admins cannot edit student covered dates' : (!topicState.schDate ? 'Please fill Scheduled Date first' : 'Select Covered Date')}
                    />
                  </div>

                  {/* Evaluated Checkbox */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Evaluated
                    </span>
                    <div className="h-[28px] flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={!!topicState.evaluated}
                        disabled={isAdmin}
                        onChange={(e) => requireStudentSelection(() => onUpdateTopicField(topic.topicName, 'evaluated', e.target.checked))}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isAdmin ? 'Admins cannot edit student evaluation status' : ''}
                      />
                    </div>
                  </div>

                  {/* Paper Badge */}
                  <div className="flex flex-col justify-end ml-auto">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0 h-[28px] flex items-center">
                      {topic.paper}
                    </span>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

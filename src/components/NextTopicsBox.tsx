import React from 'react';
import { GroupCategory, TopicProgressState } from '../types';
import { TOPICS_DATA } from '../data/studentsAndTopics';
import { Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight, Check } from 'lucide-react';

interface NextTopicsBoxProps {
  currentStudent: string;
  currentGroupFilter: GroupCategory;
  currentTopicsData: Record<string, TopicProgressState>;
  onUpdateTopicField: (
    topicName: string,
    field: keyof TopicProgressState,
    value: any
  ) => void;
}

export const NextTopicsBox: React.FC<NextTopicsBoxProps> = ({
  currentStudent,
  currentGroupFilter,
  currentTopicsData,
  onUpdateTopicField,
}) => {
  // Filter topics in scope
  let scopeTopics = TOPICS_DATA;
  if (currentGroupFilter === 'First Group') {
    scopeTopics = TOPICS_DATA.filter((t) => ['Paper 1', 'Paper 2', 'Paper 3'].includes(t.paper));
  } else if (currentGroupFilter === 'Second Group') {
    scopeTopics = TOPICS_DATA.filter((t) =>
      ['Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'].includes(t.paper)
    );
  }

  // Filter pending (uncompleted) topics
  const pendingTopics = scopeTopics.filter((topic) => {
    const state = currentTopicsData[topic.topicName];
    return !state || !state.completed;
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  // Sort: topics with scheduled dates first (ascending order: overdue -> today -> future), then unscheduled
  const sortedPendingTopics = [...pendingTopics].sort((a, b) => {
    const stateA = currentTopicsData[a.topicName];
    const stateB = currentTopicsData[b.topicName];

    const dateA = stateA?.schDate || '';
    const dateB = stateB?.schDate || '';

    if (dateA && dateB) {
      return dateA.localeCompare(dateB);
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    return 0; // maintain original order
  });

  // Pick top 5
  const next5Topics = sortedPendingTopics.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100 hover:border-indigo-200 transition">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Next 5 Topics To Complete</span>
              <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                Target List
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Prioritized by scheduled target date (Overdue & Upcoming)
            </p>
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          Pending: <span className="font-bold text-indigo-600">{pendingTopics.length}</span> / {scopeTopics.length}
        </div>
      </div>

      {next5Topics.length === 0 ? (
        <div className="text-center py-8 bg-emerald-50/50 rounded-xl border border-emerald-100">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-emerald-800">All Topics Completed!</h3>
          <p className="text-xs text-emerald-600 mt-1">
            Congratulations! All topics in this group filter have been covered.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {next5Topics.map((topic, index) => {
            const state = currentTopicsData[topic.topicName] || {
              completed: false,
              schDate: '',
              covDate: '',
              evaluated: false,
              revisions: 0,
            };

            const schDate = state.schDate;
            let statusTag = null;

            if (schDate) {
              if (schDate < todayStr) {
                statusTag = (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200 shrink-0">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    Overdue ({schDate})
                  </span>
                );
              } else if (schDate === todayStr) {
                statusTag = (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Due Today ({schDate})
                  </span>
                );
              } else {
                statusTag = (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 shrink-0">
                    <Calendar className="w-3 h-3 text-indigo-500" />
                    Due: {schDate}
                  </span>
                );
              }
            } else {
              statusTag = (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  No Scheduled Date
                </span>
              );
            }

            return (
              <div
                key={topic.topicName}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-indigo-200 transition shadow-xs"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
                        {topic.paper}
                      </span>
                      {statusTag}
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 truncate" title={topic.topicName}>
                      {topic.topicName}
                    </h3>
                  </div>
                </div>

                {/* Quick Date Picker & Completion Action */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-semibold">Sch. Date</span>
                    <input
                      type="date"
                      value={state.schDate || ''}
                      onChange={(e) => onUpdateTopicField(topic.topicName, 'schDate', e.target.value)}
                      className="text-[11px] font-medium bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!currentStudent) {
                        alert('Please select or enter a student name first.');
                        return;
                      }
                      onUpdateTopicField(topic.topicName, 'completed', true);
                      if (!state.covDate) {
                        onUpdateTopicField(topic.topicName, 'covDate', todayStr);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                    title="Mark this topic as Completed"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { GroupCategory, StudentProgressRecord, TopicProgressState, UserProfile } from '../types';
import { TOPICS_DATA } from '../data/studentsAndTopics';
import { CheckCircle2, Clock, BookOpen, AlertTriangle } from 'lucide-react';
import { TopicStatusModal, StatusTabType } from './TopicStatusModal';

interface ProgressSidebarProps {
  currentStudent: string;
  currentGroupFilter: GroupCategory;
  studentStoreCache: Record<string, StudentProgressRecord>;
  cloudConnected: boolean;
  currentUserProfile?: UserProfile | null;
  onUpdateTopicField?: (
    topicName: string,
    field: keyof TopicProgressState,
    value: any
  ) => void;
}

export const ProgressSidebar: React.FC<ProgressSidebarProps> = ({
  currentStudent,
  currentGroupFilter,
  studentStoreCache,
  cloudConnected,
  currentUserProfile,
  onUpdateTopicField,
}) => {
  const currentRecord = studentStoreCache[currentStudent] || {
    groupFilter: currentGroupFilter,
    topicsData: {},
  };
  const currentTopicsMap = currentRecord.topicsData || {};

  // Compute scope topics based on group
  let scopeTopics = TOPICS_DATA;
  if (currentGroupFilter === 'First Group') {
    scopeTopics = TOPICS_DATA.filter((t) => ['Paper 1', 'Paper 2', 'Paper 3'].includes(t.paper));
  } else if (currentGroupFilter === 'Second Group') {
    scopeTopics = TOPICS_DATA.filter((t) =>
      ['Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'].includes(t.paper)
    );
  }

  const totalScope = scopeTopics.length;
  let coveredCount = 0;
  let overdueCount = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  scopeTopics.forEach((t) => {
    const tState = currentTopicsMap[t.topicName];
    if (tState && tState.completed) {
      coveredCount++;
    } else if (tState && !tState.completed && tState.schDate && tState.schDate < todayStr) {
      overdueCount++;
    }
  });

  const pendingCount = Math.max(0, totalScope - coveredCount);
  const overallPercent = totalScope > 0 ? Math.round((coveredCount / totalScope) * 100) : 0;

  // Compute Paper-Wise Stats
  const paperGroups: Record<string, typeof TOPICS_DATA> = {};
  scopeTopics.forEach((t) => {
    if (!paperGroups[t.paper]) paperGroups[t.paper] = [];
    paperGroups[t.paper].push(t);
  });

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<StatusTabType>('covered');

  const openStatusModal = (tab: StatusTabType) => {
    setModalTab(tab);
    setIsModalOpen(true);
  };

  return (
    <aside className="lg:col-span-1 space-y-5">
      {/* Overall Progress Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2.5 flex items-center justify-between">
          <span>Overall Progress</span>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
            {currentStudent || 'No Student Selected'}
          </span>
        </h2>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Completion Rate</span>
              <span className="text-indigo-600 text-sm font-extrabold">{overallPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
              <div
                className="bg-gradient-to-r from-indigo-600 to-indigo-500 h-2 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Covered Card */}
            <div
              onClick={() => openStatusModal('covered')}
              className="bg-emerald-50/80 hover:bg-emerald-100/80 p-3 rounded-xl border border-emerald-100 hover:border-emerald-300 text-center cursor-pointer transition-all hover:shadow-sm active:scale-95 group"
              title="Click to view all covered topics & paper breakdown"
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wide group-hover:text-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Covered
              </div>
              <span className="text-xl font-black text-emerald-600 mt-0.5 block">{coveredCount}</span>
              <span className="text-[9px] font-semibold text-emerald-700 underline mt-0.5 block opacity-80 group-hover:opacity-100">View List</span>
            </div>

            {/* Pending Card */}
            <div
              onClick={() => openStatusModal('pending')}
              className="bg-amber-50/80 hover:bg-amber-100/80 p-3 rounded-xl border border-amber-100 hover:border-amber-300 text-center cursor-pointer transition-all hover:shadow-sm active:scale-95 group"
              title="Click to view all pending topics"
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-800 uppercase tracking-wide group-hover:text-amber-900">
                <Clock className="w-3 h-3 text-amber-700" /> Pending
              </div>
              <span className="text-xl font-black text-amber-700 mt-0.5 block">{pendingCount}</span>
              <span className="text-[9px] font-semibold text-amber-800 underline mt-0.5 block opacity-80 group-hover:opacity-100">View List</span>
            </div>

            {/* Overdue Card */}
            <div
              onClick={() => openStatusModal('overdue')}
              className={`p-3 rounded-xl border text-center cursor-pointer transition-all hover:shadow-sm active:scale-95 group ${
                overdueCount > 0
                  ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 hover:border-rose-400 ring-2 ring-rose-400/30'
                  : 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-100 hover:border-rose-300'
              }`}
              title="Click to view overdue topics & reschedule dates"
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-700 uppercase tracking-wide group-hover:text-rose-800">
                <AlertTriangle className="w-3 h-3 text-rose-600" /> Overdue
              </div>
              <span className="text-xl font-black text-rose-600 mt-0.5 block">{overdueCount}</span>
              <span className="text-[9px] font-semibold text-rose-700 underline mt-0.5 block opacity-80 group-hover:opacity-100">Reschedule</span>
            </div>

            {/* Total Scope Card */}
            <div
              onClick={() => openStatusModal('all')}
              className="bg-indigo-50/80 hover:bg-indigo-100/80 p-3 rounded-xl border border-indigo-100 hover:border-indigo-300 text-center cursor-pointer transition-all hover:shadow-sm active:scale-95 group"
              title="Click to view all scope topics"
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-indigo-700 uppercase tracking-wide group-hover:text-indigo-800">
                <BookOpen className="w-3 h-3 text-indigo-600" /> Total Scope
              </div>
              <span className="text-xl font-black text-indigo-700 mt-0.5 block">{totalScope}</span>
              <span className="text-[9px] font-semibold text-indigo-700 underline mt-0.5 block opacity-80 group-hover:opacity-100">View All</span>
            </div>
          </div>
        </div>
      </div>

      {/* Paper-Wise Breakdown Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
          Paper-Wise Progress
        </h2>

        {Object.keys(paperGroups).length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            Select a group to view paper-wise breakdown.
          </p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {Object.keys(paperGroups)
              .sort()
              .map((paperName) => {
                const list = paperGroups[paperName];
                const total = list.length;
                let cov = 0;
                list.forEach((t) => {
                  if (currentTopicsMap[t.topicName] && currentTopicsMap[t.topicName].completed) {
                    cov++;
                  }
                });
                const pct = total > 0 ? Math.round((cov / total) * 100) : 0;

                return (
                  <div key={paperName} className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
                      <span>{paperName}</span>
                      <span className="text-indigo-600">
                        {pct}% ({cov}/{total})
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Topic Status & Schedule Modal */}
      <TopicStatusModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialTab={modalTab}
        currentStudent={currentStudent}
        currentGroupFilter={currentGroupFilter}
        studentStoreCache={studentStoreCache}
        currentUserProfile={currentUserProfile}
        onUpdateTopicField={onUpdateTopicField}
      />
    </aside>
  );
};

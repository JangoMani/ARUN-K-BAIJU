import React, { useState } from 'react';
import { StudentProgressRecord } from '../types';
import { STUDENTS_LIST, TOPICS_DATA } from '../data/studentsAndTopics';
import { Search, Users, Sparkles } from 'lucide-react';

interface GlobalProgressOverviewProps {
  currentStudent: string;
  studentStoreCache: Record<string, StudentProgressRecord>;
  onSelectStudent: (studentName: string) => void;
}

export const GlobalProgressOverview: React.FC<GlobalProgressOverviewProps> = ({
  currentStudent,
  studentStoreCache,
  onSelectStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = STUDENTS_LIST.filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="max-w-7xl mx-auto px-4 mt-6 w-full">
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Everyone's Progress Overview
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-100">
              {STUDENTS_LIST.length} Students
            </span>
          </div>

          {/* Quick Search inside grid */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Global Student Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto pr-1">
          {filteredStudents.map((name) => {
            const record = studentStoreCache[name] || { groupFilter: 'Not Selected', topicsData: {} };
            const gFilter = record.groupFilter;
            const studentTopicsMap = record.topicsData || {};

            let scopeTopics = TOPICS_DATA;
            if (gFilter === 'First Group') {
              scopeTopics = TOPICS_DATA.filter((t) => ['Paper 1', 'Paper 2', 'Paper 3'].includes(t.paper));
            } else if (gFilter === 'Second Group') {
              scopeTopics = TOPICS_DATA.filter((t) =>
                ['Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'].includes(t.paper)
              );
            }

            const total = scopeTopics.length;
            let covered = 0;
            scopeTopics.forEach((t) => {
              if (studentTopicsMap[t.topicName] && studentTopicsMap[t.topicName].completed) {
                covered++;
              }
            });

            const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
            const isCurrent = name === currentStudent;

            return (
              <div
                key={name}
                onClick={() => onSelectStudent(name)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div
                    className={`text-xs font-bold truncate ${
                      isCurrent ? 'text-indigo-900' : 'text-slate-800'
                    }`}
                    title={name}
                  >
                    {name}
                  </div>
                  {isCurrent && <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />}
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                  <span className="font-medium">
                    {gFilter === 'Not Selected' ? 'Group N/A' : `${covered}/${total}`}
                  </span>
                  <span className="font-bold text-indigo-600">{percent}%</span>
                </div>

                <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

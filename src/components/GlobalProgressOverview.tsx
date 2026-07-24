import React, { useState } from 'react';
import { StudentProgressRecord } from '../types';
import { TOPICS_DATA, sanitizeDocId } from '../data/studentsAndTopics';
import { Search, Users, Sparkles, UserCheck, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface GlobalProgressOverviewProps {
  currentStudent: string;
  studentStoreCache: Record<string, StudentProgressRecord>;
  onSelectStudent?: (studentName: string) => void;
  onDeleteStudent?: (studentName: string) => void;
  registeredStudents?: string[];
  isAdmin?: boolean;
}

export const GlobalProgressOverview: React.FC<GlobalProgressOverviewProps> = ({
  currentStudent,
  studentStoreCache,
  onSelectStudent,
  onDeleteStudent,
  registeredStudents = [],
  isAdmin = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const isExcludedAdminName = (name: string) => {
    if (!name) return false;
    const upper = name.toUpperCase().trim();
    return (
      upper.includes('MANIKUTTAN') ||
      upper.includes('ADMIN') ||
      upper.includes('SUPERADMIN') ||
      upper.includes('JOHNBOSCO')
    );
  };

  // Display ONLY registered students registered in database
  const studentList = Array.from(
    new Set([
      ...(registeredStudents || []),
    ].filter((name) => name && name.trim().length > 0 && !isExcludedAdminName(name)))
  );

  const filteredStudents = studentList.filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCardClick = (studentName: string) => {
    if (isAdmin) {
      onSelectStudent?.(studentName);
    } else {
      alert(`Student selection is restricted to Admin. You are currently viewing your own student account (${currentStudent}).`);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, studentName: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to permanently delete "${studentName}" and all associated progress data from Firestore Cloud?`)) {
      return;
    }

    try {
      if (db) {
        const deletePromises: Promise<void>[] = [];
        const docId = sanitizeDocId(studentName);
        const upperDocId = sanitizeDocId(studentName.toUpperCase());

        // Candidates for progress and ca_registered_users
        deletePromises.push(deleteDoc(doc(db, 'progress', docId)).catch(() => {}));
        deletePromises.push(deleteDoc(doc(db, 'progress', upperDocId)).catch(() => {}));
        deletePromises.push(deleteDoc(doc(db, 'progress', studentName)).catch(() => {}));
        deletePromises.push(deleteDoc(doc(db, 'progress', studentName.toUpperCase())).catch(() => {}));

        deletePromises.push(deleteDoc(doc(db, 'ca_registered_users', docId)).catch(() => {}));
        deletePromises.push(deleteDoc(doc(db, 'ca_registered_users', upperDocId)).catch(() => {}));
        deletePromises.push(deleteDoc(doc(db, 'ca_registered_users', studentName)).catch(() => {}));
        deletePromises.push(deleteDoc(doc(db, 'ca_registered_users', studentName.toUpperCase())).catch(() => {}));

        // Query by fullName in ca_registered_users
        try {
          const q1 = query(collection(db, 'ca_registered_users'), where('fullName', '==', studentName));
          const snap1 = await getDocs(q1);
          snap1.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        try {
          const q2 = query(collection(db, 'ca_registered_users'), where('fullName', '==', studentName.toUpperCase()));
          const snap2 = await getDocs(q2);
          snap2.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        // Query by studentName in progress
        try {
          const q3 = query(collection(db, 'progress'), where('studentName', '==', studentName));
          const snap3 = await getDocs(q3);
          snap3.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        try {
          const q4 = query(collection(db, 'progress'), where('studentName', '==', studentName.toUpperCase()));
          const snap4 = await getDocs(q4);
          snap4.forEach((d) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
        } catch (e) {}

        await Promise.all(deletePromises);
      }

      localStorage.removeItem(`ca_progress_${studentName}`);
      localStorage.removeItem(`ca_progress_${studentName.toUpperCase()}`);
      localStorage.removeItem(`ca_user_profile_${sanitizeDocId(studentName)}`);

      if (onDeleteStudent) {
        onDeleteStudent(studentName);
      }

      alert(`Successfully deleted all student records and progress data for "${studentName}".`);
    } catch (err: any) {
      alert(`Failed to delete student: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 mt-6 w-full">
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Registered Students Progress Overview
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-indigo-600" />
              <span>{studentList.length} Registered</span>
            </span>
          </div>

          {/* Quick Search inside grid */}
          {studentList.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="off"
                placeholder="Search registered student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 font-semibold"
              />
            </div>
          )}
        </div>

        {/* Global Student Cards Grid - Read only, no click-to-change behavior */}
        {studentList.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No registered students yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Please fill in the registration details to start tracking progress.</p>
          </div>
        ) : (
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
              const isCurrent = name.toUpperCase().trim() === currentStudent.toUpperCase().trim();

              return (
                <div
                  key={name}
                  onClick={() => handleCardClick(name)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/90 hover:border-slate-300'
                  }`}
                  title={isAdmin ? `Click to view ${name}'s progress` : `Viewing student overview`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div
                      className={`text-xs font-bold truncate uppercase ${
                        isCurrent ? 'text-indigo-900 font-extrabold' : 'text-slate-800'
                      }`}
                      title={name}
                    >
                      {name}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isCurrent && <Sparkles className="w-3 h-3 text-indigo-600" />}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, name)}
                          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                          title={`Delete ${name}'s progress data`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
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
        )}
      </div>
    </section>
  );
};

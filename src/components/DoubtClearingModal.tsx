import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { UserProfile } from '../types';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  getDocs,
  where
} from 'firebase/firestore';
import {
  MessageSquare,
  X,
  Send,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Clock,
  UserCheck,
  AlertCircle,
  FileText,
  Loader2,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export interface DoubtMessage {
  id: string;
  studentName: string;
  text: string;
  attachmentUrl?: string; // Data URL for images/files
  attachmentName?: string;
  attachmentType?: 'image' | 'file';
  createdAt: number; // Unix timestamp in ms
  dateStr: string;
}

interface DoubtClearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudent: string;
  currentUserProfile?: UserProfile | null;
}

const LOCAL_STORAGE_KEY = 'ca_doubts_chat_backup_v1';
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export const DoubtClearingModal: React.FC<DoubtClearingModalProps> = ({
  isOpen,
  onClose,
  currentStudent,
  currentUserProfile,
}) => {
  const [messages, setMessages] = useState<DoubtMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');

  const isAdmin =
    currentUserProfile?.email?.toLowerCase().trim() === 'johnbosco9947@gmail.com' ||
    currentUserProfile?.role === 'admin' ||
    currentUserProfile?.role === 'superadmin' ||
    (currentStudent && (currentStudent.toLowerCase().includes('arun') || currentStudent.toLowerCase().includes('admin')));
  
  // File upload preview
  const [selectedFile, setSelectedFile] = useState<{
    url: string;
    name: string;
    type: 'image' | 'file';
  } | null>(null);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Filter messages older than 10 days
  const filterValid10DayMessages = (msgs: DoubtMessage[]): DoubtMessage[] => {
    const cutoff = Date.now() - TEN_DAYS_MS;
    return msgs.filter((m) => m.createdAt >= cutoff);
  };

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Firestore & LocalStorage Sync
  useEffect(() => {
    if (!isOpen) return;

    let unsubscribe: () => void = () => {};

    try {
      const q = query(collection(db, 'ca_doubts_chat'), orderBy('createdAt', 'asc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const loaded: DoubtMessage[] = [];
          const now = Date.now();
          const cutoff = now - TEN_DAYS_MS;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const createdAt = data.createdAt || now;
            
            // Delete expired docs (>10 days) asynchronously from Firestore
            if (createdAt < cutoff) {
              deleteDoc(doc(db, 'ca_doubts_chat', docSnap.id)).catch(() => {});
            } else {
              loaded.push({
                id: docSnap.id,
                studentName: data.studentName || 'Anonymous Student',
                text: data.text || '',
                attachmentUrl: data.attachmentUrl || '',
                attachmentName: data.attachmentName || '',
                attachmentType: data.attachmentType || 'file',
                createdAt,
                dateStr: data.dateStr || new Date(createdAt).toLocaleString()
              });
            }
          });

          setMessages(loaded);
          scrollToBottom();

          // Backup valid messages to localStorage
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loaded));
        },
        (err) => {
          console.warn('Firestore snapshot error, falling back to local storage:', err);
          loadLocalStorageBackup();
        }
      );
    } catch (e) {
      console.warn('Firestore not reachable, using local backup:', e);
      loadLocalStorageBackup();
    }

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const loadLocalStorageBackup = () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = filterValid10DayMessages(parsed);
          setMessages(valid);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(valid));
        }
      }
    } catch (err) {
      console.error('Failed to parse local storage doubts backup', err);
    }
  };

  // Handle file select (images/documents)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5MB limit check
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please choose a smaller picture or file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const isImg = file.type.startsWith('image/');
      setSelectedFile({
        url: result,
        name: file.name,
        type: isImg ? 'image' : 'file'
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!currentStudent || !currentStudent.trim()) {
      alert('⚠️ Student Name Required! Please select or type a student name in the top header before posting a doubt.');
      return;
    }

    if (!inputText.trim() && !selectedFile) {
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    const now = Date.now();
    const dateStr = new Date().toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newMessageData = {
      studentName: currentStudent.trim(),
      text: inputText.trim(),
      attachmentUrl: selectedFile?.url || '',
      attachmentName: selectedFile?.name || '',
      attachmentType: selectedFile?.type || 'file',
      createdAt: now,
      dateStr
    };

    try {
      // Try Firestore first
      const docRef = await addDoc(collection(db, 'ca_doubts_chat'), newMessageData);
      
      // Clear inputs
      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.warn('Firestore write failed, saving locally:', err);
      // Fallback local append
      const localMsg: DoubtMessage = {
        id: `local_${now}_${Math.random().toString(36).substring(2, 6)}`,
        ...newMessageData
      };
      const updated = filterValid10DayMessages([...messages, localMsg]);
      setMessages(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      scrollToBottom();
    } finally {
      setIsSending(false);
    }
  };

  // Handle Delete Message
  const handleDeleteMessage = async (msgId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Instantly remove from local state and localStorage for immediate visual response
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== msgId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Delete from Firestore
    try {
      if (msgId && !msgId.startsWith('local_')) {
        await deleteDoc(doc(db, 'ca_doubts_chat', msgId));
      }
    } catch (err) {
      console.warn('Firestore doc deletion error:', err);
    }
  };

  if (!isOpen) return null;

  const valid10DayCount = filterValid10DayMessages(messages).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full h-[85vh] max-h-[720px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Surveillance Warning Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white py-2 px-4 text-center font-extrabold text-xs tracking-wider shadow-md flex items-center justify-center gap-2 border-b border-red-800 shrink-0">
          <span className="text-base animate-bounce">🧐</span>
          <span className="uppercase">YOU ARE UNDER SURVIVALLENCE OF ARUN AND SUMAYYA 🧐</span>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-indigo-900 p-4 text-white flex items-center justify-between shrink-0 border-b border-indigo-600/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur border border-white/20">
              <MessageSquare className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Doubt Clearing Chat</h2>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Saved for 10 Days
                </span>
              </div>
              <p className="text-xs text-indigo-200">Ask questions, share doubt pictures & collaborate with mentors</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-indigo-100 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Name Guard Notice */}
        {!currentStudent || !currentStudent.trim() ? (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-900 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>⚠️ Please select or type your <strong>Student Name</strong> in the top header before asking a doubt!</span>
          </div>
        ) : (
          <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2 text-indigo-950 text-xs font-semibold flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Asking as student: <strong className="text-indigo-900 font-bold">{currentStudent}</strong></span>
            </div>
            <span className="text-[10px] text-indigo-600 font-medium">Auto-clears after 10 days</span>
          </div>
        )}

        {/* Chat Messages Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {valid10DayCount === 0 ? (
            <div className="text-center py-16 px-4 text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No doubts posted yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Be the first to post a study doubt or query! You can also attach pictures of study problems or notes.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = currentStudent && msg.studentName.toLowerCase() === currentStudent.trim().toLowerCase();

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Sender Name, Date & Waste Bin Delete Button */}
                  <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500">
                    <span className="font-bold text-indigo-900 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                      {msg.studentName}
                    </span>
                    <span>&bull;</span>
                    <span className="font-mono">{msg.dateStr}</span>
                    <span>&bull;</span>
                    {(isMe || isAdmin) && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMessage(msg.id, e)}
                        className="p-1 px-1.5 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-md transition cursor-pointer flex items-center gap-1 shadow-2xs font-bold"
                        title="Delete message and files permanently for everyone"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-bold">
                          {isAdmin && !isMe ? 'Delete (Admin)' : 'Delete'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-xs text-xs space-y-2 border ${
                      isMe
                        ? 'bg-indigo-600 text-white border-indigo-700 rounded-br-none'
                        : 'bg-white text-slate-800 border-slate-200 rounded-bl-none'
                    }`}
                  >
                    {/* Text content */}
                    {msg.text && (
                      <p className="whitespace-pre-wrap leading-relaxed font-medium">
                        {msg.text}
                      </p>
                    )}

                    {/* Attachment preview */}
                    {msg.attachmentUrl && (
                      <div className="pt-1">
                        {msg.attachmentType === 'image' ? (
                          <div className="rounded-lg overflow-hidden border border-black/10 bg-black/5 max-h-60">
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentName || 'Doubt image'}
                              className="w-full h-auto object-contain cursor-pointer hover:opacity-95 transition"
                              onClick={() => window.open(msg.attachmentUrl, '_blank')}
                            />
                          </div>
                        ) : (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold transition ${
                              isMe
                                ? 'bg-indigo-700/60 border-indigo-500 text-indigo-100 hover:bg-indigo-700'
                                : 'bg-slate-100 border-slate-200 text-indigo-700 hover:bg-slate-200'
                            }`}
                          >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate flex-1">{msg.attachmentName || 'Download File'}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-75" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* File Preview Bar if selected */}
        {selectedFile && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2 truncate">
              {selectedFile.type === 'image' ? (
                <ImageIcon className="w-4 h-4 text-amber-700 shrink-0" />
              ) : (
                <Paperclip className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <span className="font-bold truncate">Attached: {selectedFile.name}</span>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1 rounded text-amber-800 hover:text-rose-700 hover:bg-amber-200 transition cursor-pointer"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
        >
          {/* File Upload Hidden Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
            title="Attach picture or study document"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              currentStudent && currentStudent.trim()
                ? 'Type your doubt here...'
                : 'Select Student Name in top header first to type doubt'
            }
            disabled={!currentStudent || !currentStudent.trim()}
            className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isSending || (!inputText.trim() && !selectedFile) || !currentStudent || !currentStudent.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ask Doubt</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

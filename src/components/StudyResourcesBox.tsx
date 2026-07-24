import React, { useState, useEffect, useRef } from 'react';
import { GroupCategory, UserProfile } from '../types';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
} from 'firebase/firestore';
import {
  FolderOpen,
  Folder,
  FolderPlus,
  Upload,
  Download,
  ExternalLink,
  Edit3,
  Trash2,
  CheckCircle2,
  Eye,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  FileArchive,
  File as FileIcon,
  X,
  Check,
  RotateCcw,
  Plus,
  Info,
  Sparkles,
  Tag,
  Layers,
} from 'lucide-react';

export interface StudyResource {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  fileExtension: string;
  fileSize: number;
  dataUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  uploadedAtMs?: number;
  groupFilter?: GroupCategory;
  deletedBy: string[];
}

export interface StudentFolder {
  id: string;
  name: string;
  createdAt: number;
}

interface StudyResourcesBoxProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudent: string;
  currentGroupFilter: GroupCategory;
  currentUserProfile?: UserProfile | null;
}

export const StudyResourcesBox: React.FC<StudyResourcesBoxProps> = ({
  isOpen,
  onClose,
  currentStudent,
  currentGroupFilter,
  currentUserProfile,
}) => {
  const [resources, setResources] = useState<StudyResource[]>([]);

  const isAdmin =
    currentUserProfile?.email?.toLowerCase().trim() === 'johnbosco9947@gmail.com' ||
    currentUserProfile?.role === 'admin' ||
    currentUserProfile?.role === 'superadmin' ||
    (currentStudent && (currentStudent.toLowerCase().includes('arun') || currentStudent.toLowerCase().includes('admin')));
  const [downloadedIds, setDownloadedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ca_downloaded_resources');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [showHiddenModal, setShowHiddenModal] = useState<boolean>(false);

  // Per-Student Folders State
  const [folders, setFolders] = useState<StudentFolder[]>([]);
  const [resourceFolderMap, setResourceFolderMap] = useState<Record<string, string>>({}); // res.id -> folder.id
  const [activeFolderId, setActiveFolderId] = useState<string>('all'); // 'all' | 'uncategorized' | folderId
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load resources from Firestore or LocalStorage
  useEffect(() => {
    let unsubscribe = () => {};

    // First load from localStorage cache
    try {
      const cache = localStorage.getItem('ca_study_resources_cache');
      if (cache) {
        setResources(JSON.parse(cache));
      }
    } catch (e) {
      console.warn('Failed to load local study resources cache:', e);
    }

    if (db) {
      try {
        const q = query(collection(db, 'ca_study_resources'), orderBy('uploadedAt', 'desc'));
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const list: StudyResource[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as StudyResource;
              list.push({
                ...data,
                id: docSnap.id,
                deletedBy: Array.isArray(data.deletedBy) ? data.deletedBy : [],
              });
            });
            setResources(list);
            try {
              localStorage.setItem('ca_study_resources_cache', JSON.stringify(list));
            } catch (e) {
              console.warn('Failed to save study resources to local storage:', e);
            }
          },
          (err) => {
            console.warn('Firestore study resources error:', err);
          }
        );
      } catch (err) {
        console.warn('Study resources Firestore setup error:', err);
      }
    }

    return () => unsubscribe();
  }, []);

  // Load Per-Student Folders and Item Mapping from Firestore & LocalStorage
  useEffect(() => {
    if (!currentStudent) return;

    const studentKey = currentStudent.trim() || 'default_student';
    const storageKey = `ca_student_folders_${studentKey}`;

    // Load local cache first
    try {
      const localData = localStorage.getItem(storageKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed.folders)) setFolders(parsed.folders);
        if (parsed.resourceFolderMap && typeof parsed.resourceFolderMap === 'object') {
          setResourceFolderMap(parsed.resourceFolderMap);
        }
      }
    } catch (e) {
      console.warn('Failed to load local folders cache:', e);
    }

    // Subscribe to Firestore for per-student folder sync
    if (db) {
      try {
        const docRef = doc(db, 'ca_student_folders', studentKey);
        const unsub = onSnapshot(
          docRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const fList = Array.isArray(data.folders) ? data.folders : [];
              const fMap = data.resourceFolderMap || {};
              setFolders(fList);
              setResourceFolderMap(fMap);
              try {
                localStorage.setItem(
                  storageKey,
                  JSON.stringify({ folders: fList, resourceFolderMap: fMap })
                );
              } catch (e) {}
            }
          },
          (err) => {
            console.warn('Firestore folder subscription error:', err);
          }
        );
        return () => unsub();
      } catch (e) {
        console.warn('Firestore folder setup error:', e);
      }
    }
  }, [currentStudent]);

  // Helper to persist folder changes
  const saveStudentFolders = async (
    updatedFolders: StudentFolder[],
    updatedMap: Record<string, string>
  ) => {
    setFolders(updatedFolders);
    setResourceFolderMap(updatedMap);

    const studentKey = (currentStudent || 'default_student').trim();
    const storageKey = `ca_student_folders_${studentKey}`;

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ folders: updatedFolders, resourceFolderMap: updatedMap })
      );
    } catch (e) {}

    if (db && currentStudent) {
      try {
        await setDoc(
          doc(db, 'ca_student_folders', studentKey),
          {
            studentName: currentStudent,
            folders: updatedFolders,
            resourceFolderMap: updatedMap,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Failed to save student folders to Firestore:', e);
      }
    }
  };

  // Create new folder for current student
  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFolderName.trim()) return;

    if (!currentStudent) {
      alert('Please select or enter a student name first.');
      return;
    }

    const trimmedName = newFolderName.trim();
    const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newFolder: StudentFolder = {
      id: folderId,
      name: trimmedName,
      createdAt: Date.now(),
    };

    const updatedFolders = [...folders, newFolder];
    await saveStudentFolders(updatedFolders, resourceFolderMap);

    setActiveFolderId(folderId);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  // Assign resource to a specific folder (or uncategorized) for current student
  const handleAssignToFolder = async (resourceId: string, targetFolderId: string) => {
    if (targetFolderId === '__create_new__') {
      const folderName = window.prompt('Enter new folder name:');
      if (folderName && folderName.trim()) {
        const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newFolder: StudentFolder = {
          id: folderId,
          name: folderName.trim(),
          createdAt: Date.now(),
        };
        const updatedFolders = [...folders, newFolder];
        const updatedMap = { ...resourceFolderMap, [resourceId]: folderId };
        await saveStudentFolders(updatedFolders, updatedMap);
        setActiveFolderId(folderId);
      }
      return;
    }

    const updatedMap = { ...resourceFolderMap };
    if (!targetFolderId || targetFolderId === 'uncategorized') {
      delete updatedMap[resourceId];
    } else {
      updatedMap[resourceId] = targetFolderId;
    }

    await saveStudentFolders(folders, updatedMap);
  };

  // Delete folder (files move back to Uncategorized)
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (
      !window.confirm(
        `Delete folder "${folderName}"? Any files inside will be moved to Uncategorized.`
      )
    ) {
      return;
    }

    const updatedFolders = folders.filter((f) => f.id !== folderId);
    const updatedMap = { ...resourceFolderMap };
    Object.keys(updatedMap).forEach((resId) => {
      if (updatedMap[resId] === folderId) {
        delete updatedMap[resId];
      }
    });

    if (activeFolderId === folderId) {
      setActiveFolderId('all');
    }

    await saveStudentFolders(updatedFolders, updatedMap);
  };

  // Rename folder
  const handleSaveFolderRename = async (folderId: string) => {
    if (!editingFolderName.trim()) {
      setEditingFolderId(null);
      return;
    }

    const updatedFolders = folders.map((f) =>
      f.id === folderId ? { ...f, name: editingFolderName.trim() } : f
    );

    await saveStudentFolders(updatedFolders, resourceFolderMap);
    setEditingFolderId(null);
  };

  // Save downloaded IDs state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ca_downloaded_resources', JSON.stringify(downloadedIds));
    } catch (e) {
      console.warn('Failed to save downloaded IDs state:', e);
    }
  }, [downloadedIds]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get matching icon based on file type / extension
  const getFileIcon = (ext: string, mime: string) => {
    const e = (ext || '').toLowerCase();
    const m = (mime || '').toLowerCase();

    if (e === 'pdf') return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
    if (['doc', 'docx', 'txt', 'rtf'].includes(e)) return <FileText className="w-5 h-5 text-blue-500 shrink-0" />;
    if (['xls', 'xlsx', 'csv'].includes(e)) return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(e) || m.includes('image'))
      return <FileImage className="w-5 h-5 text-purple-500 shrink-0" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return <FileArchive className="w-5 h-5 text-amber-500 shrink-0" />;
    if (['js', 'ts', 'py', 'json', 'html', 'css'].includes(e)) return <FileCode className="w-5 h-5 text-indigo-500 shrink-0" />;

    return <FileIcon className="w-5 h-5 text-slate-400 shrink-0" />;
  };

  // Handle File Upload
  const handleFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!currentStudent) {
      alert('Please select or enter a student name first before uploading.');
      return;
    }

    setIsUploading(true);

    try {
      const newAssignedFolder = activeFolderId !== 'all' && activeFolderId !== 'uncategorized' ? activeFolderId : '';
      const updatedMap = { ...resourceFolderMap };

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Size check (max 8MB for smooth Base64 persistence)
        if (file.size > 8 * 1024 * 1024) {
          alert(`File "${file.name}" exceeds 8MB size limit. Please choose a smaller file.`);
          continue;
        }

        const extension = file.name.split('.').pop() || '';
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        // Convert to Base64
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const newId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const nowStr = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const nowMs = Date.now();
        const newResource: StudyResource = {
          id: newId,
          name: nameWithoutExt,
          originalName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileExtension: extension,
          fileSize: file.size,
          dataUrl,
          uploadedBy: currentStudent,
          uploadedAt: nowStr,
          uploadedAtMs: nowMs,
          groupFilter: currentGroupFilter,
          deletedBy: [],
        };

        if (newAssignedFolder) {
          updatedMap[newId] = newAssignedFolder;
        }

        // Save to Firestore
        if (db) {
          try {
            await setDoc(doc(db, 'ca_study_resources', newId), newResource);
          } catch (e) {
            console.warn('Failed to save resource to Firestore:', e);
          }
        }

        // Save to local state
        setResources((prev) => [newResource, ...prev]);
      }

      if (newAssignedFolder) {
        await saveStudentFolders(folders, updatedMap);
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('An error occurred while attaching the file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag and Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  // Start Renaming
  const handleStartRename = (res: StudyResource) => {
    setRenamingId(res.id);
    setRenameValue(res.name);
  };

  // Save Rename
  const handleSaveRename = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    const trimmedName = renameValue.trim();

    // Update state
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: trimmedName } : r))
    );

    // Update Firestore
    if (db) {
      try {
        await setDoc(doc(db, 'ca_study_resources', id), { name: trimmedName }, { merge: true });
      } catch (e) {
        console.warn('Error updating resource name in Firestore:', e);
      }
    }

    setRenamingId(null);
  };

  // Open / View file in browser window or tab
  const handleOpenResource = (res: StudyResource) => {
    try {
      const arr = res.dataUrl.split(',');
      if (arr.length < 2) return;
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : res.fileType || 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.click();
      }
    } catch (e) {
      console.error('Failed to open resource directly:', e);
      // Fallback
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe src="${res.dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
      }
    }
  };

  // Download file to disk
  const handleDownloadResource = (res: StudyResource, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const fileNameWithExt = res.fileExtension && !res.name.toLowerCase().endsWith(`.${res.fileExtension.toLowerCase()}`)
      ? `${res.name}.${res.fileExtension}`
      : res.name;

    const link = document.createElement('a');
    link.href = res.dataUrl;
    link.download = fileNameWithExt;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Mark as downloaded for current browser user
    setDownloadedIds((prev) => ({
      ...prev,
      [res.id]: true,
    }));
  };

  // Action on Clicking main item card or primary button
  const handleResourceCardClick = (res: StudyResource) => {
    const isDownloaded = downloadedIds[res.id];
    if (isDownloaded) {
      handleOpenResource(res);
    } else {
      handleDownloadResource(res);
    }
  };

  // Soft Delete for current student
  const handleDeleteForMe = async (res: StudyResource, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentStudent) {
      alert('Please select a student name first.');
      return;
    }

    const confirmDelete = window.confirm(
      `Remove "${res.name}" from your view? (Note: It will remain visible for other students).`
    );

    if (!confirmDelete) return;

    const updatedDeletedBy = Array.from(new Set([...(res.deletedBy || []), currentStudent]));

    setResources((prev) =>
      prev.map((r) => (r.id === res.id ? { ...r, deletedBy: updatedDeletedBy } : r))
    );

    if (db) {
      try {
        await setDoc(
          doc(db, 'ca_study_resources', res.id),
          { deletedBy: arrayUnion(currentStudent) },
          { merge: true }
        );
      } catch (e) {
        console.warn('Error soft deleting resource in Firestore:', e);
      }
    }
  };

  // Permanent Delete for Admin Users
  const handlePermanentDelete = async (res: StudyResource, e: React.MouseEvent) => {
    e.stopPropagation();

    const confirmDelete = window.confirm(
      `[ADMIN PERMANENT DELETE] Are you sure you want to delete "${res.name}" permanently for ALL students?`
    );

    if (!confirmDelete) return;

    // Remove locally
    setResources((prev) => prev.filter((r) => r.id !== res.id));

    // Delete from Firestore
    if (db) {
      try {
        await deleteDoc(doc(db, 'ca_study_resources', res.id));
      } catch (err) {
        console.warn('Error deleting study resource from Firestore:', err);
      }
    }
  };

  // Restore resource for current student
  const handleRestoreResource = async (res: StudyResource) => {
    const updatedDeletedBy = (res.deletedBy || []).filter((s) => s !== currentStudent);

    setResources((prev) =>
      prev.map((r) => (r.id === res.id ? { ...r, deletedBy: updatedDeletedBy } : r))
    );

    if (db) {
      try {
        await setDoc(
          doc(db, 'ca_study_resources', res.id),
          { deletedBy: updatedDeletedBy },
          { merge: true }
        );
      } catch (e) {
        console.warn('Error restoring resource in Firestore:', e);
      }
    }
  };

  // Visible resources (not soft-deleted by student)
  const visibleResources = resources.filter(
    (r) => !(r.deletedBy || []).includes(currentStudent)
  );

  const hiddenResources = resources.filter((r) =>
    (r.deletedBy || []).includes(currentStudent)
  );

  // Filter visible resources by active folder
  const displayedResources = visibleResources.filter((r) => {
    if (activeFolderId === 'all') return true;
    if (activeFolderId === 'uncategorized') return !resourceFolderMap[r.id];
    return resourceFolderMap[r.id] === activeFolderId;
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-5xl w-full my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Box Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <FolderOpen className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Study Resources & Personal Folders
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/30 border border-indigo-400/30 text-indigo-100 rounded-full">
                  {visibleResources.length} {visibleResources.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80">
                Organize shared attachments into your custom folders ({currentStudent || 'Student'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hiddenResources.length > 0 && (
              <button
                onClick={() => setShowHiddenModal(!showHiddenModal)}
                className="px-2.5 py-1.5 text-xs font-medium bg-indigo-950/60 hover:bg-indigo-950/80 text-indigo-200 border border-indigo-700/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="View items hidden by you"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Hidden ({hiddenResources.length})
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {isUploading ? 'Uploading...' : 'Attach File'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFilesUpload(e.target.files)}
              className="hidden"
              multiple
            />

            <button
              onClick={onClose}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-800/80 rounded-lg transition-colors ml-1 cursor-pointer"
              title="Close Study Resources"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-75px)] flex flex-col">

          {/* Folder Navigation Tabs Bar */}
          <div className="bg-slate-100/80 border-b border-slate-200 px-4 py-3 shrink-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Folder className="w-4 h-4 text-indigo-600" />
                <span>My Personal Resource Folders</span>
                <span className="text-[10px] font-normal text-slate-500">
                  (Folders are customized specifically for {currentStudent || 'you'})
                </span>
              </div>

              {!isCreatingFolder && (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Folder</span>
                </button>
              )}
            </div>

            {/* Inline Form to Create New Folder */}
            {isCreatingFolder && (
              <form
                onSubmit={handleCreateFolder}
                className="mb-3 p-2.5 bg-white border border-indigo-200 rounded-xl shadow-xs flex items-center gap-2"
              >
                <FolderPlus className="w-4 h-4 text-indigo-600 shrink-0" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Audit Notes, Taxation Revision..."
                  autoFocus
                  className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Folder Pills List */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {/* All Files Pill */}
              <button
                onClick={() => setActiveFolderId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeFolderId === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Files ({visibleResources.length})</span>
              </button>

              {/* Uncategorized Pill */}
              <button
                onClick={() => setActiveFolderId('uncategorized')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeFolderId === 'uncategorized'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Uncategorized (
                  {visibleResources.filter((r) => !resourceFolderMap[r.id]).length})
                </span>
              </button>

              {/* Custom Student Folders */}
              {folders.map((folder) => {
                const isEditing = editingFolderId === folder.id;
                const itemCount = visibleResources.filter(
                  (r) => resourceFolderMap[r.id] === folder.id
                ).length;
                const isActive = activeFolderId === folder.id;

                if (isEditing) {
                  return (
                    <div
                      key={folder.id}
                      className="flex items-center gap-1 bg-white border border-indigo-300 rounded-xl px-2 py-1 shrink-0"
                    >
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveFolderRename(folder.id);
                          if (e.key === 'Escape') setEditingFolderId(null);
                        }}
                        autoFocus
                        className="text-xs font-medium border-0 focus:outline-none w-28 bg-transparent"
                      />
                      <button
                        onClick={() => handleSaveFolderRename(folder.id)}
                        className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingFolderId(null)}
                        className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={folder.id} className="relative group shrink-0 flex items-center">
                    <button
                      onClick={() => setActiveFolderId(folder.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-800 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-200' : 'text-amber-500'}`} />
                      <span>{folder.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          isActive
                            ? 'bg-indigo-700 text-indigo-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {itemCount}
                      </span>
                    </button>

                    {/* Quick Folder Actions (Rename / Delete) */}
                    {isActive && (
                      <div className="flex items-center gap-0.5 ml-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Rename folder"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFolder(folder.id, folder.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete folder"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="p-5 space-y-4 flex-1">
            {/* Upload Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/80 scale-[0.99]'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-700">
                    Click or drag & drop files here to upload resources
                    {activeFolderId !== 'all' && activeFolderId !== 'uncategorized' && (
                      <span className="text-indigo-600 font-bold ml-1">
                        (Directly into folder "{folders.find((f) => f.id === activeFolderId)?.name}")
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports PDFs, Notes, Spreadsheets, Images, Zip archives (Max 8MB per file)
                  </p>
                </div>
              </div>
            </div>

            {/* Resources List */}
            {displayedResources.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
                <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No attachments in this folder</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Assign attachments into this folder using the folder selector dropdown on any file card, or upload new files above!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {displayedResources.map((res) => {
                  const isDownloaded = !!downloadedIds[res.id];
                  const isRenaming = renamingId === res.id;
                  const currentAssignedFolderId = resourceFolderMap[res.id] || 'uncategorized';
                  const currentAssignedFolder = folders.find((f) => f.id === currentAssignedFolderId);

                  return (
                    <div
                      key={res.id}
                      onClick={() => !isRenaming && handleResourceCardClick(res)}
                      className={`group relative border rounded-xl p-3.5 transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer ${
                        isDownloaded
                          ? 'bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-300 hover:shadow-sm'
                          : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                    >
                      {/* Top Header: Icon + Name + Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {getFileIcon(res.fileExtension, res.fileType)}

                          <div className="min-w-0 flex-1">
                            {isRenaming ? (
                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(res.id);
                                    if (e.key === 'Escape') setRenamingId(null);
                                  }}
                                  autoFocus
                                  className="text-xs font-medium border border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 w-full bg-white"
                                />
                                <button
                                  onClick={() => handleSaveRename(res.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="Save Name"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setRenamingId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="text-xs font-bold text-slate-800 truncate block group-hover:text-indigo-600 transition-colors"
                                    title={res.name}
                                  >
                                    {res.name}
                                  </span>
                                  {res.fileExtension && (
                                    <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                      {res.fileExtension}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {formatFileSize(res.fileSize)} &bull; Uploaded by{' '}
                                  <span className="font-semibold text-slate-600">{res.uploadedBy}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div
                          className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isRenaming && (
                            <button
                              onClick={() => handleStartRename(res)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Rename file"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={(e) => handleDeleteForMe(res, e)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete for me (remains visible for others)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={(e) => handlePermanentDelete(res, e)}
                              className="p-1 px-1.5 bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 rounded transition-colors flex items-center gap-1 font-bold text-[10px]"
                              title="[ADMIN] Delete permanently for ALL students"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete (Admin)</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Folder Selection Bar */}
                      <div
                        className="flex items-center justify-between bg-slate-50/80 p-1.5 rounded-lg border border-slate-100 text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
                          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-[10px] uppercase font-bold text-slate-400">Folder:</span>
                          <span className="font-bold text-indigo-900 truncate">
                            {currentAssignedFolder ? currentAssignedFolder.name : 'Uncategorized'}
                          </span>
                        </div>

                        <select
                          value={currentAssignedFolderId}
                          onChange={(e) => handleAssignToFolder(res.id, e.target.value)}
                          className="text-[11px] font-semibold bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-md px-2 py-0.5 text-slate-700 cursor-pointer"
                        >
                          <option value="uncategorized">📂 Uncategorized</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              📁 {f.name}
                            </option>
                          ))}
                          <option value="__create_new__">➕ + Create New Folder...</option>
                        </select>
                      </div>

                      {/* Bottom Bar: Download/Open Status & Action Buttons */}
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        {isDownloaded ? (
                          <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Downloaded (Click to open)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Download className="w-3.5 h-3.5 text-slate-400" />
                            <span>Click to download</span>
                          </div>
                        )}

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isDownloaded ? (
                            <>
                              <button
                                onClick={() => handleOpenResource(res)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors flex items-center gap-1"
                                title="Open resource in new browser tab"
                              >
                                <Eye className="w-3 h-3" />
                                Open
                              </button>
                              <button
                                onClick={(e) => handleDownloadResource(res, e)}
                                className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1"
                                title="Download file again"
                              >
                                <Download className="w-3 h-3" />
                                Re-download
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => handleDownloadResource(res, e)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-2xs transition-colors flex items-center gap-1"
                              title="Download file to device"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info Note on Folder organization */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex items-start gap-2.5 text-xs text-slate-500">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-slate-700">Folder Organization:</span> Each student
                can create custom folders (e.g., Audit Notes, Law, Revision Summaries) and organize any shared attachments into them. Your folder organization is completely personal to your account!
              </p>
            </div>
          </div>

          {/* Modal for viewing/restoring items hidden by current student */}
          {showHiddenModal && (
            <div className="p-4 bg-amber-50/70 border-t border-amber-200 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  Resources hidden for {currentStudent} ({hiddenResources.length}):
                </span>
                <button
                  onClick={() => setShowHiddenModal(false)}
                  className="text-amber-700 hover:text-amber-900 font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-amber-800 mb-3">
                These files were deleted by you for your view, but remain active for all other users. Click Restore to show them again.
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {hiddenResources.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200/80 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getFileIcon(res.fileExtension, res.fileType)}
                      <span className="font-semibold text-slate-700 truncate">{res.name}</span>
                      <span className="text-[10px] text-slate-400">({formatFileSize(res.fileSize)})</span>
                    </div>
                    <button
                      onClick={() => handleRestoreResource(res)}
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore to my view
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


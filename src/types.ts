export type GroupCategory = 'Not Selected' | 'Both' | 'First Group' | 'Second Group';

export type PaperName = 
  | 'Paper 1' 
  | 'Paper 2' 
  | 'Paper 3' 
  | 'Paper 4A' 
  | 'Paper 4B' 
  | 'Paper 5A' 
  | 'Paper 5B' 
  | 'Paper 6';

export interface TopicDefinition {
  topicName: string;
  paper: PaperName;
}

export type TopicDifficulty = 'Easy' | 'Average' | 'Tough' | 'Tricky' | '';

export interface TopicProgressState {
  completed: boolean;
  schDate: string; // YYYY-MM-DD
  covDate: string; // YYYY-MM-DD
  evaluated: boolean;
  revisions: number;
  difficulty?: TopicDifficulty;
  lastRevisionDate?: string; // YYYY-MM-DD
}

export interface StudentProgressRecord {
  studentName: string;
  groupFilter: GroupCategory;
  topicsData: Record<string, TopicProgressState>;
  lastUpdated?: any;
}

export interface UserProfile {
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  groupPreparingFor: GroupCategory;
  registeredAt: string;
  photoURL?: string;
  role?: 'student' | 'admin' | 'superadmin';
}

export interface AdminRequest {
  id: string;
  email: string;
  fullName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  reason?: string;
}

export interface PaperStat {
  paper: PaperName;
  covered: number;
  total: number;
  percent: number;
}

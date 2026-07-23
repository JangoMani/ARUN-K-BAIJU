import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import { TOPICS_DATA, STUDENTS_LIST } from '../data/studentsAndTopics';
import { TopicProgressState, GroupCategory, PaperName, StudentProgressRecord } from '../types';

// Initialize Firebase App for Workspace Google OAuth
const app = getApps().length === 0 ? initializeApp(firebaseAppletConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Google Workspace Scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://mail.google.com/');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Google Access Token');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Helper to determine paper group
function getPaperGroup(paper: PaperName): 'First Group' | 'Second Group' {
  return ['Paper 1', 'Paper 2', 'Paper 3'].includes(paper) ? 'First Group' : 'Second Group';
}

// Export Syllabus Progress to Google Sheets
export async function createOrUpdateSyllabusSpreadsheet(
  studentName: string,
  topicsData: Record<string, TopicProgressState>,
  groupFilter: GroupCategory,
  accessToken: string,
  existingSpreadsheetId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // Title for the spreadsheet
  const title = `CA Final Syllabus Progress - ${studentName || 'Student'}`;

  // Filter topics based on groupFilter
  const filteredTopics = TOPICS_DATA.filter((topic) => {
    const group = getPaperGroup(topic.paper);
    if (groupFilter === 'First Group') return group === 'First Group';
    if (groupFilter === 'Second Group') return group === 'Second Group';
    return true;
  });

  // Calculate statistics
  let completedCount = 0;
  const rows: (string | number)[][] = [
    ['CA FINAL SYLLABUS PROGRESS TRACKER'],
    [`Student Name:`, studentName || 'Not Specified'],
    [`Group Category:`, groupFilter],
    [`Export Date:`, new Date().toLocaleString()],
    [''],
    [
      'Paper Name',
      'Group',
      'Topic / Chapter Name',
      'Completion Status',
      'Difficulty Level',
      'Scheduled Date',
      'Covered Date',
      'Evaluated Test',
      'Revision Count',
      'Status Summary'
    ]
  ];

  filteredTopics.forEach((topic) => {
    const state = topicsData[topic.topicName] || {
      completed: false,
      schDate: '',
      covDate: '',
      evaluated: false,
      revisions: 0
    };

    if (state.completed) completedCount++;

    const groupStr = getPaperGroup(topic.paper);
    const statusText = state.completed
      ? state.revisions > 0
        ? `Completed & Revised (${state.revisions}x)`
        : 'Completed'
      : 'Pending';

    rows.push([
      topic.paper,
      groupStr,
      topic.topicName,
      state.completed ? 'COMPLETED' : 'PENDING',
      state.difficulty || '-',
      state.schDate || '-',
      state.covDate || '-',
      state.evaluated ? 'YES' : 'NO',
      state.revisions || 0,
      statusText
    ]);
  });

  const totalTopics = filteredTopics.length;
  const percentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

  // Insert summary rows near the top
  rows.splice(4, 0, [
    `Total Topics: ${totalTopics}`,
    `Completed: ${completedCount}`,
    `Pending: ${totalTopics - completedCount}`,
    `Overall Progress: ${percentage}%`
  ]);

  let spreadsheetId = existingSpreadsheetId;

  if (!spreadsheetId) {
    // Create new spreadsheet via Sheets API
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title
        },
        sheets: [
          {
            properties: {
              title: 'Syllabus Tracker',
              gridProperties: {
                frozenRowCount: 7
              }
            }
          }
        ]
      })
    });

    if (!createRes.ok) {
      const errJson = await createRes.json();
      throw new Error(`Sheets API create error: ${errJson.error?.message || createRes.statusText}`);
    }

    const createData = await createRes.json();
    spreadsheetId = createData.spreadsheetId;
  }

  // Update spreadsheet values
  const range = `'Syllabus Tracker'!A1:I${rows.length + 10}`;
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows
      })
    }
  );

  if (!updateRes.ok) {
    const errJson = await updateRes.json();
    throw new Error(`Sheets API update error: ${errJson.error?.message || updateRes.statusText}`);
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  return { spreadsheetId: spreadsheetId!, spreadsheetUrl };
}

// Download Syllabus as CSV file for opening in Google Sheets or Excel
export function downloadSyllabusCSV(
  studentName: string,
  topicsData: Record<string, TopicProgressState>,
  groupFilter: GroupCategory
) {
  const filteredTopics = TOPICS_DATA.filter((topic) => {
    const group = getPaperGroup(topic.paper);
    if (groupFilter === 'First Group') return group === 'First Group';
    if (groupFilter === 'Second Group') return group === 'Second Group';
    return true;
  });

  const headers = [
    'Student Name',
    'Group Category',
    'Paper',
    'Topic Name',
    'Difficulty Level',
    'Revisions Done',
    'Scheduled Date',
    'Covered Date',
    'Completed',
    'Evaluated'
  ];
  const rows = filteredTopics.map((topic) => {
    const state = topicsData[topic.topicName] || {
      completed: false,
      schDate: '',
      covDate: '',
      evaluated: false,
      revisions: 0,
      difficulty: ''
    };
    const group = getPaperGroup(topic.paper);
    return [
      `"${(studentName || 'Student').replace(/"/g, '""')}"`,
      `"${groupFilter}"`,
      `"${topic.paper}"`,
      `"${topic.topicName.replace(/"/g, '""')}"`,
      `"${state.difficulty || 'Not Set'}"`,
      `"${state.revisions || 0}"`,
      `"${state.schDate || ''}"`,
      `"${state.covDate || ''}"`,
      `"${state.completed ? 'Yes' : 'No'}"`,
      `"${state.evaluated ? 'Yes' : 'No'}"`
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `CA_Final_Syllabus_${(studentName || 'Student').replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export Master Report for ALL students in CSV format
export function downloadAllStudentsMasterCSV(
  studentStoreCache: Record<string, StudentProgressRecord> = {}
) {
  const csvRows: string[] = [];

  // Header row
  csvRows.push(
    [
      'Student Name',
      'Group Category',
      'Paper',
      'Topic Name',
      'Difficulty Level',
      'Revisions Done',
      'Scheduled Date',
      'Covered Date',
      'Completed',
      'Evaluated',
    ]
      .map((header) => `"${header}"`)
      .join(',')
  );

  let totalRows = 0;

  STUDENTS_LIST.forEach((name) => {
    const record = studentStoreCache[name] || { groupFilter: 'Not Selected', topicsData: {} };
    const gFilter = record.groupFilter || 'Both';

    let nameScope = TOPICS_DATA;
    if (gFilter === 'First Group') {
      nameScope = TOPICS_DATA.filter((t) => ['Paper 1', 'Paper 2', 'Paper 3'].includes(t.paper));
    } else if (gFilter === 'Second Group') {
      nameScope = TOPICS_DATA.filter((t) =>
        ['Paper 4A', 'Paper 4B', 'Paper 5A', 'Paper 5B', 'Paper 6'].includes(t.paper)
      );
    }

    nameScope.forEach((topic) => {
      const tState = record.topicsData[topic.topicName] || {
        completed: false,
        schDate: '',
        covDate: '',
        evaluated: false,
        revisions: 0,
        difficulty: '',
      };

      const escapeCsv = (val: string | number | boolean) => {
        const str = String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      };

      const row = [
        escapeCsv(name),
        escapeCsv(gFilter),
        escapeCsv(topic.paper),
        escapeCsv(topic.topicName),
        escapeCsv(tState.difficulty || 'Not Set'),
        escapeCsv(tState.revisions || 0),
        escapeCsv(tState.schDate || ''),
        escapeCsv(tState.covDate || ''),
        escapeCsv(tState.completed ? 'Yes' : 'No'),
        escapeCsv(tState.evaluated ? 'Yes' : 'No'),
      ];

      csvRows.push(row.join(','));
      totalRows++;
    });
  });

  if (totalRows === 0) {
    alert('No student progress data available to export.');
    return;
  }

  const csvContent = csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `CA_Final_All_Students_Master_Report_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Gmail API Helper: Get Profile
export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string; messagesTotal: number }> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(`Gmail Profile API error: ${errJson.error?.message || res.statusText}`);
  }

  return await res.json();
}

// Gmail API Helper: Send Email Message
export async function sendGmailProgressEmail({
  recipientEmail,
  subject,
  bodyText,
  htmlContent,
  accessToken
}: {
  recipientEmail: string;
  subject: string;
  bodyText: string;
  htmlContent?: string;
  accessToken: string;
}): Promise<{ id: string; threadId: string }> {
  const nl = '\r\n';
  let message = '';
  message += `To: ${recipientEmail}${nl}`;
  message += `Subject: ${subject}${nl}`;
  message += `MIME-Version: 1.0${nl}`;

  if (htmlContent) {
    message += `Content-Type: text/html; charset=utf-8${nl}${nl}`;
    message += htmlContent;
  } else {
    message += `Content-Type: text/plain; charset=utf-8${nl}${nl}`;
    message += bodyText;
  }

  // Base64URL encode MIME message
  const base64 = btoa(unescape(encodeURIComponent(message)));
  const raw = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(`Gmail API send error: ${errJson.error?.message || res.statusText}`);
  }

  return await res.json();
}

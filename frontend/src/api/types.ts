export type Role = 'RRHH' | 'JEFE' | 'COLABORADOR' | 'DUENO';

export interface Branch {
  id: string;
  name: string;
}

export interface ImportanceLevel {
  id: string;
  label: string;
  relativeWeight: number;
  colorHex: string;
  isActive: boolean;
}

export interface EmployeeProfile {
  officialPosition: string;
  gratificationMaxMonthly: number;
  programStartDate: string;
  branchId?: string | null;
  branch?: Branch | null;
}

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: Role;
  directBossId?: string | null;
  directBoss?: { id: string; fullName: string } | null;
  isActive: boolean;
  profile?: EmployeeProfile | null;
}

export interface Period {
  id: string;
  year: number;
  month: number;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'AUTO_CLOSED';
  _count?: { objectives: number; selfEvaluations: number; results: number };
}

export interface Objective {
  id: string;
  periodId: string;
  employeeId: string;
  description: string;
  metric?: string | null;
  importanceLevelId: string;
  relativeWeight: number;
  points: number;
  importanceLevel: ImportanceLevel;
}

export interface AuditEntry {
  id: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedAt: string;
  objective?: { id: string; description: string };
  changedBy?: { id: string; fullName: string } | null;
}

export type Scale = 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'NO_CUMPLIDO';

export interface MyEvaluationItem {
  objectiveId: string;
  scale: Scale;
  percent: number;
  comment?: string | null;
}

export interface MyCurrentEvaluation {
  period: { id: string; year: number; month: number; status: string } | null;
  objectives: Objective[];
  selfEvaluation?: {
    id: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED';
    submittedAt?: string | null;
    items: MyEvaluationItem[];
  } | null;
  result?: { finalAmount: number; closeReason: string } | null;
  projected?: {
    amount: number | null;
    potentialMax?: number | null;
    totalPoints?: number | null;
    isFinal: boolean;
    daysToClose: number;
  };
}

export interface HistoryMonth {
  month: number;
  points: number | null;
  rank: number | null;
  total: number;
}

export interface MyHistory {
  year: number;
  availableYears: number[];
  months: HistoryMonth[];
  yearAverage: number | null;
  yearRank: number | null;
  yearTotal: number;
}

export interface TeamMemberHistory {
  employeeId: string;
  fullName: string;
  position: string;
  months: { month: number; points: number | null }[];
  yearAverage: number | null;
}

export interface TeamHistory {
  year: number;
  availableYears: number[];
  members: TeamMemberHistory[];
}

export interface HistoryDetailItem {
  objectiveId: string;
  description: string;
  scale: Scale;
  comment: string | null;
}

export interface HistoryDetail {
  year: number;
  month: number;
  periodStatus: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'AUTO_CLOSED';
  source: 'VALIDATOR' | 'SELF' | null;
  items: HistoryDetailItem[];
}

export interface PendingValidation {
  id: string;
  submittedAt?: string | null;
  period: Period;
  employee: {
    id: string;
    fullName: string;
    email: string;
    profile?: { officialPosition: string; branch?: Branch | null } | null;
  };
}

export interface ValidationDetail {
  selfEvaluation: {
    id: string;
    status: string;
    employeeId: string;
    items: MyEvaluationItem[];
    period: Period;
    employee: {
      id: string;
      fullName: string;
      email: string;
      profile?: {
        officialPosition: string;
        gratificationMaxMonthly: number;
        programStartDate: string;
        branch?: Branch | null;
      } | null;
    };
    validation?: {
      justification: string;
      decidedAt: string;
      items: { objectiveId: string; scale: Scale; percent: number }[];
    } | null;
  };
  objectives: Objective[];
}

export interface LeaderboardRow {
  employeeId: string;
  fullName: string;
  officialPosition: string;
  branch: string;
  average: number;
  periods: number;
}

export interface Heatmap {
  branches: string[];
  rows: { level: string; color: string; cells: (number | null)[] }[];
}

export interface ReceiptRow {
  id: string;
  folio: string;
  pdfPath: string;
  result: {
    finalAmount: number;
    employee: { id: string; fullName: string; email: string };
    period: Period;
  };
}

export interface PeriodResultRow {
  id: string;
  finalAmount: number;
  closeReason: string;
  employee: { id: string; fullName: string; email: string };
  period: Period;
  receipt?: { id: string; folio: string } | null;
}

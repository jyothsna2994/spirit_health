export type Flag = "low" | "high" | "normal" | "abnormal" | "unknown";

export type Category =
  | "prescription"
  | "lab_report"
  | "discharge_summary"
  | "diagnostic_report"
  | "imaging_report"
  | "consultation_note"
  | "other";

export type TestResult = {
  name: string;
  canonicalName?: string;
  value: string;
  numericValue: number | null;
  unit: string;
  referenceRange: string;
  refLow: number | null;
  refHigh: number | null;
  flag: Flag;
  status?: string;
};

export type Medicine = {
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions?: string;
};

export type HealthRecord = {
  id: string;
  category: Category;
  documentType: string;
  title: string;
  documentDate: string;
  dateFromDocument?: boolean;
  patientName?: string;
  provider?: { hospital?: string; doctor?: string };
  medicines: Medicine[];
  tests: TestResult[];
  diagnoses: string[];
  advice: string[];
  followUp?: string;
  abnormalFindings: { finding: string; explanation: string }[];
  summaries: Record<string, string>;
  summaryStatus?: "ready" | "pending";
  languagesDetected?: string[];
  handwritten?: boolean;
  extractionNotes?: string;
  mode?: string;
};

export type TimelineEvent = {
  id: string;
  date: string;
  category: Category;
  documentType: string;
  title: string;
  dateFromDocument?: boolean;
  doctor: string;
  hospital: string;
  summary: string;
  highlights: string[];
  counts: { medicines: number; tests: number; abnormal: number; diagnoses: number };
  abnormalTests: { name: string; flag: Flag }[];
  diagnoses: string[];
  medicines: string[];
  handwritten: boolean;
  mock: boolean;
};

export type Abha = { number: string; address: string; linkedAt?: string; mock: boolean };

export type ProfileLab = {
  key: string;
  name: string;
  value: string;
  numericValue: number | null;
  unit: string;
  referenceRange: string;
  refLow: number | null;
  refHigh: number | null;
  flag: Flag;
  date: string;
  recordId: string;
  readings: number;
  change: "up" | "down" | "same" | null;
  previous: { value: string; numericValue: number | null; flag: Flag; date: string } | null;
};

export type ProfileMedicine = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedOn: string;
  endsOn: string | null;
  status: "active" | "past" | "completed";
  recordId: string;
};

export type Profile = {
  user: {
    id: string;
    fullName: string;
    email: string;
    age: string;
    gender: string;
    dateOfBirth: string | null;
    preferredLanguage: string;
    abha: Abha | null;
  };
  stats: {
    records: number;
    byCategory: Record<string, number>;
    firstRecordDate: string | null;
    lastRecordDate: string | null;
    abnormalLabs: number;
  };
  medicines: ProfileMedicine[];
  conditions: { name: string; firstSeen: string; lastSeen: string; mentions: number; recordId: string }[];
  labs: ProfileLab[];
};

export type Trend = {
  key: string;
  name: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  referenceRange: string;
  points: { date: string; value: number; flag: Flag; recordId: string }[];
};

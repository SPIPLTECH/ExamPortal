/**
 * Barrel for all Mongoose models. Importing from here guarantees every model
 * is registered (so `ref` population works regardless of import order).
 */
export { User, type IUser } from "./User";
export { ALCCenter, type IALCCenter } from "./ALCCenter";
export { StudentProfile, type IStudentProfile } from "./StudentProfile";
export { Question, type IQuestion, type IQuestionOption } from "./Question";
export { Test, type ITest, type ICategoryRule } from "./Test";
export { TestEnrollment, type ITestEnrollment } from "./TestEnrollment";
export {
  ExamAttempt,
  type IExamAttempt,
  type IFrozenQuestion,
  type IFrozenOption,
} from "./ExamAttempt";
export { ExamResponse, type IExamResponse } from "./ExamResponse";
export { ExamResult, type IExamResult, type ICategoryBreakdown } from "./ExamResult";
export { ProctoringSession, type IProctoringSession } from "./ProctoringSession";
export {
  ProctoringEvent,
  type IProctoringEvent,
  PROCTORING_EVENT_TYPES,
  type ProctoringEventType,
} from "./ProctoringEvent";
export { ProctoringEvidence, type IProctoringEvidence } from "./ProctoringEvidence";
export { MSCITEnquiry, type IMSCITEnquiry } from "./MSCITEnquiry";
export { AuditLog, type IAuditLog } from "./AuditLog";
export { Notification, type INotification } from "./Notification";
export { SystemSetting, type ISystemSetting } from "./SystemSetting";
export { TermsVersion, type ITermsVersion } from "./TermsVersion";

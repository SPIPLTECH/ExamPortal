/** Terms & Conditions shown on the registration popup and the /terms page. */

export const TERMS_VERSION = "v1";
export const TERMS_UPDATED = "2026-11-21";

export type TermsSection = { heading: string; points: string[] };

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: "1. Acceptance of Terms",
    points: [
      "By creating an account and using this examination portal, you agree to these Terms and Conditions.",
      "If you do not agree with any part of these terms, please do not register or take any examination.",
    ],
  },
  {
    heading: "2. Account & Eligibility",
    points: [
      "You must provide accurate, complete and current information during registration.",
      "You are responsible for keeping your login credentials confidential; do not share your password with anyone.",
      "One account per student. Creating multiple accounts or impersonating another person is prohibited.",
      "You must be enrolled with a valid center to appear for that center's examinations.",
    ],
  },
  {
    heading: "3. Examination Rules & Fair Conduct",
    points: [
      "You will attempt each examination honestly and independently, without any external help.",
      "Each student is served a random set of questions; attempting to copy, share or distribute questions or answers is strictly forbidden.",
      "An examination may be attempted only once. Retakes are not allowed unless explicitly granted.",
      "The examination timer is controlled by the server; your exam is submitted automatically when time ends.",
      "Any use of unfair means may lead to your attempt being cancelled and your account being suspended.",
    ],
  },
  {
    heading: "4. Proctoring & Monitoring",
    points: [
      "Some examinations are proctored. When enabled, your camera is used to monitor you during the exam and you must grant camera access to begin.",
      "During a proctored exam the system detects tab switching, leaving fullscreen, a missing face, more than one person, and prohibited objects such as mobile phones.",
      "Repeated violations will issue warnings and may automatically end and submit your examination.",
      "Captured identity photos and snapshots are stored securely as examination evidence and may be reviewed by authorised staff.",
    ],
  },
  {
    heading: "5. Use of Your Data & Communication",
    points: [
      "We will use your data (phone number and email) to send you daily new updates, examination notifications, results and other important information.",
      "Your profile photo and proctoring evidence are stored securely and used only for identity verification and examination integrity.",
      "We do not sell your personal data to third parties.",
    ],
  },
  {
    heading: "6. Results",
    points: [
      "Examination results are generated automatically and made available in your account as per the result-release policy.",
      "Correct answers are not revealed during the examination and are shown only after submission where permitted.",
    ],
  },
  {
    heading: "7. Changes to These Terms",
    points: [
      "These Terms may be updated from time to time. Continued use of the portal after an update means you accept the revised Terms.",
    ],
  },
];

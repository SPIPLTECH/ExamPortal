/**
 * Seed for the "Data-tech Systems" center.
 *
 *   npm run seed:datatech            (add --force if students already attempted its tests)
 *   npm run seed:datatech -- --dry-run   (validate the Excel data only, touches nothing)
 *
 * Creates / refreshes:
 *   • center "Data-tech Systems" + login  username: datatechsystems  password: Avinash@12345
 *   • Class 5 … 10: one test each ("Class 5th Test" …)
 *   • Class 11 & 12: one test PER STREAM (Science / Commerce / Arts)  → 6 tests
 *   • every test: 25 questions per student, drawn at random from the full class pool, in the
 *     exact subject split, with shuffled question order AND shuffled options (different for each student)
 *   • standard rules & instructions on every test
 *   • camera proctoring DISABLED, but FULL-SCREEN LOCK ON: 4 chances, then the exam is auto-submitted
 *     (the center can change all of this later in Tests → Edit)
 * Only this center's own tests / questions are replaced. Other centers are untouched.
 */
import "dotenv/config";
import { seedExams } from "./seed-exams";

const CHANCES = 4;

const instructions =
  "1. Choose your language (English / Marathi) and press Start exam. The timer starts immediately and cannot be paused.\n" +
  "2. The paper has 25 multiple-choice questions. Every question carries 1 mark. There is NO negative marking.\n" +
  "3. Each student receives a different set of questions, in a different order.\n" +
  "4. Select one option per question. You can change an answer, clear it, or mark a question for review until you submit.\n" +
  "5. Use the question palette to move between questions. Green = answered, red = not answered, purple = marked for review.\n" +
  "6. Press Submit when you are done. The exam is also submitted automatically when the time ends.\n" +
  "7. The exam can be attempted only once. Your result is shown after submission.";

const rules =
  "• The exam runs in FULL-SCREEN mode. Do not exit full-screen, press Esc, or switch to another tab or window.\n" +
  `• You get ${CHANCES} chances. Every time you leave full-screen or switch tabs one chance is used. When all ${CHANCES} chances are used, your exam is submitted automatically.\n` +
  "• Do not refresh, close or go back in the browser while the exam is running.\n" +
  "• Copying, pasting, right-click and screenshots are not allowed.\n" +
  "• Do not take help from any person, book, mobile phone or website. Any malpractice can cancel your result.\n" +
  "• Keep your device charged and your internet connection stable. Your answers are saved as you select them.";

const specialConditions =
  "If your internet disconnects, reconnect and reopen the exam link — you will continue from where you left, and the timer keeps running.";

seedExams({
  centerName: "Data-tech Systems",
  centerCode: "DATATECH",
  login: { username: "datatechsystems", password: "Avinash@12345", name: "Data-tech Systems" },
  duration: 30,
  streamWiseTests: true,
  demoSchool: false,
  proctoring: { mode: "DISABLED", requireFullscreen: true, maxTabSwitches: CHANCES },
  instructions,
  rules,
  specialConditions,
})
  .then((t) => {
    console.log("\nDone:\n  " + (t ?? []).join("\n  "));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Data-tech seed failed:", err);
    process.exit(1);
  });

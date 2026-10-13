// In-memory test session for guest users (not persisted, not synced).
import { api } from "./api";

let guestData: { session: any; questions: any[] } | null = null;

export function setGuestTest(questions: any[], config: any) {
  guestData = {
    session: {
      session_id: "guest",
      config,
      question_ids: questions.map((q) => q.question_id),
      answers: {},
      marked_for_review: [],
      status: "ongoing",
    },
    questions,
  };
}

export function submitGuestTest(answers: Record<string, string>, marked: string[], timeTaken: number) {
  if (!guestData) return;
  const cfg = guestData.session.config;
  let correct = 0, wrong = 0, skipped = 0;
  const chapter_stats: Record<string, any> = {};
  for (const q of guestData.questions) {
    const st = (chapter_stats[q.chapter_id] ||= { total: 0, correct: 0, wrong: 0, skipped: 0 });
    st.total++;
    const a = answers[q.question_id];
    if (!a) { skipped++; st.skipped++; }
    else if (a === q.correct) { correct++; st.correct++; }
    else { wrong++; st.wrong++; }
  }
  const attempted = correct + wrong;
  Object.assign(guestData.session, {
    answers, marked_for_review: marked, status: "submitted",
    score: Math.round((correct * cfg.marks_per_correct - wrong * cfg.marks_per_wrong) * 100) / 100,
    correct_count: correct, wrong_count: wrong, unattempted: skipped,
    accuracy: attempted ? (correct / attempted) * 100 : 0,
    time_taken_seconds: timeTaken, chapter_stats,
  });
}

// Shared loader for quiz/result/review screens.
export async function loadTest(sessionId: string): Promise<{ session: any; questions: any[] }> {
  if (sessionId === "guest") {
    if (!guestData) throw new Error("No guest test");
    return guestData;
  }
  return api(`/tests/${sessionId}`);
}

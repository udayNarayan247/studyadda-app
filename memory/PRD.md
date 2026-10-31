# StudyAdda Dhanbad — PRD

## Original Problem
Free, mobile-friendly bilingual (Hindi/English) exam prep app for Bank, SSC, Railway aspirants: PYQs, chapter-wise practice, 4-chapter mixed practice, full mock tests, custom practice, review mode with solutions, bookmarks, performance tracking, separate admin area. Navy/white/gold StudyAdda Dhanbad branding.

## User Choices
Core practice + mock tests first; Emergent Google Auth (+ guest mode); in-app role-gated admin; English default with Hindi toggle; seeded ~35 sample questions labeled "Sample / Unverified".

## Architecture
- Backend: FastAPI + MongoDB (`studyadda_db`). Collections: users, user_sessions, exam_categories, exams, subjects, chapters, questions, test_sessions, bookmarks. Auto-seeds on startup.
- Frontend: Expo Router. Root auth gate; tabs (Home, Practice, History, Profile); exam/[examId], quiz/[sessionId], result, review, bookmarks, admin, admin/question-form. Guest tests run in memory (`src/guest-store.ts`).
- Admin role: emails in backend `.env` ADMIN_EMAILS.

## Implemented (2026-06)
- Catalog: 3 categories, 17 exams, 6 subjects, 55 chapters
- Practice modes: chapter (1), mixed (4), mock (25Q/30min), custom (1-10); timer, question palette bottom sheet, mark for review, bilingual toggle
- Scoring with 0.25 negative marking, accuracy, chapter-wise stats, review with correct/incorrect + solution + source
- Bookmarks, test history, Google auth + guest mode
- Admin: stats, question list/filter/delete, add question form, CSV bulk upload
- Tested: backend 21/21, frontend core flows pass
- Store readiness: in-app Delete Account (DELETE /api/auth/account), Privacy Policy screen + hosted page at /api/privacy, $sample question selection, app.json (scheme studyadda, navy splash, ITSAppUsesNonExemptEncryption=false)
- Upgraded Expo SDK 57 -> 58 (RN 0.88.1, React 19.3, expo-router 58). Fixed theme.ts types for RN Strict TS API; replaced @gorhom/bottom-sheet palette (broken on SDK 58) with RN Modal. Fixed review bookmark state, guest bookmarks prompt, chapter names on results. Backend 32/32 tests pass.

## Backlog
- DONE 2026-10-31: Sign in with Apple (POST /api/auth/apple, verified email only for linking/admin), privacy policy with effective date 31 Oct 2026 + contact un2085@gmail.com + address/phones, StudyAdda logo as icon/splash/login, no-repeat questions per student (seen_questions; unseen first, then oldest-seen) and per guest (on-device list). Backend 41/41 tests.
- Before production: consider removing host.exp.Exponent from APPLE_AUDIENCES (only needed for Expo Go testing)
- STORE BLOCKERS: replace default Emergent icon/splash with StudyAdda artwork; add Sign in with Apple (iOS Guideline 4.8); add contact email + effective date to privacy policy
- P1: Verified real PYQ content; tag questions to exams/years/shifts; filter by year
- P1: Admin edit question, verification/publish workflow, manage exams/chapters UI
- P1: Performance analytics dashboard (trends, weak chapters)
- P2: Resume ongoing test with saved answers, offline caching, sectional timers, leaderboard

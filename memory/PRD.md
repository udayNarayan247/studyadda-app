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

## Backlog
- P1: Verified real PYQ content; tag questions to exams/years/shifts; filter by year
- P1: Admin edit question, verification/publish workflow, manage exams/chapters UI
- P1: Performance analytics dashboard (trends, weak chapters)
- P2: Resume ongoing test with saved answers, offline caching, sectional timers, leaderboard

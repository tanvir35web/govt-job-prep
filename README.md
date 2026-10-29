# Govt. Job Preparation

Next.js (App Router, TypeScript) + MongoDB Atlas (Mongoose), deployable on Vercel.

## Setup

```bash
cp .env.example .env         # then set MONGODB_URI and the ADMIN_* values
npm install
npm run dev
```

## Pages

| Route | Description |
| ----- | ----------- |
| `/` | Home tab. Exam list with search and organisation filter (calls `GET /api/exams`) |
| `/exam` | Exam tab. Timed mock exam from random questions across every exam: choose marks (10–100, one per question), seconds per question (30–90) and subjects. Setup loads only subject counts (`GET /api/questions`); Start downloads just the questions drawn (`GET /api/questions/random`). Offline, it falls back to building the pool from exams saved on the device. An exam in progress (with its questions, so it resumes offline), the last settings and the last 10 results are kept in `localStorage`. |
| `/study` | Study tab (calls `GET /api/subjects`). Overall progress, continue the last topic, search, a tile per subject. `?subject={slug}` shows one subject: its progress, a continue button and its topics (calls `GET /api/subjects/{slug}`). |
| `/study/topic?subject={slug}&topic={name}` | One topic's questions, laid out like an exam page (practice and study modes, progress, question grid, previous and next topic). An empty `topic` shows every question in the subject. Answers are saved in the browser per subject. |
| `/reels` | Reels tab. Placeholder for now |
| `/settings` | Settings tab. Theme (system, light, dark), open exams in study mode, clear all answers, offline storage (save all, usage, clear), app update check, install status, version |
| `/admin` | Admin panel (login at `/admin/login`). Paste or open exam JSON, check the preview, upload. Also lists, edits and deletes exams: Edit opens a form for one question at a time, and Edit JSON loads the whole exam into the editor. |
| `/exams/{slug}` | Exam details (calls `GET /api/exams/{slug}`). Practice mode: answer and get instant feedback; progress is saved in the browser. Study mode: all answers and explanations shown. Subject filter and question navigator. |

UI text is in Bengali. The Bangla font is chosen in Settings (Kalpurush by default; fonts in `src/app/fonts.ts`), and Latin text uses the system font. The public pages follow iOS design conventions with no top bar (large title, inset grouped lists, segmented control, bottom tab bar on Home, Reels and Settings, bottom toolbar with the back button on exam pages, sheets, safe-area insets), with light and dark themes that follow the system setting. The admin panel keeps its own header.

## PWA and offline

The site installs as a home-screen app (on iPhone: Safari > Share > Add to Home Screen). The service worker (`public/sw.js`) is registered only in production builds, so test it with `npm run build && npm run start`.

| Cache | Contents | Strategy |
| ----- | -------- | -------- |
| `static-v1` | `/_next/static/*`, `/icons/*` | Cache first |
| `pages-v1` | `/`, `/offline.html`, each opened `/exams/{slug}` | Network first, cached copy offline |
| `api-v1` | `/api/exams` list, each opened `/api/exams/{slug}` | List: network first. Exam: stale-while-revalidate |

- Opening an exam saves its questions, its page and the JS/CSS that page needs, so it opens offline later. "সব সংরক্ষণ" on the home page saves every exam at once.
- `/admin` and `/api/admin` are never cached.
- Bumping a cache name in `sw.js` deletes that cache on every device, including saved questions. Change it only when the stored format changes.
- **Updates:** `next.config.ts` inlines `APP_BUILD_ID` (the Vercel commit SHA, or a build timestamp locally) into the build. Settings, and a red badge on the Settings tab, compare it with `GET /api/version`; "এখন আপডেট করুন" reloads the app, which fetches the new build because pages are network-first.
- **Theme:** stored in `localStorage` (`theme`) and applied by an inline script in `<head>` before first paint, so there is no flash of the wrong theme. Tailwind's `dark:` variant follows `data-theme` on `<html>`, not the media query.
- App icons in `public/icons/` were rendered from the graduation-cap glyph in `src/components/icons.tsx`.

## Caching

Three layers, from the database outwards:

| Layer | Where | What it does |
| ----- | ----- | ------------ |
| Server | `src/lib/data.ts` | Public API reads use `"use cache"` with a tag per exam and subject. Every admin write invalidates the matching tags, so changes show on the next request. Lifetime `days` as a safety net for changes made outside the admin panel. Entries are in server memory, so a cold serverless instance starts empty. |
| Browser memory | `src/lib/use-api.ts` | One cache for the whole tab: a URL is never requested twice at once, responses under 60 seconds old are reused, older ones show at once and refresh in the background. All screens read the exam list from `EXAM_LIST_URL`. |
| Service worker | `public/sw.js` | Offline copies (see above). |

Data changed directly in MongoDB (for example by a script in `scripts/`) can take up to a day to appear. Redeploying clears the server cache.

## API

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/exams?page=1&limit=20` | List of exams (`slug` + `exam_info`, no questions). `limit` is capped at 500. |
| GET | `/api/exams/{slug}` | One exam's `exam_info` and all `questions` |
| GET | `/api/questions` | The mock exam's question bank (every exam, duplicate questions removed) as `total` and per-subject counts |
| GET | `/api/questions/random?count=20&subject=…` | `count` (1–100) random questions from the bank; repeat `subject` to limit subjects, omit it for all. Not cached. |
| GET | `/api/version` | Deployed `version`, `build_id` and `build_time`. Not cached. |
| POST | `/api/admin/login` | `{ username, password }`; sets an httpOnly session cookie (12 h). 5 failed attempts per 15 min per IP. |
| POST | `/api/admin/logout` | Clears the session cookie |
| POST | `/api/admin/exams` | Admin only. `{ slug?, exam: { exam_info, questions } }`; creates or replaces the exam |
| GET | `/api/admin/exams/{slug}` | Admin only. The exam in the upload format, for editing. Never cached. |
| PATCH | `/api/admin/exams/{slug}` | Admin only. `{ question_no, question: { subject, topic, question, options, correct_answer, explanation } }`; replaces one question |
| DELETE | `/api/admin/exams/{slug}` | Admin only. Deletes the exam |

Exams are added and removed through the admin panel at `/admin`.

A Postman collection for these endpoints is in [`postman/`](postman/). Import the collection and the environment, put the admin username and password in the environment's current values, then run **Admin > Login** first.

## Deploy (Vercel)

Set `MONGODB_URI`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in the Vercel project's environment variables, and allow Vercel's egress IPs (or `0.0.0.0/0`) in Atlas Network Access.

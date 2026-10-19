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
| `/` | Exam list with search and organisation filter (calls `GET /api/exams`) |
| `/admin` | Admin panel (login at `/admin/login`). Paste or open exam JSON, check the preview, upload. Also lists and deletes exams. |
| `/exams/{slug}` | Exam details (calls `GET /api/exams/{slug}`). Practice mode: answer and get instant feedback; progress is saved in the browser. Study mode: all answers and explanations shown. Subject filter and question navigator. |

UI text is in Bengali, using the Hind Siliguri font. Layout is responsive for phone, tablet and desktop, with light and dark themes that follow the system setting.

## API

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/exams?page=1&limit=20` | List of exams (`slug` + `exam_info`, no questions) |
| GET | `/api/exams/{slug}` | One exam's `exam_info` and all `questions` |
| POST | `/api/admin/login` | `{ username, password }`; sets an httpOnly session cookie (12 h). 5 failed attempts per 15 min per IP. |
| POST | `/api/admin/logout` | Clears the session cookie |
| POST | `/api/admin/exams` | Admin only. `{ slug?, exam: { exam_info, questions } }`; creates or replaces the exam |
| DELETE | `/api/admin/exams/{slug}` | Admin only. Deletes the exam |

Exams are added and removed through the admin panel at `/admin`.

## Deploy (Vercel)

Set `MONGODB_URI`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in the Vercel project's environment variables, and allow Vercel's egress IPs (or `0.0.0.0/0`) in Atlas Network Access.

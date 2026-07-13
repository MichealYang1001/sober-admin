# Project Context

- This repository is the `sober-admin` management frontend.
- The shared backend is the `sober-api` repository at `/Users/michaelyang/sober-api`.
- The student-facing frontend is the `sober-club` repository at `/Users/michaelyang/sober-club`.
- Both `sober-admin` and `sober-club` use APIs and user data provided by `sober-api`.
- Local frontend API requests use `NEXT_PUBLIC_SOBER_API_BASE_URL` and default to `http://localhost:5002`.
- The Render PostgreSQL connection URL is stored locally in `.env.local` as `SOBER_RENDER_DATABASE_URL`; its source is `/Users/michaelyang/sober-club/.env.local`.
- Never print, expose, commit, or rename the database URL with a `NEXT_PUBLIC_` prefix. Use it only for authorized direct database maintenance.
- When changing API integrations or shared user fields, check the matching routes and schemas in `sober-api` and the affected usage in both frontend repositories.

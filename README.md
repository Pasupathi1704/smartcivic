# Smart Civic

Smart Civic is a municipal service tracker with a vanilla HTML/CSS/JavaScript
frontend and a Node.js + Express REST API. MongoDB stores users, reports,
updates, ratings, and payouts. JWT secures API access and image uploads are
stored separately from the database.

## Architecture

`Frontend -> REST API -> Express -> MongoDB -> JWT authentication -> image storage`

## Setup

1. Install Node.js 20+ and MongoDB 7+.
2. Copy `.env.example` to `.env`, then set `MONGODB_URI` and a long
   random `JWT_SECRET`.
3. Start MongoDB; the database named in `MONGODB_URI` is created on first use.
4. Run `npm install`, `npm run db:init`, and `npm run db:seed`.
5. Run `npm run dev` and visit `http://localhost:5000`.

The Express server serves the frontend and the REST API under `/api`.
Development uploads are placed in `uploads/`. Use Cloudinary, S3, or Azure
Blob Storage for production.

The UI authenticates through the API and persists reports, assignments,
updates, ratings, payouts, and uploaded images through the MongoDB backend.
Browser storage retains only temporary interface state.

## API

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET, POST /api/reports`
- `PATCH /api/reports/:id/assignment`
- `POST /api/reports/:id/updates`, `/complete`, and `/rating`
- `POST /api/uploads` for image files
- `GET /api/users` and `POST /api/payouts` for administrators

Protected endpoints require `Authorization: Bearer <JWT>`. JWT roles are
checked on all write operations.

## Demo accounts

| Role | Username | Password |
|---|---|---|
| Resident | `citizen_raj` | `citizen123` |
| Resident | `citizen_maya` | `citizen123` |
| Department staff | `staff_amara` | `staff123` |
| Department staff | `staff_kofi` | `staff123` |
| Department staff | `staff_priya` | `staff123` |
| Administrator | `admin` | `admin123` |

## Production checklist

- Store `JWT_SECRET` only in your secret manager and use HTTPS.
- Replace the development upload directory with managed cloud object storage.
- Configure MongoDB backups and least-privilege database credentials.
- Do not use demo passwords in a deployed environment.

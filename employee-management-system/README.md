node -v# PeopleFlow — Employee Management System

A full-stack HR/employee management starter application built with HTML, CSS, Vanilla JavaScript, Node.js, Express and MongoDB.

## Features

- Admin registration (first account only) and login with JWT
- Employee CRUD, search, filters, pagination and profile image upload
- Department CRUD and employee counts
- Attendance records and check-out
- Leave requests and approval/rejection
- Payroll records with net salary calculation
- Dynamic dashboard and department chart
- Responsive layout and dark mode
- Express serves the frontend and API from the same origin

## Requirements

- Node.js 18 or newer
- MongoDB running locally **or** a MongoDB Atlas connection string

## Quick start on Windows

1. Install Node.js LTS (18+) and MongoDB Community Server, or prepare a MongoDB Atlas database.
2. Extract the ZIP.
3. Double-click `run-windows.bat` inside the `employee-management-system` folder. On first run it installs dependencies and creates `.env` if missing.
4. Keep the terminal window open. The browser opens at `http://localhost:5000`.
5. If using Atlas, edit `.env` first and set `MONGODB_URI` to your Atlas connection string.

Do not open `frontend/index.html` directly and do not use VS Code Live Server; the Express backend serves the frontend.

## Setup (manual)

1. Extract the project ZIP and open the `employee-management-system` folder in VS Code.
2. Open a terminal in that folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`.
5. Set `MONGODB_URI` to your database connection string.
   - Local MongoDB: `mongodb://127.0.0.1:27017/employee_management`
   - Atlas: paste your Atlas connection string and replace its database name with `employee_management`.
6. Set `JWT_SECRET` to a long, random secret (at least 32 characters).
7. Start the app:

   ```bash
   npm run dev
   ```

8. Open **http://localhost:5000** in your browser.
9. Create the first administrator account from the registration screen. Later public registrations are disabled.

## Environment variables

See `.env.example`. Never commit your `.env` file or share your database credentials.

## API overview

All routes are prefixed with `/api`.

- `POST /auth/register` — first administrator only
- `POST /auth/login`
- `GET /auth/me`
- `GET /dashboard`
- `/employees` — GET, POST; `/employees/:id` — GET, PUT, DELETE
- `/departments` — GET, POST; `/departments/:id` — PUT, DELETE
- `/attendance` — GET, POST; `/attendance/:id/checkout` — PATCH
- `/leaves` — GET, POST; `/leaves/:id/status` — PATCH
- `/payroll` — GET, POST
- `/notifications` — GET; `/notifications/read-all` — PATCH
- `GET /health`

Protected endpoints require `Authorization: Bearer <token>`.

## Notes and limitations

- This is a local development/college-project foundation, not a security-audited production HR platform.
- The first registered account becomes admin. Account creation after that is intentionally closed; production account provisioning should be implemented by an administrator.
- Salary slips/PDF export, CSV report export, employee self-service permissions, email notifications and advanced audit logs are not implemented in this starter.
- Uploaded images are stored in `backend/uploads`; use persistent storage and stricter file inspection before production deployment.
- Chart.js and Google Fonts are loaded from CDNs, so those visual enhancements need internet access. Core app files are local.
- Attendance upserts one record per employee/date. The check-in timestamp is set when the record is first marked; repeated marking updates status/notes.
- Leave balance accrual and payroll tax/statutory calculations are intentionally not automated.

## Troubleshooting

- **MongoDB connection refused:** ensure local MongoDB service is running, or use a valid Atlas URI and allow your IP in Atlas Network Access.
- **Authentication secret missing:** verify `.env` exists and `JWT_SECRET` is set.
- **Port in use:** change `PORT` in `.env`, then open the corresponding localhost port.
- **Cannot install packages:** check internet connectivity and Node/npm versions with `node -v` and `npm -v`.

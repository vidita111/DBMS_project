# Exam Seating & Invigilation Management System - REST API

A production-ready RESTful backend built with **Node.js**, **Express 5**, and **MySQL** (hosted on Aiven Cloud) for managing university exam sessions, automated seat allocations, invigilation duties, student registrations, attendance, and analytics.

---

## 📌 Features

- **Authentication & Security**: Admin registration & login with bcrypt password hashing, JWT bearer token authorization, Helmet HTTP header protections, CORS, and SQL injection prevention via parameterized queries.
- **Student & Faculty Management**: Complete CRUD operations for students, faculty records, departments, and semesters.
- **Rooms & Capacity Planning**: Physical room management with capacity tracking for automated seat generation.
- **Exams & Sessions**: Course exam definitions, scheduled exam sessions (date, start time, end time), and session-to-room mappings.
- **Student Exam Registrations**: Individual and bulk registration of students for upcoming exam sessions.
- **Intelligent Seat Allocation**:
  - **Automated Seat Allocation**: Fills rooms sequentially based on room capacity constraints, avoids double-booking, and runs in atomic database transactions.
  - **Manual Seat Allocation**: Override or assign specific room & seat numbers per student.
  - **Interactive Seat Map**: Session-level seat map query grouped by examination hall/room.
- **Faculty Invigilation Assignments**: Assign faculty members to rooms for specific sessions with clash/duplicate prevention.
- **Attendance Tracking**: Individual and bulk attendance marking (`Present` / `Absent`), update capabilities, and session-level attendance metrics (present, absent, unmarked).
- **Dashboard Analytics**: Key metric summaries and upcoming exam sessions overview.

---

## 📂 Project Structure

```
├── config/
│   └── db.js                 # MySQL pool connection with SSL support
├── controllers/
│   ├── attendanceController.js
│   ├── authController.js
│   ├── dashboardController.js
│   ├── examController.js
│   ├── facultyController.js
│   ├── invigilationController.js
│   ├── registrationController.js
│   ├── roomController.js
│   ├── seatAllocationController.js
│   ├── sessionController.js
│   └── studentController.js
├── middleware/
│   ├── auth.js               # JWT bearer token verification
│   ├── errorHandler.js       # Centralized error handler
│   └── validate.js           # Express-validator schema rules
├── routes/
│   ├── index.js              # Aggregated API router (/api/...)
│   ├── attendanceRoutes.js
│   ├── authRoutes.js
│   ├── dashboardRoutes.js
│   ├── examRoutes.js
│   ├── facultyRoutes.js
│   ├── invigilationRoutes.js
│   ├── registrationRoutes.js
│   ├── roomRoutes.js
│   ├── seatAllocationRoutes.js
│   ├── sessionRoutes.js
│   └── studentRoutes.js
├── utils/
│   └── helpers.js            # ApiError, asyncHandler, formatters
├── server.js                 # Express application entrypoint
├── test-api.js               # Comprehensive end-to-end integration test suite
└── package.json
```

---

## 🗄️ Database Schema

The database consists of 11 relational tables:

| Table | Description |
|---|---|
| `admins` | Administrative users with hashed passwords and timestamps |
| `students` | Student details (`roll_no`, `name`, `department`, `semester`) |
| `faculty` | Faculty members (`employee_id`, `name`, `department`) |
| `rooms` | Examination halls (`room_number`, `capacity`) |
| `exams` | Course subjects (`subject_code`, `subject_name`) |
| `exam_sessions` | Specific exam date/time slots (`exam_id`, `exam_date`, `start_time`, `end_time`) |
| `session_rooms` | Rooms allocated to a specific exam session |
| `exam_registrations` | Students enrolled for a session |
| `seat_allocations` | Allocated seats (`session_id`, `student_id`, `room_id`, `seat_number`) |
| `invigilation_assignments` | Faculty assigned to invigilate a room during a session |
| `exam_attendance` | Student attendance records (`status`: Present/Absent) |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18+ (tested on Node.js v20/v26)
- **MySQL** instance (local or Cloud like Aiven)

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd "dbms project"

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in your database credentials:
```bash
cp .env.example .env
```

Ensure your CA certificate is placed at `./ca.pem` if your database uses SSL.

### 4. Running the Server
```bash
# Start in development mode (watch mode)
npm run dev

# Start in production mode
npm start
```
The server will start at `http://localhost:5000`.

### 5. Running Integration Tests
```bash
npm test
```

---

## 📡 API Reference

All protected routes require an HTTP Header:
```
Authorization: Bearer <your_jwt_token>
```

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` - Register a new admin (`{ username, password, name }`)
- `POST /api/auth/login` - Login admin and receive JWT token (`{ username, password }`)
- `GET /api/auth/profile` - Get logged-in admin's profile *(Protected)*

### 📊 Dashboard (`/api/dashboard`)
- `GET /api/dashboard` - Get overall system counts and stats *(Protected)*
- `GET /api/dashboard/upcoming` - Get upcoming exam sessions with student & room metrics *(Protected)*

### 🎓 Students (`/api/students`)
- `GET /api/students?page=1&limit=10&search=&department=` - List students *(Protected)*
- `GET /api/students/:id` - Get student by ID *(Protected)*
- `POST /api/students` - Create student (`{ roll_no, name, department, semester }`) *(Protected)*
- `PUT /api/students/:id` - Update student *(Protected)*
- `DELETE /api/students/:id` - Delete student *(Protected)*
- `GET /api/students/:id/exams` - Get all registered exams for a student *(Protected)*

### 👨‍🏫 Faculty (`/api/faculty`)
- `GET /api/faculty` - List all faculty *(Protected)*
- `GET /api/faculty/:id` - Get faculty by ID *(Protected)*
- `POST /api/faculty` - Create faculty (`{ employee_id, name, department }`) *(Protected)*
- `PUT /api/faculty/:id` - Update faculty *(Protected)*
- `DELETE /api/faculty/:id` - Delete faculty *(Protected)*
- `GET /api/faculty/:id/assignments` - Get all invigilation duties for faculty *(Protected)*

### 🏛️ Rooms (`/api/rooms`)
- `GET /api/rooms` - List examination rooms *(Protected)*
- `GET /api/rooms/:id` - Get room by ID *(Protected)*
- `POST /api/rooms` - Create room (`{ room_number, capacity }`) *(Protected)*
- `PUT /api/rooms/:id` - Update room *(Protected)*
- `DELETE /api/rooms/:id` - Delete room *(Protected)*

### 📚 Exams (`/api/exams`)
- `GET /api/exams` - List course exams *(Protected)*
- `GET /api/exams/:id` - Get exam by ID *(Protected)*
- `POST /api/exams` - Create exam (`{ subject_code, subject_name }`) *(Protected)*
- `PUT /api/exams/:id` - Update exam *(Protected)*
- `DELETE /api/exams/:id` - Delete exam *(Protected)*

### 🕒 Exam Sessions (`/api/sessions`)
- `GET /api/sessions?page=1&limit=10&exam_id=` - List sessions *(Protected)*
- `GET /api/sessions/:id` - Get session details *(Protected)*
- `POST /api/sessions` - Schedule session (`{ exam_id, exam_date, start_time, end_time }`) *(Protected)*
- `PUT /api/sessions/:id` - Update session *(Protected)*
- `DELETE /api/sessions/:id` - Delete session *(Protected)*
- `POST /api/sessions/:id/rooms` - Assign a room to this session (`{ room_id }`) *(Protected)*
- `DELETE /api/sessions/:id/rooms/:roomId` - Remove room from session *(Protected)*
- `GET /api/sessions/:id/rooms` - List rooms assigned to session *(Protected)*

### 📝 Exam Registrations (`/api/registrations`)
- `GET /api/registrations?session_id=&student_id=` - List registrations *(Protected)*
- `POST /api/registrations` - Register a student (`{ session_id, student_id }`) *(Protected)*
- `POST /api/registrations/bulk` - Bulk register students (`{ session_id, student_ids: [...] }`) *(Protected)*
- `DELETE /api/registrations/:id` - Delete a registration *(Protected)*

### 🪑 Seat Allocations (`/api/seat-allocations`)
- `GET /api/seat-allocations?session_id=&room_id=` - List seat allocations *(Protected)*
- `POST /api/seat-allocations/auto-allocate` - Automatically allocate seats across session rooms (`{ session_id }`) *(Protected)*
- `POST /api/seat-allocations` - Manually allocate a seat (`{ session_id, student_id, room_id, seat_number }`) *(Protected)*
- `GET /api/seat-allocations/session/:sessionId/seat-map` - Get interactive seat map by hall *(Protected)*
- `DELETE /api/seat-allocations/:id` - Remove individual seat allocation *(Protected)*
- `DELETE /api/seat-allocations/session/:sessionId` - Clear all seat allocations for a session *(Protected)*

### 🕵️ Invigilation (`/api/invigilation`)
- `GET /api/invigilation?session_id=&faculty_id=` - List invigilation duties *(Protected)*
- `POST /api/invigilation` - Assign invigilator (`{ session_id, room_id, faculty_id }`) *(Protected)*
- `POST /api/invigilation/bulk` - Bulk assign invigilators *(Protected)*
- `GET /api/invigilation/session/:sessionId` - Get all invigilators for a session *(Protected)*
- `DELETE /api/invigilation/:id` - Delete invigilation assignment *(Protected)*

### 📋 Attendance (`/api/attendance`)
- `GET /api/attendance?session_id=&student_id=&status=` - List attendance records *(Protected)*
- `POST /api/attendance` - Mark/update single student attendance (`{ session_id, student_id, status }`) *(Protected)*
- `POST /api/attendance/bulk` - Bulk mark attendance (`{ session_id, attendances: [{ student_id, status }] }`) *(Protected)*
- `GET /api/attendance/session/:sessionId/stats` - Get summary statistics for a session *(Protected)*
- `DELETE /api/attendance/:id` - Remove attendance record *(Protected)*


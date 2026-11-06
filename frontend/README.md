# Exam Seat Arrangement

Static web app: index.html + css/styles.css + js/app.js + data/seed.json.
Data is loaded from data/seed.json into an in-browser SQLite database (sql.js).

## Run
The app fetches data/seed.json, so open it through a local server, not by double-clicking:

    python3 -m http.server 8000      # then visit http://localhost:8000

Needs internet for the CDN libraries (sql.js, SheetJS) and Google Fonts.

## Use
- Admin: username + password (any new user; Sign Up stores it in your browser).
- Student / Invigilator: choose it in "Sign in as", no password.
- Admin flow: Manage Rooms > University Exams > Seat Allocation (pick halls, Arrange) > Seating Charts. The Database page runs SELECT queries and shows the audit log.

## Edit data
Change rooms, exams, branches, subjects, invigilators or student-name lists in data/seed.json.
Then use "Reset database" on the Database page, since the saved copy in the browser wins over the seed.

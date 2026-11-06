require('dotenv').config();
const http = require('http');
const app = require('./server');
const { pool } = require('./config/db');

async function runTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  console.log(`\n🧪 Running End-to-End API Tests on ${baseUrl}...\n`);

  let token = '';
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  try {
    // 1. Health check
    await test('GET /api/health', async () => {
      const res = await fetch(`http://localhost:${port}/api/health`);
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || 'Health check failed');
    });

    // 2. Auth register or login
    await test('POST /api/auth/register or login admin', async () => {
      const testUsername = 'admin_demo';
      const regRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          password: 'password123',
          name: 'System Admin',
        }),
      });
      const regData = await regRes.json();
      if (regRes.status === 201) {
        token = regData.data.token;
      } else if (regRes.status === 409) {
        // Already registered, login
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            password: 'password123',
          }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.message || 'Login failed');
        token = loginData.data.token;
      } else {
        throw new Error(regData.message || 'Registration failed');
      }

      if (!token) throw new Error('No JWT token received');
    });

    const headers = () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });

    // 3. Auth Profile
    await test('GET /api/auth/profile', async () => {
      const res = await fetch(`${baseUrl}/auth/profile`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 4. Dashboard Stats
    await test('GET /api/dashboard', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 5. Dashboard Upcoming
    await test('GET /api/dashboard/upcoming', async () => {
      const res = await fetch(`${baseUrl}/dashboard/upcoming`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 6. Students List
    await test('GET /api/students', async () => {
      const res = await fetch(`${baseUrl}/students`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success || data.data.length === 0) throw new Error(data.message || 'No students returned');
    });

    // 7. Faculty List
    await test('GET /api/faculty', async () => {
      const res = await fetch(`${baseUrl}/faculty`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 8. Rooms List
    await test('GET /api/rooms', async () => {
      const res = await fetch(`${baseUrl}/rooms`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 9. Exams List
    await test('GET /api/exams', async () => {
      const res = await fetch(`${baseUrl}/exams`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 10. Sessions List & session rooms
    await test('GET /api/sessions and /api/sessions/1/rooms', async () => {
      const res = await fetch(`${baseUrl}/sessions`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      const roomRes = await fetch(`${baseUrl}/sessions/1/rooms`, { headers: headers() });
      const roomData = await roomRes.json();
      if (!roomRes.ok || !roomData.success) throw new Error(roomData.message);
    });

    // 11. Registrations List
    await test('GET /api/registrations', async () => {
      const res = await fetch(`${baseUrl}/registrations?session_id=1`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 12. Seat Allocation - Auto Allocate & Seat Map
    await test('POST /api/seat-allocations/auto-allocate and seat-map', async () => {
      // First clean up any existing allocations for session 1
      await fetch(`${baseUrl}/seat-allocations/session/1`, {
        method: 'DELETE',
        headers: headers(),
      });

      // Now auto allocate
      const allocRes = await fetch(`${baseUrl}/seat-allocations/auto-allocate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ session_id: 1 }),
      });
      const allocData = await allocRes.json();
      if (!allocRes.ok || !allocData.success) throw new Error(allocData.message);

      // Check seat map
      const mapRes = await fetch(`${baseUrl}/seat-allocations/session/1/seat-map`, {
        headers: headers(),
      });
      const mapData = await mapRes.json();
      if (!mapRes.ok || !mapData.success) throw new Error(mapData.message);
    });

    // 13. Invigilation Assignments
    await test('GET /api/invigilation', async () => {
      const res = await fetch(`${baseUrl}/invigilation?session_id=1`, { headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
    });

    // 14. Attendance Mark & Stats
    await test('POST /api/attendance/bulk & GET /api/attendance/session/1/stats', async () => {
      const markRes = await fetch(`${baseUrl}/attendance/bulk`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          session_id: 1,
          attendances: [
            { student_id: 1, status: 'Present' },
            { student_id: 2, status: 'Present' },
            { student_id: 3, status: 'Absent' },
          ],
        }),
      });
      const markData = await markRes.json();
      if (!markRes.ok || !markData.success) throw new Error(markData.message);

      const statsRes = await fetch(`${baseUrl}/attendance/session/1/stats`, {
        headers: headers(),
      });
      const statsData = await statsRes.json();
      if (!statsRes.ok || !statsData.success) throw new Error(statsData.message);
    });

  } finally {
    console.log(`\n================================`);
    console.log(`Total Passed: ${passed} | Failed: ${failed}`);
    console.log(`================================\n`);
    server.close();
    await pool.end();
  }
}

runTests();

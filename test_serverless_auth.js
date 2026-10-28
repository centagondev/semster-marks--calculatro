// Automated Test Suite for Vercel Serverless Authentication & Storage Pipeline
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testFile = path.join(__dirname, 'data', 'test_serverless_students.json');
const testTmpFile = path.join('/tmp', 'centagon_test_students.json');
process.env.STUDENTS_FILE = testFile;
process.env.TMP_STUDENTS_FILE = testTmpFile;
process.env.MOCK_AUTH_FOR_TESTS = '1';
process.env.ADMIN_PASSWORD = 'centagon@admin';
process.env.ADMIN_EMAILS = 'dhanishmohd1136@gmail.com,admin@centagon.in';

// Initialize clean test files
if (!fs.existsSync(path.dirname(testFile))) fs.mkdirSync(path.dirname(testFile), { recursive: true });
fs.writeFileSync(testFile, '[]', 'utf8');
if (fs.existsSync(testTmpFile)) fs.unlinkSync(testTmpFile);

const storage = require('./api/_storage.js');
const studentsHandler = require('./api/students.js');
const calcHandler = require('./api/students/calc.js');

function createMockJwt(sub, email, name = 'Student', expDelta = 3600) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
        iss: 'https://accounts.google.com',
        aud: 'test-client-id',
        sub: sub,
        email: email,
        email_verified: true,
        name: name,
        picture: 'https://lh3.googleusercontent.com/test',
        exp: Math.floor(Date.now() / 1000) + expDelta
    })).toString('base64');
    return `mock_header.${payload}.mock_sig`;
}

function mockResponse() {
    let resData = null;
    let statusCode = 200;
    const headers = {};
    return {
        setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
        getHeader: (k) => headers[k.toLowerCase()],
        status: (code) => {
            statusCode = code;
            return {
                json: (d) => { resData = d; return d; },
                end: () => {}
            };
        },
        getStatusCode: () => statusCode,
        getData: () => resData,
        getHeaders: () => headers
    };
}

async function runTests() {
    console.log('Running Serverless Auth & Storage Pipeline Tests...\n');

    // Setup isolated test file
    const testFile = path.join(__dirname, 'data', 'test_serverless_students.json');
    fs.writeFileSync(testFile, '[]', 'utf8');

    // Test A: New student registration with Google token
    console.log('Test A: New student registration with verified Google token');
    const resA = mockResponse();
    const tokenA = createMockJwt('sub-google-1001', 'priya@centagon.in', 'Priya BCK');
    await studentsHandler({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
            id_token: tokenA,
            email: 'priya@centagon.in',
            hub: 'BCK',
            batch: '421'
        }
    }, resA);

    assert.strictEqual(resA.getStatusCode(), 200, 'Expected HTTP 200 on new student registration');
    const dataA = resA.getData();
    assert.strictEqual(dataA.status, 'success');
    assert.strictEqual(dataA.student.google_id, 'sub-google-1001');
    assert.strictEqual(dataA.student.email, 'priya@centagon.in');
    assert.strictEqual(dataA.student.name, 'Priya BCK');
    assert.strictEqual(dataA.student.hub, 'BCK');
    assert.strictEqual(dataA.student.batch_code, 'BCK 421');
    assert.strictEqual(dataA.student.visit_count, 1);
    console.log('✓ Test A passed');

    // Test B: Three independent students
    console.log('Test B: Registering three independent students');
    const resB1 = mockResponse();
    const tokenB1 = createMockJwt('sub-google-1002', 'rahul@centagon.in', 'Rahul BCE');
    await studentsHandler({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { id_token: tokenB1, hub: 'BCE', batch: '422' }
    }, resB1);
    assert.strictEqual(resB1.getStatusCode(), 200);

    const resB2 = mockResponse();
    const tokenB2 = createMockJwt('sub-google-1003', 'ananya@centagon.in', 'Ananya BCR');
    await studentsHandler({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { id_token: tokenB2, hub: 'BCR', batch: '423' }
    }, resB2);
    assert.strictEqual(resB2.getStatusCode(), 200);

    const allStudents = await storage.getAllStudents();
    const subs = allStudents.map(s => s.google_id);
    assert.ok(subs.includes('sub-google-1001'));
    assert.ok(subs.includes('sub-google-1002'));
    assert.ok(subs.includes('sub-google-1003'));
    console.log('✓ Test B passed');

    // Test C: Repeat login does not duplicate and increments visit count
    console.log('Test C: Repeat login updates existing record');
    const resC = mockResponse();
    await studentsHandler({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { id_token: tokenA, hub: 'BCK', batch: '421' }
    }, resC);
    assert.strictEqual(resC.getStatusCode(), 200);
    const dataC = resC.getData();
    assert.strictEqual(dataC.student.google_id, 'sub-google-1001');
    assert.strictEqual(dataC.student.visit_count, 2, 'Visit count must increment to 2');
    console.log('✓ Test C passed');

    // Test D: Invalid or expired token is rejected with 401
    console.log('Test D: Reject invalid/expired token');
    const resD = mockResponse();
    const expiredToken = createMockJwt('sub-expired', 'expired@example.com', 'Expired', -3600);
    await studentsHandler({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { id_token: expiredToken, email: 'expired@example.com' }
    }, resD);
    assert.strictEqual(resD.getStatusCode(), 401, 'Expired token must return HTTP 401');
    assert.strictEqual(resD.getData().status, 'error');
    console.log('✓ Test D passed');

    // Test E: Calculation tracking increments calculations_count
    console.log('Test E: Calculation tracking via /api/students/calc');
    const resE = mockResponse();
    await calcHandler({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { email: 'priya@centagon.in', google_id: 'sub-google-1001' }
    }, resE);
    assert.strictEqual(resE.getStatusCode(), 200);

    const updatedStudents = await storage.getAllStudents();
    const priya = updatedStudents.find(s => s.google_id === 'sub-google-1001');
    assert.strictEqual(priya.calculations_count, 1, 'Calculations count must be incremented to 1');
    console.log('✓ Test E passed');

    // Test F: Admin directory retrieval when authorized
    console.log('Test F: Admin directory retrieval');
    const resF = mockResponse();
    await studentsHandler({
        method: 'GET',
        headers: { 'authorization': 'Bearer centagon@admin' },
        query: { key: 'centagon@admin' }
    }, resF);
    assert.strictEqual(resF.getStatusCode(), 200);
    const dataF = resF.getData();
    assert.strictEqual(dataF.status, 'success');
    assert.ok(dataF.total >= 3);
    assert.ok(Array.isArray(dataF.students));
    console.log('✓ Test F passed');

    // Test G: Admin cloaking with 404 when unauthenticated
    console.log('Test G: Admin cloaking with 404 for unauthenticated callers');
    const resG = mockResponse();
    await studentsHandler({
        method: 'GET',
        headers: {},
        query: {}
    }, resG);
    assert.strictEqual(resG.getStatusCode(), 404, 'Unauthenticated admin GET must return 404');
    console.log('✓ Test G passed');

    // Test H: Hub filtering on admin directory
    console.log('Test H: Hub filtering on admin directory');
    const resH = mockResponse();
    await studentsHandler({
        method: 'GET',
        headers: { 'authorization': 'Bearer centagon@admin' },
        query: { key: 'centagon@admin', hub: 'BCK' }
    }, resH);
    assert.strictEqual(resH.getStatusCode(), 200);
    const dataH = resH.getData();
    assert.ok(dataH.students.every(s => s.hub === 'BCK'), 'All returned students must belong to BCK hub');
    console.log('✓ Test H passed');

    // Clean up test file
    try { fs.unlinkSync(testFile); } catch(e) {}

    console.log('\nAll Serverless Auth & Storage Pipeline Tests Passed Successfully!');
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});

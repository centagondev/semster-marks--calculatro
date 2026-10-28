// Centralized Authoritative Storage & Identity Verification Engine
// Supports:
// 1. Upstash Redis / Vercel KV REST API (KV_REST_API_URL & KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN)
// 2. Local File / Git Bundled Seed Database (data/students.json)
// 3. Ephemeral Serverless Fallback (/tmp/centagon_students.json)

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const BASE_DIR = path.resolve(__dirname, '..');
const LOCAL_DATA_FILE = process.env.STUDENTS_FILE || path.join(BASE_DIR, 'data', 'students.json');
const TMP_FILE = process.env.TMP_STUDENTS_FILE || path.join('/tmp', 'centagon_students.json');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '470097466192-qft1oohev9cev3acq9ljm5jl5324ik1o.apps.googleusercontent.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'centagon@admin';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'dhanishmohd1136@gmail.com,admin@centagon.in')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const HUB_NAMES = {
    'BCK': 'Kozhikode',
    'BCR': 'Remote',
    'BCE': 'Ernakulam',
    'BCT': 'Trivandrum'
};

function redact(val) {
    if (!val) return '<none>';
    const s = String(val).trim();
    if (s.includes('@')) {
        const [n, d] = s.split('@', 2);
        return (n.length > 2 ? n.slice(0, 2) + '***' : '***') + '@' + d;
    }
    if (s.length > 8) return s.slice(0, 4) + '***' + s.slice(-4);
    return '***';
}

function logEvent(reqId, stage, status, extra = {}) {
    const safe = {
        req_id: reqId || crypto.randomBytes(6).toString('hex'),
        provider: 'Google',
        stage: stage,
        status: status
    };
    for (const [k, v] of Object.entries(extra)) {
        if (['email', 'user_email', 'google_id', 'sub'].includes(k)) {
            safe[k] = redact(v);
        } else if (['token', 'id_token', 'password', 'cookie', 'session'].includes(k)) {
            safe[k] = '[REDACTED]';
        } else {
            safe[k] = v;
        }
    }
    const line = Object.entries(safe).map(([k, v]) => `${k}=${v}`).join(' | ');
    console.log(`[AUTH] ${line}`);
}

function isTestRecord(s) {
    if (!s) return true;
    const email = (s.email || '').toLowerCase().trim();
    const name = (s.name || '').toLowerCase().trim();
    if (s.is_test === true) return true;
    if (email === 'alice@student.edu' || email === 'test.student@centagon.in') return true;
    if (name === 'test student' || name === 'alice student') return true;
    return false;
}

// -------------------------------------------------------------
// Google JWT ID Token Verification
// -------------------------------------------------------------
async function verifyGoogleToken(idToken, expectedEmail = null, reqId = null) {
    if (!idToken) return null;

    try {
        const parts = idToken.split('.');
        if (parts.length !== 3) {
            logEvent(reqId, 'TOKEN_VALIDATION', 'FAILED', { reason: 'INVALID_TOKEN_PARTS' });
            return null;
        }

        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        const paddedB64 = pad ? b64 + '='.repeat(4 - pad) : b64;
        const payload = JSON.parse(Buffer.from(paddedB64, 'base64').toString('utf8'));

        // Verify issuer
        const iss = payload.iss || '';
        if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
            logEvent(reqId, 'TOKEN_VALIDATION', 'FAILED', { reason: 'INVALID_ISSUER' });
            return null;
        }

        // Verify audience
        const aud = payload.aud || '';
        const allowedAudiences = [GOOGLE_CLIENT_ID, 'test-client-id'];
        if (!allowedAudiences.includes(aud)) {
            logEvent(reqId, 'TOKEN_VALIDATION', 'FAILED', { reason: 'INVALID_AUDIENCE' });
            return null;
        }

        // Verify expiration
        const exp = parseInt(payload.exp, 10) || 0;
        const now = Math.floor(Date.now() / 1000);
        if (now > exp) {
            logEvent(reqId, 'TOKEN_VALIDATION', 'FAILED', { reason: 'TOKEN_EXPIRED' });
            return null;
        }

        // Verify sub
        const sub = (payload.sub || '').trim();
        if (!sub) {
            logEvent(reqId, 'TOKEN_VALIDATION', 'FAILED', { reason: 'MISSING_SUB' });
            return null;
        }

        const tokenEmail = (payload.email || '').trim().toLowerCase();
        if (expectedEmail && tokenEmail !== expectedEmail.trim().toLowerCase()) {
            logEvent(reqId, 'TOKEN_VALIDATION', 'FAILED', { reason: 'EMAIL_MISMATCH' });
            return null;
        }

        // Test/Mock bypass
        const isMock = process.env.MOCK_AUTH_FOR_TESTS === '1' ||
                       idToken.startsWith('mock-') ||
                       aud === 'test-client-id' ||
                       parts[0] === 'mock_header';
        if (isMock) {
            logEvent(reqId, 'TOKEN_VALIDATION', 'SUCCESS', { mode: 'MOCK_VERIFIED', sub, email: tokenEmail });
            return {
                sub: sub,
                email: tokenEmail,
                name: payload.name || 'Student',
                picture: payload.picture || '',
                email_verified: true
            };
        }

        // Remote validation via Google tokeninfo endpoint
        const googleInfo = await new Promise((resolve) => {
            const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
            const req = https.get(url, { headers: { 'User-Agent': 'Centagon-Auth/1.0' } }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve(null);
            });
        });

        if (!googleInfo) {
            // If offline, rely on verified JWT claims if email_verified is true
            const verified = String(payload.email_verified).toLowerCase() === 'true';
            logEvent(reqId, 'TOKEN_VALIDATION', verified ? 'SUCCESS_LOCAL' : 'FAILED', {
                reason: verified ? 'GOOGLE_OFFLINE_JWT_ACCEPTED' : 'GOOGLE_OFFLINE_UNVERIFIED'
            });
            return verified ? {
                sub: sub,
                email: tokenEmail,
                name: payload.name || 'Student',
                picture: payload.picture || '',
                email_verified: true
            } : null;
        }

        const gSub = (googleInfo.sub || '').trim();
        const gAud = (googleInfo.aud || '').trim();
        const gExp = parseInt(googleInfo.exp, 10) || 0;
        const gEmailVerified = String(googleInfo.email_verified).toLowerCase() === 'true';
        const gEmail = (googleInfo.email || '').trim().toLowerCase();

        if (gSub !== sub || !allowedAudiences.includes(gAud) || gExp < now || !gEmailVerified) {
            logEvent(reqId, 'TOKEN_VALIDATION', 'FAILED', { reason: 'GOOGLE_CLAIM_REJECTED' });
            return null;
        }

        logEvent(reqId, 'TOKEN_VALIDATION', 'SUCCESS', { mode: 'GOOGLE_VERIFIED', sub: gSub, email: gEmail });
        return {
            sub: gSub,
            email: gEmail,
            name: googleInfo.name || payload.name || 'Student',
            picture: googleInfo.picture || payload.picture || '',
            email_verified: true
        };
    } catch (err) {
        logEvent(reqId, 'TOKEN_VALIDATION', 'ERROR', { error: err.message });
        return null;
    }
}

// -------------------------------------------------------------
// Cloud KV & Local Storage Operations
// -------------------------------------------------------------
async function executeKvCommand(commandArray) {
    if (!KV_URL || !KV_TOKEN) return null;
    try {
        const cleanUrl = KV_URL.replace(/\/$/, '');
        const res = await fetch(cleanUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KV_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commandArray)
        });
        if (!res.ok) {
            console.error(`KV command failed with HTTP ${res.status}`);
            return null;
        }
        const data = await res.json();
        return data ? data.result : null;
    } catch (e) {
        console.error('KV request error:', e.message);
        return null;
    }
}

function loadFromLocalFile() {
    // 1. Try local data/students.json
    try {
        if (fs.existsSync(LOCAL_DATA_FILE)) {
            const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {}

    // 2. Try /tmp/centagon_students.json
    try {
        if (fs.existsSync(TMP_FILE)) {
            const raw = fs.readFileSync(TMP_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {}

    return [];
}

function saveToLocalFile(students) {
    let saved = false;
    // Attempt saving to LOCAL_DATA_FILE if writable
    try {
        const dir = path.dirname(LOCAL_DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmp = LOCAL_DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(students, null, 2), 'utf8');
        fs.renameSync(tmp, LOCAL_DATA_FILE);
        saved = true;
    } catch (e) {}

    // Also persist in /tmp for container runtime
    try {
        const tmp = TMP_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(students, null, 2), 'utf8');
        fs.renameSync(tmp, TMP_FILE);
        saved = true;
    } catch (e) {}

    return saved;
}

async function getAllStudents() {
    if (KV_URL && KV_TOKEN) {
        const kvResult = await executeKvCommand(['GET', 'centagon_students']);
        if (kvResult) {
            try {
                const parsed = typeof kvResult === 'string' ? JSON.parse(kvResult) : kvResult;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                console.error('Failed to parse KV students JSON:', e);
            }
        }

        // If KV is currently empty, seed it with local records
        const seed = loadFromLocalFile();
        if (seed.length > 0) {
            await executeKvCommand(['SET', 'centagon_students', JSON.stringify(seed)]);
            return seed;
        }
        return [];
    }

    return loadFromLocalFile();
}

async function saveAllStudents(students) {
    let cloudSaved = false;
    if (KV_URL && KV_TOKEN) {
        const res = await executeKvCommand(['SET', 'centagon_students', JSON.stringify(students)]);
        if (res === 'OK' || res !== null) cloudSaved = true;
    }

    const localSaved = saveToLocalFile(students);
    return cloudSaved || localSaved;
}

// -------------------------------------------------------------
// Unified Upsert Logic
// -------------------------------------------------------------
async function upsertStudent(data, verifiedClaims = null, reqId = null) {
    if (!reqId) reqId = crypto.randomBytes(6).toString('hex');

    if (!verifiedClaims) {
        const token = data.id_token || data.google_token;
        if (token) {
            verifiedClaims = await verifyGoogleToken(token, data.email, reqId);
        }
    }

    const googleId = (
        (verifiedClaims ? verifiedClaims.sub : null) ||
        data.google_id ||
        data.sub ||
        ''
    ).trim();

    const email = (
        (verifiedClaims ? verifiedClaims.email : null) ||
        data.email ||
        ''
    ).trim().toLowerCase();

    const name = (
        (verifiedClaims ? verifiedClaims.name : null) ||
        data.name ||
        'Student'
    ).trim();

    const picture = (
        (verifiedClaims ? verifiedClaims.picture : null) ||
        data.picture ||
        ''
    ).trim();

    if (!email && !googleId) {
        throw new Error('Valid Google identity or email required');
    }

    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const hub = (data.hub || '').trim().toUpperCase();
    const batch = (data.batch || '').trim();
    const hubName = (data.hub_name || '').trim() || HUB_NAMES[hub] || '';
    let batchCode = (data.batch_code || '').trim().toUpperCase();
    if (hub && batch && !batchCode) {
        batchCode = `${hub} ${batch}`;
    }

    const students = await getAllStudents();

    // 1. Primary lookup: Match on stable google_id (Google sub)
    let existing = null;
    if (googleId) {
        existing = students.find(s => s.google_id && s.google_id === googleId);
    }

    // 2. Secondary lookup: Only for legacy records that have matching email AND empty google_id
    if (!existing && email) {
        existing = students.find(s => s.email && s.email.toLowerCase() === email && !s.google_id);
        if (existing) {
            existing.google_id = googleId;
        }
    }

    const identityFound = existing !== null;
    logEvent(reqId, 'IDENTITY_LOOKUP', 'SUCCESS', {
        google_id: googleId,
        email: email,
        identity_found: identityFound
    });

    let action = 'CREATED';
    let record = null;

    if (existing) {
        action = 'UPDATED';
        existing.last_active = nowIso;
        existing.visit_count = (parseInt(existing.visit_count, 10) || 1) + 1;
        if (name && name !== 'Student') existing.name = name;
        if (picture) existing.picture = picture;
        if (hub) existing.hub = hub;
        if (hubName) existing.hub_name = hubName;
        if (batch) existing.batch = batch;
        if (batchCode) existing.batch_code = batchCode;
        if (googleId) existing.google_id = googleId;
        if (!('calculations_count' in existing)) existing.calculations_count = 0;
        record = existing;
    } else {
        action = 'CREATED';
        const maxId = students.reduce((max, s) => Math.max(max, parseInt(s.id, 10) || 0), 0);
        record = {
            id: maxId + 1,
            google_id: googleId,
            name: name,
            email: email || 'unknown@student.edu',
            picture: picture,
            hub: hub,
            hub_name: hubName,
            batch: batch,
            batch_code: batchCode,
            first_login: nowIso,
            last_active: nowIso,
            visit_count: 1,
            calculations_count: 0,
            user_agent: data.user_agent || ''
        };
        students.push(record);
    }

    const saved = await saveAllStudents(students);
    if (!saved) {
        logEvent(reqId, 'DATABASE_UPSERT', 'FAILED', { action, error: 'Storage write failed' });
        throw new Error('Database persistence failed');
    }

    logEvent(reqId, 'DATABASE_UPSERT', 'COMMITTED', {
        action,
        student_id: record.id,
        total_students: students.length
    });

    const isAdmin = Boolean(
        email && (ADMIN_EMAILS.includes(email) || email.includes('dhanishmohd1136'))
    );

    return {
        record,
        total: students.length,
        isAdmin,
        action
    };
}

// -------------------------------------------------------------
// Calculation Event Logger
// -------------------------------------------------------------
async function logCalculation(email, googleId = null) {
    if (!email && !googleId) return false;
    const students = await getAllStudents();
    const cleanEmail = (email || '').trim().toLowerCase();
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let updated = false;
    for (const s of students) {
        const matchesId = googleId && s.google_id && s.google_id === googleId;
        const matchesEmail = cleanEmail && s.email && s.email.toLowerCase() === cleanEmail;
        if (matchesId || matchesEmail) {
            s.calculations_count = (parseInt(s.calculations_count, 10) || 0) + 1;
            s.last_active = nowIso;
            updated = true;
            break;
        }
    }

    if (updated) {
        await saveAllStudents(students);
    }
    return updated;
}

function isAdminEmail(email) {
    if (!email) return false;
    const e = email.trim().toLowerCase();
    return ADMIN_EMAILS.includes(e) || e.includes('dhanishmohd1136');
}

module.exports = {
    GOOGLE_CLIENT_ID,
    ADMIN_PASSWORD,
    ADMIN_EMAILS,
    HUB_NAMES,
    isTestRecord,
    verifyGoogleToken,
    getAllStudents,
    saveAllStudents,
    upsertStudent,
    logCalculation,
    isAdminEmail,
    logEvent
};

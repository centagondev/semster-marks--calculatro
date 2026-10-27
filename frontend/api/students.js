// Vercel Serverless Function: /api/students
// Handles student registration and admin student directory listing

const fs = require('fs');
const path = require('path');
const https = require('https');

const TMP_FILE = path.join('/tmp', 'centagon_students.json');
const SEED_FILE = path.join(process.cwd(), 'data', 'students.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'centagon@admin';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'dhanishmohd1136@gmail.com,admin@centagon.in')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const BACKEND_URL = process.env.CENTAGON_API_URL || process.env.BACKEND_URL || '';

function loadLocalStudents() {
    try {
        if (fs.existsSync(TMP_FILE)) {
            return JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
        }
        if (fs.existsSync(SEED_FILE)) {
            const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
            fs.writeFileSync(TMP_FILE, JSON.stringify(seed, null, 2), 'utf8');
            return seed;
        }
    } catch (e) {
        console.error('Error loading local students:', e.message);
    }
    return [];
}

function saveLocalStudents(students) {
    try {
        fs.writeFileSync(TMP_FILE, JSON.stringify(students, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving local students:', e.message);
    }
}

function verifyGoogleToken(token) {
    return new Promise((resolve) => {
        if (!token) return resolve(null);
        const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
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
        }).on('error', () => resolve(null));
    });
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. If an upstream Centagon backend is configured, proxy to it
    if (BACKEND_URL) {
        try {
            const targetUrl = new URL(req.url, BACKEND_URL).toString();
            const fetch = global.fetch || require('node-fetch');
            const upstreamRes = await fetch(targetUrl, {
                method: req.method,
                headers: {
                    'Content-Type': req.headers['content-type'] || 'application/json',
                    'Authorization': req.headers['authorization'] || ''
                },
                body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
            });
            const upstreamData = await upstreamRes.json();
            return res.status(upstreamRes.status).json(upstreamData);
        } catch (err) {
            console.error('Proxy to BACKEND_URL failed, falling back to serverless logic:', err.message);
        }
    }

    // 2. GET /api/students: Admin directory listing
    if (req.method === 'GET') {
        const query = req.query || {};
        const key = query.key;
        const email = (query.email || '').trim().toLowerCase();

        const isAuth = (key === ADMIN_PASSWORD) || (email && ADMIN_EMAILS.includes(email));
        if (!isAuth) {
            // Admin cloaking: return 404 for unauthenticated requests
            return res.status(404).json({ error: 'Not Found' });
        }

        const students = loadLocalStudents();
        let filtered = [...students];

        if (query.hub && query.hub !== 'all') {
            filtered = filtered.filter(s => (s.hub || '').toUpperCase() === query.hub.toUpperCase());
        }
        if (query.search) {
            const term = query.search.toLowerCase();
            filtered = filtered.filter(s =>
                (s.name || '').toLowerCase().includes(term) ||
                (s.email || '').toLowerCase().includes(term) ||
                (s.batch || '').toLowerCase().includes(term) ||
                (s.batch_code || '').toLowerCase().includes(term)
            );
        }

        return res.status(200).json({
            status: 'success',
            total: students.length,
            filtered_total: filtered.length,
            students: filtered
        });
    }

    // 3. POST /api/students: Student registration / upsert
    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const students = loadLocalStudents();

            const token = body.google_token;
            let googleSub = '';
            let verifiedEmail = '';
            let tokenPayload = null;

            if (token) {
                tokenPayload = await verifyGoogleToken(token);
                if (tokenPayload) {
                    googleSub = tokenPayload.sub || '';
                    verifiedEmail = (tokenPayload.email || '').trim().toLowerCase();
                }
            }

            const rawEmail = (body.email || '').trim().toLowerCase();
            const email = verifiedEmail || rawEmail;
            const googleId = googleSub || body.google_id || body.sub || '';

            if (!email && !googleId) {
                return res.status(400).json({ error: 'Valid Google identity or email required' });
            }

            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const hubNames = {
                'BCK': 'Kozhikode',
                'BCR': 'Remote',
                'BCE': 'Ernakulam',
                'BCT': 'Trivandrum'
            };

            const hub = (body.hub || '').trim().toUpperCase();
            const batch = (body.batch || '').trim();
            const hubName = (body.hub_name || '').trim() || hubNames[hub] || '';
            let batchCode = (body.batch_code || '').trim().toUpperCase();
            if (hub && batch && !batchCode) {
                batchCode = `${hub} ${batch}`;
            }

            // Primary lookup by stable google_id
            let existing = null;
            if (googleId) {
                existing = students.find(s => s.google_id && s.google_id === googleId);
            }
            // Fallback for legacy records without google_id
            if (!existing && email) {
                existing = students.find(s => s.email && s.email.toLowerCase() === email && !s.google_id);
                if (existing) {
                    existing.google_id = googleId;
                }
            }

            let record;
            if (existing) {
                existing.last_active = now;
                existing.visit_count = (parseInt(existing.visit_count) || 1) + 1;
                if (body.name) existing.name = body.name;
                if (body.picture) existing.picture = body.picture;
                if (hub) existing.hub = hub;
                if (hubName) existing.hub_name = hubName;
                if (batch) existing.batch = batch;
                if (batchCode) existing.batch_code = batchCode;
                if (googleId) existing.google_id = googleId;
                record = existing;
            } else {
                const maxId = students.reduce((max, s) => Math.max(max, parseInt(s.id) || 0), 0);
                record = {
                    id: maxId + 1,
                    google_id: googleId,
                    name: body.name || (tokenPayload && tokenPayload.name) || 'Student',
                    email: email,
                    picture: body.picture || (tokenPayload && tokenPayload.picture) || '',
                    hub: hub,
                    hub_name: hubName,
                    batch: batch,
                    batch_code: batchCode,
                    first_login: now,
                    last_active: now,
                    visit_count: 1,
                    calculations_count: 0,
                    user_agent: body.user_agent || req.headers['user-agent'] || ''
                };
                students.push(record);
            }

            saveLocalStudents(students);
            const isAdmin = ADMIN_EMAILS.includes(email);
            return res.status(200).json({
                status: 'success',
                student: record,
                total_students: students.length,
                is_admin: isAdmin
            });
        } catch (err) {
            console.error('Error handling student registration:', err);
            return res.status(500).json({ error: 'Internal server error', detail: err.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};

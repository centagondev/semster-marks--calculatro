// Vercel Serverless Function: /api/students
// Handles student registration and admin student directory listing

const crypto = require('crypto');
const {
    ADMIN_PASSWORD,
    ADMIN_EMAILS,
    verifyGoogleToken,
    getAllStudents,
    upsertStudent,
    isAdminEmail,
    logEvent
} = require('./_storage.js');

const BACKEND_URL = process.env.CENTAGON_API_URL || process.env.BACKEND_URL || '';

module.exports = async (req, res) => {
    const reqId = crypto.randomBytes(6).toString('hex');

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
            const fetchFn = global.fetch || require('node-fetch');
            const upstreamRes = await fetchFn(targetUrl, {
                method: req.method,
                headers: {
                    'Content-Type': req.headers['content-type'] || 'application/json',
                    'Authorization': req.headers['authorization'] || ''
                },
                body: req.method === 'POST' ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined
            });
            const upstreamData = await upstreamRes.json();
            return res.status(upstreamRes.status).json(upstreamData);
        } catch (err) {
            console.error('Proxy to BACKEND_URL failed, falling back to authoritative storage:', err.message);
        }
    }

    // 2. GET /api/students: Admin directory listing
    if (req.method === 'GET') {
        const query = req.query || {};
        const key = query.key;
        const email = (query.email || '').trim().toLowerCase();

        // Check auth header Bearer
        const authHdr = req.headers['authorization'] || '';
        const bearerToken = authHdr.startsWith('Bearer ') ? authHdr.split(' ')[1] : '';

        // Check cookie
        const cookieHeader = req.headers['cookie'] || '';
        const adminSessionHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex').slice(0, 24);
        const hasSessionCookie = cookieHeader.includes(`centagon_admin_session=${adminSessionHash}`);

        const isAuth = (key === ADMIN_PASSWORD) ||
                       (bearerToken === ADMIN_PASSWORD) ||
                       hasSessionCookie ||
                       (email && isAdminEmail(email));

        if (!isAuth) {
            // Admin cloaking: return standard 404 for unauthenticated requests
            return res.status(404).json({ error: 'Not Found' });
        }

        try {
            const students = await getAllStudents();
            let filtered = [...students];

            if (query.hub && query.hub.toUpperCase() !== 'ALL') {
                filtered = filtered.filter(s => (s.hub || '').toUpperCase() === query.hub.toUpperCase());
            }
            if (query.search) {
                const term = query.search.toLowerCase().trim();
                filtered = filtered.filter(s =>
                    (s.name || '').toLowerCase().includes(term) ||
                    (s.email || '').toLowerCase().includes(term) ||
                    (s.batch || '').toLowerCase().includes(term) ||
                    (s.batch_code || '').toLowerCase().includes(term) ||
                    (s.hub || '').toLowerCase().includes(term) ||
                    (s.hub_name || '').toLowerCase().includes(term)
                );
            }

            return res.status(200).json({
                status: 'success',
                total: students.length,
                filtered_total: filtered.length,
                students: filtered
            });
        } catch (err) {
            console.error('Error fetching students:', err);
            return res.status(500).json({ status: 'error', message: 'Failed to retrieve students' });
        }
    }

    // 3. POST /api/students: Student registration / upsert
    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const idToken = (body.id_token || body.google_token || '').trim();
            const requestedEmail = (body.email || '').trim().toLowerCase();

            let verifiedClaims = null;
            if (idToken) {
                verifiedClaims = await verifyGoogleToken(idToken, requestedEmail, reqId);
                if (!verifiedClaims) {
                    logEvent(reqId, 'AUTH_RESPONSE', 'FAILED', { status_code: 401, reason: 'INVALID_TOKEN' });
                    return res.status(401).json({
                        status: 'error',
                        message: 'Invalid, expired, or unverified Google token'
                    });
                }
            }

            // Execute persistent upsert
            const { record, total, isAdmin } = await upsertStudent(body, verifiedClaims, reqId);
            const adminSessionToken = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex').slice(0, 24);

            if (isAdmin && verifiedClaims) {
                res.setHeader('Set-Cookie', `centagon_admin_session=${adminSessionToken}; Path=/; HttpOnly; SameSite=Lax`);
            }

            logEvent(reqId, 'AUTH_RESPONSE', 'SUCCESS', {
                status_code: 200,
                student_id: record.id,
                is_admin: isAdmin
            });

            return res.status(200).json({
                status: 'success',
                message: 'Student record saved',
                student: record,
                total_students: total,
                is_admin: isAdmin
            });
        } catch (err) {
            logEvent(reqId, 'AUTH_RESPONSE', 'ERROR', { status_code: 500, error: err.message });
            return res.status(500).json({
                status: 'error',
                message: err.message || 'Internal server error'
            });
        }
    }

    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
};

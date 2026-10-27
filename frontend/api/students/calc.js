// Vercel Serverless Function: /api/students/calc
// Tracks calculation events

const fs = require('fs');
const path = require('path');

const TMP_FILE = path.join('/tmp', 'centagon_students.json');
const BACKEND_URL = process.env.CENTAGON_API_URL || process.env.BACKEND_URL || '';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (BACKEND_URL) {
        try {
            const targetUrl = new URL(req.url, BACKEND_URL).toString();
            const fetch = global.fetch || require('node-fetch');
            const upstreamRes = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            });
            const data = await upstreamRes.json();
            return res.status(upstreamRes.status).json(data);
        } catch (err) {
            console.error('Proxy calculation track failed:', err.message);
        }
    }

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const email = (body.email || '').trim().toLowerCase();
            if (!email) {
                return res.status(200).json({ status: 'skipped' });
            }

            if (fs.existsSync(TMP_FILE)) {
                const students = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
                const student = students.find(s => (s.email || '').toLowerCase() === email);
                if (student) {
                    student.calculations_count = (parseInt(student.calculations_count) || 0) + 1;
                    student.last_active = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    fs.writeFileSync(TMP_FILE, JSON.stringify(students, null, 2), 'utf8');
                }
            }
            return res.status(200).json({ status: 'success' });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};

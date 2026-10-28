// Vercel Serverless Function: /api/students/calc
// Tracks calculation events across authoritative storage

const fs = require('fs');
const path = require('path');

const storagePath = fs.existsSync(path.join(__dirname, '..', '_storage.js'))
    ? path.join(__dirname, '..', '_storage.js')
    : path.join(__dirname, '_storage.js');
const { logCalculation } = require(storagePath);

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
            const fetchFn = global.fetch || require('node-fetch');
            const upstreamRes = await fetchFn(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
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
            const googleId = (body.google_id || body.sub || '').trim();

            if (!email && !googleId) {
                return res.status(200).json({ status: 'skipped' });
            }

            await logCalculation(email, googleId);
            return res.status(200).json({ status: 'success' });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../config/db');

router.post('/place', auth, async (req, res) => {
    const { matchId, selection, odds, stake } = req.body;
    const userId = req.user.id;

    if (!matchId || !selection || !odds || !stake || stake <= 0) {
        return res.status(400).json({ error: "ভুল ডেটা সাবমিট করা হয়েছে।" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const currentBalance = parseFloat(userRes.rows[0].balance);

        if (currentBalance < stake) {
            return res.status(400).json({ error: "আপনার ব্যালেন্স অপর্যাপ্ত।" });
        }

        const potentialReturn = stake * odds;

        await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [stake, userId]);

        await client.query(
            'INSERT INTO bets (user_id, match_id, selection, odds, stake, potential_return, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [userId, matchId, selection, odds, stake, potentialReturn, 'pending']
        );

        await client.query('COMMIT');
        res.json({ message: "আপনার বাজি সফলভাবে গ্রহণ করা হয়েছে!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "বেট প্লেস করার সময় ত্রুটি ঘটেছে।" });
    } finally {
        client.release();
    }
});

router.post('/admin/settle-match', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });

    const { matchId, winner } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query('UPDATE matches SET status = $1, winner = $2 WHERE id = $3', ['completed', winner, matchId]);

        const winningBets = await client.query(
            'SELECT * FROM bets WHERE match_id = $1 AND selection = $2 AND status = $3 FOR UPDATE',
            [matchId, winner, 'pending']
        );

        for (let bet of winningBets.rows) {
            await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [bet.potential_return, bet.user_id]);
            await client.query('UPDATE bets SET status = $1 WHERE id = $2', ['won', bet.id]);
        }

        await client.query('UPDATE bets SET status = $1 WHERE match_id = $2 AND selection != $3 AND status = $4', ['lost', matchId, winner, 'pending']);

        await client.query('COMMIT');
        res.json({ message: "ম্যাচ সফলভাবে সেটেল করা হয়েছে।" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "সেটেলমেন্ট ব্যর্থ হয়েছে।" });
    } finally {
        client.release();
    }
});

module.exports = router;

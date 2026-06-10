const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../config/db');

router.post('/deposit', auth, async (req, res) => {
    const { method, txid, amount } = req.body;
    const userId = req.user.id;

    if (!method || !txid || !amount || amount <= 0) {
        return res.status(400).json({ error: "সঠিক তথ্য প্রদান করুন।" });
    }

    try {
        await pool.query(
            'INSERT INTO transactions (user_id, method, txid, amount, status) VALUES ($1, $2, $3, $4, $5)',
            [userId, method, txid, amount, 'pending']
        );
        res.json({ message: "আপনার অনুরোধটি পেন্ডিং অবস্থায় রয়েছে। অ্যাডমিন ভেরিফাই করবে।" });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: "এই TxID টি ইতিমধ্যে ব্যবহৃত হয়েছে।" });
        res.status(500).json({ error: "সার্ভার এরর।" });
    }
});

router.post('/admin/approve/:txId', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "অ্যাক্সেস ডিনাইড।" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND status = $2 FOR UPDATE', [req.params.txId, 'pending']);
        if (txRes.rows.length === 0) throw new Error('Transaction not found or already processed');

        const tx = txRes.rows[0];

        await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [tx.amount, tx.user_id]);
        await client.query('UPDATE transactions SET status = $1 WHERE id = $2', ['approved', tx.id]);

        await client.query('COMMIT');
        res.json({ message: "ডিপোজিট সফলভাবে অ্যাপ্রুভ করা হয়েছে।" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message || "প্রসেস ব্যর্থ হয়েছে।" });
    } finally {
        client.release();
    }
});

module.exports = router;
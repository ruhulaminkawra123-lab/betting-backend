const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: "সবগুলো ফিল্ড পূরণ করুন।" });
    }

    try {
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, passwordHash]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "ইউজারনেম বা ইমেইল ইতিমধ্যে রেজিস্টার্ড।" });
        }
        res.status(500).json({ error: "সার্ভার এরর।" });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) return res.status(400).json({ error: "ভুল ইমেইল বা পাসওয়ার্ড।" });

        const user = userRes.rows[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "ভুল ইমেইল বা পাসওয়ার্ড।" });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { username: user.username, balance: user.balance } });
    } catch (err) {
        res.status(500).json({ error: "সার্ভার এরর।" });
    }
});

module.exports = router;
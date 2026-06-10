const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { pool } = require('./config/db');

require('./cron/liveScoreJob');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./controllers/authController'));
app.use('/api/wallet', require('./controllers/walletController'));
app.use('/api/bets', require('./controllers/betController'));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running secure on port ${PORT}`));
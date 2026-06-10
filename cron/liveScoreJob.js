const cron = require('node-cron');
const axios = require('axios');
const { pool } = require('../config/db');

cron.schedule('*/5 * * * *', async () => {
    console.log('Fetching live scores and odds from API...');
    try {
        const response = await axios.get(`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${process.env.FOOTBALL_API_KEY}&regions=eu`);
        
        const matchesData = response.data;

        for (let match of matchesData) {
            const teamA = match.home_team;
            const teamB = match.away_team;
            const oddsA = match.bookmakers[0]?.markets[0]?.outcomes.find(o => o.name === teamA)?.price || 1.0;
            const oddsB = match.bookmakers[0]?.markets[0]?.outcomes.find(o => o.name === teamB)?.price || 1.0;
            const oddsX = match.bookmakers[0]?.markets[0]?.outcomes.find(o => o.name === 'Draw')?.price || 1.0;

            await pool.query(
                `INSERT INTO matches (api_match_id, team_a, team_b, odds_a, odds_x, odds_b, match_time) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (api_match_id) 
                 DO UPDATE SET odds_a = $4, odds_x = $5, odds_b = $6`,
                [match.id, teamA, teamB, oddsA, oddsX, oddsB, match.commence_time]
            );
        }
        console.log('Database synced successfully with latest odds.');
    } catch (error) {
        console.error('Error syncing with sports API:', error.message);
    }
});
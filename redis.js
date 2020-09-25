const redis = require('redis');
const db = redis.createClient();

db.on('connect', () => {
    console.log('$ | Database connected!');
});

module.exports = db;
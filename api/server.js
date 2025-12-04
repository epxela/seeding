const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
let db;

async function connectDB() {
    await client.connect();
    db = client.db("apple_music_db");
    console.log("✅ Conectado a MongoDB");
}

app.get('/api/royalties', async (req, res) => {
    try {
        const period = req.query.period || '30d';
        const days = parseInt(period) || 30;
        
        const ratePerStream = parseFloat(req.query.rate) || 0.01;
        
        const ratePerMinute = parseFloat(req.query.rate_per_minute) || 0;
        
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        
        const result = await db.collection("streams").aggregate([
            { $match: { date: { $gte: dateFrom } } },
            { $lookup: { from: "artists", localField: "artist_id", foreignField: "_id", as: "artist" } },
            { $unwind: "$artist" },
            { $group: { 
                _id: "$artist_id", 
                artist: { $first: "$artist.name" },
                total_seconds: { $sum: "$seconds_played" }, 
                total_streams: { $sum: 1 } 
            }},
            { $project: { 
                artist_id: "$_id",
                artist: 1, 
                total_seconds: 1, 
                total_minutes: { $round: [{ $divide: ["$total_seconds", 60] }, 2] },
                total_hours: { $round: [{ $divide: ["$total_seconds", 3600] }, 2] }, 
                total_streams: 1 
            }},
            { $sort: { total_seconds: -1 } }
        ]).toArray();
        
        const dataWithEarnings = result.map(item => {
            let earnings = 0;
            
            if (ratePerMinute > 0) {
                earnings = item.total_minutes * ratePerMinute;
            } else {
                earnings = item.total_streams * ratePerStream;
            }
            
            return {
                ...item,
                rate_applied: ratePerMinute > 0 ? `$${ratePerMinute}/min` : `$${ratePerStream}/stream`,
                earnings_usd: parseFloat(earnings.toFixed(2))
            };
        });
        
        const totalEarnings = dataWithEarnings.reduce((sum, item) => sum + item.earnings_usd, 0);
        const totalStreams = dataWithEarnings.reduce((sum, item) => sum + item.total_streams, 0);
        const totalHours = dataWithEarnings.reduce((sum, item) => sum + item.total_hours, 0);
        
        res.json({
            success: true,
            period: `last_${days}_days`,
            rate_per_stream: `$${ratePerStream}`,
            generated_at: new Date().toISOString(),
            summary: {
                total_artists: dataWithEarnings.length,
                total_streams: totalStreams,
                total_hours: parseFloat(totalHours.toFixed(2)),
                total_earnings_usd: parseFloat(totalEarnings.toFixed(2))
            },
            data: dataWithEarnings
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/charts/top-songs', async (req, res) => {
    try {
        const region = req.query.region;
        const days = parseInt(req.query.days) || 7;
        const limit = parseInt(req.query.limit) || 10;
        
        if (!region) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 400, message: "El parámetro 'region' es requerido" }
            });
        }
        
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        
        const result = await db.collection("streams").aggregate([
            { $match: { date: { $gte: dateFrom } } },
            { $lookup: { from: "users", localField: "user_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $match: { "user.country": region.toUpperCase() } },
            { $lookup: { from: "songs", localField: "song_id", foreignField: "_id", as: "song" } },
            { $unwind: "$song" },
            { $group: { 
                _id: "$song_id", 
                song_title: { $first: "$song.title" }, 
                artist: { $first: "$song.artist_name" }, 
                play_count: { $sum: 1 } 
            }},
            { $sort: { play_count: -1 } },
            { $limit: limit }
        ]).toArray();
        
        // Agregar rank
        const dataWithRank = result.map((item, index) => ({
            rank: index + 1,
            song_id: item._id,
            song_title: item.song_title,
            artist: item.artist,
            play_count: item.play_count
        }));
        
        res.json({
            success: true,
            region: region.toUpperCase(),
            period_days: days,
            generated_at: new Date().toISOString(),
            data: dataWithRank
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/users/zombies', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const subscription = req.query.subscription || 'Premium';
        const country = req.query.country;
        
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        
        let matchStage = {};
        if (subscription !== 'All') {
            matchStage.subscription = subscription;
        }
        if (country) {
            matchStage.country = country.toUpperCase();
        }
        
        const result = await db.collection("users").aggregate([
            { $match: matchStage },
            { $lookup: { 
                from: "streams", 
                let: { userId: "$_id" }, 
                pipeline: [
                    { $match: { $expr: { $and: [ 
                        { $eq: ["$user_id", "$$userId"] }, 
                        { $gte: ["$date", dateFrom] } 
                    ]}}}
                ], 
                as: "recent_streams" 
            }},
            { $match: { recent_streams: { $size: 0 } } },
            { $project: { 
                user_id: "$_id",
                username: 1, 
                email: 1, 
                subscription: 1, 
                country: 1,
                last_activity: null
            }}
        ]).toArray();
        
        res.json({
            success: true,
            inactive_days_threshold: days,
            subscription_filter: subscription,
            total_at_risk: result.length,
            generated_at: new Date().toISOString(),
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/demographics/genre', async (req, res) => {
    try {
        const genre = req.query.genre;
        
        if (!genre) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 400, message: "El parámetro 'genre' es requerido" }
            });
        }
        
        const result = await db.collection("streams").aggregate([
            { $lookup: { from: "songs", localField: "song_id", foreignField: "_id", as: "song" } },
            { $unwind: "$song" },
            { $match: { "song.genre": { $regex: new RegExp(genre, 'i') } } },
            { $lookup: { from: "users", localField: "user_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $addFields: { 
                age: { $floor: { $divide: [ 
                    { $subtract: [new Date(), "$user.birth_date"] }, 
                    (365.25 * 24 * 60 * 60 * 1000) 
                ]}}
            }},
            { $bucket: { 
                groupBy: "$age", 
                boundaries: [0, 15, 21, 31, 41, 51, 100], 
                default: "Unknown", 
                output: { 
                    count: { $sum: 1 }, 
                    users: { $addToSet: "$user_id" } 
                } 
            }},
            { $project: { 
                age_range: { $switch: { branches: [
                    { case: { $eq: ["$_id", 0] }, then: "0-14" },
                    { case: { $eq: ["$_id", 15] }, then: "15-20" },
                    { case: { $eq: ["$_id", 21] }, then: "21-30" },
                    { case: { $eq: ["$_id", 31] }, then: "31-40" },
                    { case: { $eq: ["$_id", 41] }, then: "41-50" },
                    { case: { $eq: ["$_id", 51] }, then: "51+" }
                ], default: "Unknown" }}, 
                stream_count: "$count", 
                unique_users: { $size: "$users" } 
            }}
        ]).toArray();
        
        const totalStreams = result.reduce((sum, d) => sum + d.stream_count, 0);
        const dataWithPercentage = result.map(d => ({ 
            ...d, 
            percentage: ((d.stream_count / totalStreams) * 100).toFixed(2) + "%" 
        }));
        
        res.json({
            success: true,
            genre: genre,
            total_streams_analyzed: totalStreams,
            generated_at: new Date().toISOString(),
            data: dataWithPercentage
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/users/top-fans', async (req, res) => {
    try {
        const artist = req.query.artist;
        const limit = parseInt(req.query.limit) || 5;
        
        if (!artist) {
            return res.status(400).json({ 
                success: false, 
                error: { code: 400, message: "El parámetro 'artist' es requerido" }
            });
        }
        
        const result = await db.collection("streams").aggregate([
            { $lookup: { from: "songs", localField: "song_id", foreignField: "_id", as: "song" } },
            { $unwind: "$song" },
            { $match: { "song.artist_name": { $regex: new RegExp(artist, 'i') } } },
            { $group: { 
                _id: "$user_id", 
                unique_songs: { $addToSet: "$song_id" }, 
                total_plays: { $sum: 1 } 
            }},
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $project: { 
                user_id: "$_id", 
                username: "$user.username",
                email: "$user.email", 
                unique_songs_count: { $size: "$unique_songs" }, 
                total_plays: 1 
            }},
            { $sort: { unique_songs_count: -1, total_plays: -1 } },
            { $limit: limit }
        ]).toArray();
        
        // Agregar rank
        const dataWithRank = result.map((item, index) => ({
            rank: index + 1,
            ...item
        }));
        
        res.json({
            success: true,
            artist: artist,
            generated_at: new Date().toISOString(),
            data: dataWithRank
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/', (req, res) => {
    res.json({
        name: "Apple Music Analytics API",
        version: "1.0.0",
        endpoints: [
            { method: "GET", path: "/api/royalties", description: "Reporte de regalías por artista" },
            { method: "GET", path: "/api/charts/top-songs", description: "Top canciones por región" },
            { method: "GET", path: "/api/users/zombies", description: "Usuarios inactivos (churn risk)" },
            { method: "GET", path: "/api/demographics/genre", description: "Demografía por género musical" },
            { method: "GET", path: "/api/users/top-fans", description: "Top fans de un artista" }
        ]
    });
});


connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`API corriendo en http://localhost:${PORT}`);
        console.log(`Documentación en http://localhost:${PORT}/`);
    });
}).catch(console.error);

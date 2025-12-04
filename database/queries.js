const { MongoClient } = require('mongodb');

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function runQueries() {
    try {
        await client.connect();
        const db = client.db("apple_music_db");
        

        console.log("CONSULTA 1: Reporte de Regalías (Royalties)");
        console.log("Pregunta: ¿Cuánto tiempo total se ha reproducido cada artista en el último mes?\n");
        
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const royalties = await db.collection("streams").aggregate([
            { $match: { date: { $gte: lastMonth } } },
            { $lookup: { from: "artists", localField: "artist_id", foreignField: "_id", as: "artist" } },
            { $unwind: "$artist" },
            { $group: { 
                _id: "$artist_id", 
                artist_name: { $first: "$artist.name" },
                total_seconds: { $sum: "$seconds_played" }, 
                total_streams: { $sum: 1 } 
            }},
            { $project: { 
                artist: "$artist_name", 
                total_seconds: 1, 
                total_minutes: { $round: [{ $divide: ["$total_seconds", 60] }, 2] },
                total_hours: { $round: [{ $divide: ["$total_seconds", 3600] }, 2] }, 
                total_streams: 1 
            }},
            { $sort: { total_seconds: -1 } }
        ]).toArray();
        console.log("Resultado:", JSON.stringify(royalties, null, 2));

        console.log("\nCONSULTA 2: Top 10 Canciones en Guatemala");
        console.log("Pregunta: ¿Cuáles son las 10 canciones más escuchadas en Guatemala en los últimos 7 días?\n");
        
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);
        
        const top10Guatemala = await db.collection("streams").aggregate([
            { $match: { date: { $gte: last7Days } } },
            { $lookup: { from: "users", localField: "user_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $match: { "user.country": "GT" } },
            { $lookup: { from: "songs", localField: "song_id", foreignField: "_id", as: "song" } },
            { $unwind: "$song" },
            { $group: { 
                _id: "$song_id", 
                song_title: { $first: "$song.title" }, 
                artist: { $first: "$song.artist_name" }, 
                play_count: { $sum: 1 } 
            }},
            { $sort: { play_count: -1 } },
            { $limit: 10 }
        ]).toArray();
        console.log("Resultado:", JSON.stringify(top10Guatemala, null, 2));

        console.log("\nCONSULTA 3: Usuarios Zombis (Churn Risk)");
        console.log("Pregunta: Usuarios Premium que NO han reproducido nada en 30 días\n");
        
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        
        const zombieUsers = await db.collection("users").aggregate([
            { $match: { subscription: "Premium" } },
            { $lookup: { 
                from: "streams", 
                let: { userId: "$_id" }, 
                pipeline: [
                    { $match: { $expr: { $and: [ 
                        { $eq: ["$user_id", "$$userId"] }, 
                        { $gte: ["$date", last30Days] } 
                    ]}}}
                ], 
                as: "recent_streams" 
            }},
            { $match: { recent_streams: { $size: 0 } } },
            { $project: { _id: 1, username: 1, email: 1, subscription: 1, country: 1 } }
        ]).toArray();
        console.log("Resultado:", JSON.stringify(zombieUsers, null, 2));
        console.log("Total usuarios zombis:", zombieUsers.length);

        console.log("\nCONSULTA 4: Demografía de Oyentes de Reggaeton");
        console.log("Pregunta: Distribución por edades de quienes escuchan Reggaeton\n");
        
        const demographicsReggaeton = await db.collection("streams").aggregate([
            { $lookup: { from: "songs", localField: "song_id", foreignField: "_id", as: "song" } },
            { $unwind: "$song" },
            { $match: { "song.genre": "Reggaeton" } },
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
        
        const totalStreams = demographicsReggaeton.reduce((sum, d) => sum + d.stream_count, 0);
        const withPercentages = demographicsReggaeton.map(d => ({ 
            ...d, 
            percentage: ((d.stream_count / totalStreams) * 100).toFixed(2) + "%" 
        }));
        console.log("Resultado:", JSON.stringify(withPercentages, null, 2));

        console.log("\nCONSULTA 5: Top 5 Fans de Bad Bunny");
        console.log("Pregunta: Los 5 usuarios que más canciones DISTINTAS han escuchado de Bad Bunny\n");
        
        const heavyUsersBadBunny = await db.collection("streams").aggregate([
            { $lookup: { from: "songs", localField: "song_id", foreignField: "_id", as: "song" } },
            { $unwind: "$song" },
            { $match: { "song.artist_name": "Bad Bunny" } },
            { $group: { 
                _id: "$user_id", 
                unique_songs: { $addToSet: "$song_id" }, 
                total_plays: { $sum: 1 } 
            }},
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $project: { 
                user_id: "$_id", 
                user_name: "$user.username",
                user_email: "$user.email", 
                unique_songs_count: { $size: "$unique_songs" }, 
                total_plays: 1 
            }},
            { $sort: { unique_songs_count: -1 } },
            { $limit: 5 }
        ]).toArray();
        console.log("Resultado:", JSON.stringify(heavyUsersBadBunny, null, 2));


    } finally {
        await client.close();
    }
}

runQueries().catch(console.error);

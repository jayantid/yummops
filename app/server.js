const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

const PORT = process.env.PORT || 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Initialize Redis client
let redisClient = null;
(async () => {
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
    console.log('Connected to Redis at', REDIS_URL);
  } catch (err) {
    console.error('Failed to connect to Redis, falling back to in-memory store', err);
    redisClient = null;
  }
})();

// In-memory fallback votes
const memoryVotes = {
  'tacos': 12,
  'ramen': 18,
  'pizza': 15,
  'sushi': 22
};

async function getVotes() {
  if (redisClient) {
    try {
      const keys = ['tacos', 'ramen', 'pizza', 'sushi'];
      const votes = {};
      for (const key of keys) {
        const val = await redisClient.get(`votes:${key}`);
        votes[key] = val ? parseInt(val, 10) : 0;
      }
      return votes;
    } catch (err) {
      console.error('Error fetching votes from Redis', err);
    }
  }
  return memoryVotes;
}

async function incrementVote(item) {
  const keys = ['tacos', 'ramen', 'pizza', 'sushi'];
  if (!keys.includes(item)) return null;

  if (redisClient) {
    try {
      const newVal = await redisClient.incr(`votes:${item}`);
      return newVal;
    } catch (err) {
      console.error('Error incrementing vote in Redis', err);
    }
  }
  memoryVotes[item] = (memoryVotes[item] || 0) + 1;
  return memoryVotes[item];
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      }
    });
  } else if (req.url === '/api/votes' && req.method === 'GET') {
    const votes = await getVotes();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(votes));
  } else if (req.url.startsWith('/api/vote/') && req.method === 'POST') {
    const item = req.url.split('/').pop();
    const count = await incrementVote(item);
    if (count === null) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid food item' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ item, count }));
    }
  } else if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', redis: redisClient !== null }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`YummOps web server running on port ${PORT}`);
});

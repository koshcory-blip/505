import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "505-data.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const seed = {
  me: {
    id: "me",
    name: "Isaac",
    handle: "isaac",
    avatar: "IR",
    bio: "Paramedic loading • making things • going places",
    vibe: "building",
    followers: 1284,
    following: 391
  },
  users: [
    { id:"u1", name:"Maya Chen", handle:"mayac", avatar:"MC", bio:"film / design / nyc", vibe:"creating", followers:18200, following:622 },
    { id:"u2", name:"Noah Brooks", handle:"noahb", avatar:"NB", bio:"music, pixels, good coffee", vibe:"listening", followers:6400, following:441 },
    { id:"u3", name:"Ari Jones", handle:"arij", avatar:"AJ", bio:"photographer • atl", vibe:"outside", followers:9300, following:703 },
    { id:"u4", name:"Zee", handle:"zeezone", avatar:"Z", bio:"internet archaeologist", vibe:"online", followers:31600, following:912 }
  ],
  rooms: [
    { id:"r1", name:"Main Character Energy", emoji:"✦", members:28400, live:884 },
    { id:"r2", name:"Creative Internet", emoji:"◉", members:17900, live:432 },
    { id:"r3", name:"Night Shift", emoji:"☾", members:12800, live:1206 },
    { id:"r4", name:"What are we listening to?", emoji:"♫", members:44100, live:2390 }
  ],
  posts: [
    {
      id:"p1", userId:"u1", createdAt: Date.now()-1000*60*6,
      text:"the internet needs more places that feel like hanging out and fewer places that feel like performing for an algorithm.",
      room:"Creative Internet", media:null,
      reactions:{fire:842, real:1900, laugh:113, heart:731}, replies:184, reposts:262, views:23800
    },
    {
      id:"p2", userId:"u3", createdAt: Date.now()-1000*60*24,
      text:"took my camera out with zero plan. best photos I’ve made in months.",
      room:null,
      media:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      reactions:{fire:2300, real:607, laugh:29, heart:4100}, replies:242, reposts:533, views:76100
    },
    {
      id:"p3", userId:"u4", createdAt: Date.now()-1000*60*51,
      text:"bring back niche internet. weird forums. personal websites. usernames that make no sense. everyone does NOT need to be a brand.",
      room:"Main Character Energy", media:null,
      reactions:{fire:1800, real:3200, laugh:900, heart:1200}, replies:391, reposts:1200, views:103000
    },
    {
      id:"p4", userId:"u2", createdAt: Date.now()-1000*60*95,
      text:"drop one song you’d erase your memory just to hear again for the first time",
      room:"What are we listening to?", media:null,
      reactions:{fire:507, real:260, laugh:44, heart:980}, replies:1400, reposts:88, views:44900
    }
  ],
  bookmarks: [],
  notifications: [
    { id:"n1", text:"Maya followed you", time: Date.now()-1000*60*13, read:false },
    { id:"n2", text:"Ari reacted ❤️ to your post", time: Date.now()-1000*60*48, read:false },
    { id:"n3", text:"Your post passed 1K views", time: Date.now()-1000*60*160, read:true }
  ]
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return structuredClone(seed);
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return structuredClone(seed); }
}

let db = loadData();
const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

function hydratePost(post) {
  const user = post.userId === "me" ? db.me : db.users.find(u => u.id === post.userId);
  return { ...post, user, bookmarked: db.bookmarks.includes(post.id) };
}

app.get("/api/bootstrap", (_req, res) => {
  res.json({
    me: db.me,
    users: db.users,
    rooms: db.rooms,
    notifications: db.notifications,
    posts: db.posts.map(hydratePost)
  });
});

app.post("/api/posts", (req, res) => {
  const text = String(req.body?.text || "").trim();
  const room = String(req.body?.room || "").trim() || null;
  const media = String(req.body?.media || "").trim() || null;

  if (!text && !media) return res.status(400).json({ error:"Write something or add media." });
  if (text.length > 500) return res.status(400).json({ error:"Posts are limited to 500 characters." });

  const post = {
    id: "p" + Date.now(),
    userId: "me",
    createdAt: Date.now(),
    text,
    room,
    media,
    reactions:{ fire:0, real:0, laugh:0, heart:0 },
    replies:0, reposts:0, views:1
  };
  db.posts.unshift(post);
  save();
  res.json(hydratePost(post));
});

app.post("/api/posts/:id/react", (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  const type = req.body?.type;
  if (!post || !["fire","real","laugh","heart"].includes(type)) return res.status(400).json({ error:"Invalid reaction." });
  post.reactions[type] = (post.reactions[type] || 0) + 1;
  save();
  res.json(hydratePost(post));
});

app.post("/api/posts/:id/bookmark", (req, res) => {
  const id = req.params.id;
  if (db.bookmarks.includes(id)) db.bookmarks = db.bookmarks.filter(x => x !== id);
  else db.bookmarks.push(id);
  save();
  res.json({ bookmarked: db.bookmarks.includes(id) });
});

app.delete("/api/posts/:id", (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post || post.userId !== "me") return res.status(403).json({ error:"You can only delete your own posts." });
  db.posts = db.posts.filter(p => p.id !== req.params.id);
  db.bookmarks = db.bookmarks.filter(id => id !== req.params.id);
  save();
  res.json({ ok:true });
});

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ posts:[], users:[], rooms:[] });
  res.json({
    posts: db.posts.map(hydratePost).filter(p => p.text.toLowerCase().includes(q) || p.user.name.toLowerCase().includes(q) || p.user.handle.toLowerCase().includes(q)),
    users: [db.me, ...db.users].filter(u => u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q) || u.bio.toLowerCase().includes(q)),
    rooms: db.rooms.filter(r => r.name.toLowerCase().includes(q))
  });
});

app.listen(PORT, () => console.log(`505 is live at http://localhost:${PORT}`));

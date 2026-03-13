import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("calendar.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Check if notes table needs update
const tableInfo = db.prepare("PRAGMA table_info(notes)").all() as any[];
const hasPersonId = tableInfo.some(col => col.name === 'person_id');

if (!hasPersonId) {
  // If it's the old table, we need to recreate it to support the new schema
  // or just drop and recreate if data loss is acceptable in this dev phase
  db.exec(`
    DROP TABLE IF EXISTS notes;
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(person_id, date),
      FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
    );
  `);
} else {
  // Ensure the table exists even if it wasn't there at all
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(person_id, date),
      FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
    );
  `);
}

// Seed default person if none exists
const count = db.prepare("SELECT COUNT(*) as count FROM people").get() as { count: number };
if (count.count === 0) {
  db.prepare("INSERT INTO people (name) VALUES (?)").run("我的日历");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // People API
  app.get("/api/people", (req, res) => {
    const people = db.prepare("SELECT * FROM people").all();
    res.json(people);
  });

  app.post("/api/people", (req, res) => {
    const { name } = req.body;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const result = db.prepare("INSERT INTO people (name, avatar_color) VALUES (?, ?)").run(name, randomColor);
    res.json({ id: result.lastInsertRowid, name, avatar_color: randomColor });
  });

  app.delete("/api/people/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM people WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/notes", (req, res) => {
    const { month, personId } = req.query;
    if (!personId) return res.status(400).json({ error: "personId is required" });

    let notes;
    if (personId === '1') {
      // Aggregated view for "My Calendar"
      const query = month 
        ? "SELECT n.*, p.name as person_name FROM notes n JOIN people p ON n.person_id = p.id WHERE n.date LIKE ?"
        : "SELECT n.*, p.name as person_name FROM notes n JOIN people p ON n.person_id = p.id";
      notes = month ? db.prepare(query).all(`${month}%`) : db.prepare(query).all();
    } else {
      const query = month
        ? "SELECT n.*, p.name as person_name FROM notes n JOIN people p ON n.person_id = p.id WHERE n.person_id = ? AND n.date LIKE ?"
        : "SELECT n.*, p.name as person_name FROM notes n JOIN people p ON n.person_id = p.id WHERE n.person_id = ?";
      notes = month ? db.prepare(query).all(personId, `${month}%`) : db.prepare(query).all(personId);
    }
    res.json(notes.map((n: any) => ({ ...n, entries: JSON.parse(n.content || '[]') })));
  });

  app.post("/api/notes", (req, res) => {
    const { date, entries, personId } = req.body;
    if (!personId) return res.status(400).json({ error: "personId is required" });
    
    const contentJson = JSON.stringify(entries);
    const stmt = db.prepare(`
      INSERT INTO notes (person_id, date, content)
      VALUES (?, ?, ?)
      ON CONFLICT(person_id, date) DO UPDATE SET
        content = excluded.content
    `);
    stmt.run(personId, date, contentJson);
    res.json({ success: true });
  });

  app.delete("/api/notes/:personId/:date", (req, res) => {
    const { personId, date } = req.params;
    db.prepare("DELETE FROM notes WHERE person_id = ? AND date = ?").run(personId, date);
    res.json({ success: true });
  });

  app.get("/api/search", (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);

    const query = `
      SELECT n.*, p.name as person_name, p.avatar_color 
      FROM notes n 
      JOIN people p ON n.person_id = p.id 
      WHERE n.content LIKE ? 
      ORDER BY n.date DESC
    `;
    const results = db.prepare(query).all(`%${q}%`);
    
    // Parse content and filter entries that match the search term
    const filteredResults = results.flatMap((row: any) => {
      const entries = JSON.parse(row.content || '[]') as any[];
      return entries
        .filter(entry => 
          entry.content.toLowerCase().includes(String(q).toLowerCase()) || 
          entry.tag.toLowerCase().includes(String(q).toLowerCase())
        )
        .map(entry => ({
          ...row,
          entry,
          date: row.date
        }));
    });

    res.json(filteredResults);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

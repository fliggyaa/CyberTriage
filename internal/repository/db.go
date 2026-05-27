package repository

import (
	"database/sql"
	"fmt"
	"log"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		return fmt.Errorf("resolve db path: %w", err)
	}

	DB, err = sql.Open("sqlite", absPath+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err := migrate(); err != nil {
		return fmt.Errorf("migrate db: %w", err)
	}

	log.Printf("Database initialized at %s", absPath)
	return nil
}

func migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		os_type TEXT NOT NULL,
		description TEXT DEFAULT '',
		status TEXT DEFAULT 'pending',
		file_path TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS reports (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		task_id INTEGER NOT NULL,
		raw_content TEXT DEFAULT '',
		parsed_data TEXT DEFAULT '',
		charts_data TEXT DEFAULT '',
		ai_analysis TEXT DEFAULT '',
		risk_level TEXT DEFAULT 'unknown',
		ai_completed INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS model_configs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		provider TEXT NOT NULL,
		endpoint TEXT NOT NULL,
		api_key TEXT DEFAULT '',
		model_name TEXT DEFAULT '',
		temperature REAL DEFAULT 0.7,
		max_tokens INTEGER DEFAULT 4096,
		is_active INTEGER DEFAULT 0,
		description TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_reports_task_id ON reports(task_id);
	CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

	CREATE TABLE IF NOT EXISTS conversations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		task_id INTEGER DEFAULT 0,
		title TEXT DEFAULT '新对话',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		conv_id INTEGER NOT NULL,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (conv_id) REFERENCES conversations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages(conv_id);
	`

	_, err := DB.Exec(schema)
	return err
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
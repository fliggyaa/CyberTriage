package repository

import (
	"emergency-response-platform/internal/model"
	"time"
)

// ---- Conversations ----

func CreateConversation(taskID int64, title string) (int64, error) {
	now := time.Now()
	result, err := DB.Exec(
		`INSERT INTO conversations (task_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
		taskID, title, now, now,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func ListConversations() ([]model.Conversation, error) {
	rows, err := DB.Query(
		`SELECT id, task_id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []model.Conversation
	for rows.Next() {
		var c model.Conversation
		if err := rows.Scan(&c.ID, &c.TaskID, &c.Title, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		convs = append(convs, c)
	}
	return convs, nil
}

func GetConversation(id int64) (*model.Conversation, error) {
	c := &model.Conversation{}
	err := DB.QueryRow(
		`SELECT id, task_id, title, created_at, updated_at FROM conversations WHERE id = ?`, id,
	).Scan(&c.ID, &c.TaskID, &c.Title, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func UpdateConversationTitle(id int64, title string) error {
	_, err := DB.Exec(
		`UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`,
		title, time.Now(), id,
	)
	return err
}

func UpdateConversationTask(id int64, taskID int64) error {
	_, err := DB.Exec(
		`UPDATE conversations SET task_id = ?, updated_at = ? WHERE id = ?`,
		taskID, time.Now(), id,
	)
	return err
}

func TouchConversation(id int64) error {
	_, err := DB.Exec(`UPDATE conversations SET updated_at = ? WHERE id = ?`, time.Now(), id)
	return err
}

func DeleteConversation(id int64) error {
	_, err := DB.Exec(`DELETE FROM conversations WHERE id = ?`, id)
	return err
}

// ---- Messages ----

func CreateMessage(convID int64, role, content string) (int64, error) {
	result, err := DB.Exec(
		`INSERT INTO messages (conv_id, role, content, created_at) VALUES (?, ?, ?, ?)`,
		convID, role, content, time.Now(),
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func ListMessages(convID int64) ([]model.Message, error) {
	rows, err := DB.Query(
		`SELECT id, conv_id, role, content, created_at FROM messages WHERE conv_id = ? ORDER BY created_at ASC`,
		convID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []model.Message
	for rows.Next() {
		var m model.Message
		if err := rows.Scan(&m.ID, &m.ConvID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}
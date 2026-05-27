package repository

import (
	"emergency-response-platform/internal/model"
	"time"
)

func CreateTask(task *model.Task) (int64, error) {
	result, err := DB.Exec(
		`INSERT INTO tasks (name, os_type, description, status, file_path, created_at, updated_at) 
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		task.Name, task.OSType, task.Description, task.Status, task.FilePath,
		time.Now(), time.Now(),
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func GetTaskByID(id int64) (*model.Task, error) {
	task := &model.Task{}
	err := DB.QueryRow(
		`SELECT id, name, os_type, description, status, file_path, created_at, updated_at 
		 FROM tasks WHERE id = ?`, id,
	).Scan(&task.ID, &task.Name, &task.OSType, &task.Description,
		&task.Status, &task.FilePath, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return task, nil
}

func ListTasks() ([]model.Task, error) {
	rows, err := DB.Query(
		`SELECT id, name, os_type, description, status, file_path, created_at, updated_at 
		 FROM tasks ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(&t.ID, &t.Name, &t.OSType, &t.Description,
			&t.Status, &t.FilePath, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func UpdateTaskStatus(id int64, status string) error {
	_, err := DB.Exec(
		`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`,
		status, time.Now(), id,
	)
	return err
}

func UpdateTaskFilePath(id int64, filePath string) error {
	_, err := DB.Exec(
		`UPDATE tasks SET file_path = ?, updated_at = ? WHERE id = ?`,
		filePath, time.Now(), id,
	)
	return err
}

func DeleteTask(id int64) error {
	_, err := DB.Exec(`DELETE FROM tasks WHERE id = ?`, id)
	return err
}

func UpdateTask(id int64, name, osType, description string) error {
	_, err := DB.Exec(
		`UPDATE tasks SET name = ?, os_type = ?, description = ?, updated_at = ? WHERE id = ?`,
		name, osType, description, time.Now(), id,
	)
	return err
}
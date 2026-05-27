package repository

import (
	"emergency-response-platform/internal/model"
	"time"
)

func CreateModelConfig(cfg *model.ModelConfig) (int64, error) {
	result, err := DB.Exec(
		`INSERT INTO model_configs (name, provider, endpoint, api_key, model_name, 
		 temperature, max_tokens, is_active, description, created_at, updated_at) 
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		cfg.Name, cfg.Provider, cfg.Endpoint, cfg.APIKey, cfg.ModelName,
		cfg.Temperature, cfg.MaxTokens, boolToInt(cfg.IsActive), cfg.Description,
		time.Now(), time.Now(),
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func GetModelConfigByID(id int64) (*model.ModelConfig, error) {
	cfg := &model.ModelConfig{}
	var isActive int
	err := DB.QueryRow(
		`SELECT id, name, provider, endpoint, api_key, model_name, 
		 temperature, max_tokens, is_active, description, created_at, updated_at 
		 FROM model_configs WHERE id = ?`, id,
	).Scan(&cfg.ID, &cfg.Name, &cfg.Provider, &cfg.Endpoint, &cfg.APIKey,
		&cfg.ModelName, &cfg.Temperature, &cfg.MaxTokens, &isActive,
		&cfg.Description, &cfg.CreatedAt, &cfg.UpdatedAt)
	if err != nil {
		return nil, err
	}
	cfg.IsActive = isActive == 1
	return cfg, nil
}

func GetActiveModelConfig() (*model.ModelConfig, error) {
	cfg := &model.ModelConfig{}
	var isActive int
	err := DB.QueryRow(
		`SELECT id, name, provider, endpoint, api_key, model_name, 
		 temperature, max_tokens, is_active, description, created_at, updated_at 
		 FROM model_configs WHERE is_active = 1 LIMIT 1`,
	).Scan(&cfg.ID, &cfg.Name, &cfg.Provider, &cfg.Endpoint, &cfg.APIKey,
		&cfg.ModelName, &cfg.Temperature, &cfg.MaxTokens, &isActive,
		&cfg.Description, &cfg.CreatedAt, &cfg.UpdatedAt)
	if err != nil {
		return nil, err
	}
	cfg.IsActive = isActive == 1
	return cfg, nil
}

func ListModelConfigs() ([]model.ModelConfig, error) {
	rows, err := DB.Query(
		`SELECT id, name, provider, endpoint, api_key, model_name, 
		 temperature, max_tokens, is_active, description, created_at, updated_at 
		 FROM model_configs ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []model.ModelConfig
	for rows.Next() {
		var cfg model.ModelConfig
		var isActive int
		if err := rows.Scan(&cfg.ID, &cfg.Name, &cfg.Provider, &cfg.Endpoint,
			&cfg.APIKey, &cfg.ModelName, &cfg.Temperature, &cfg.MaxTokens,
			&isActive, &cfg.Description, &cfg.CreatedAt, &cfg.UpdatedAt); err != nil {
			return nil, err
		}
		cfg.IsActive = isActive == 1
		configs = append(configs, cfg)
	}
	return configs, nil
}

func UpdateModelConfig(cfg *model.ModelConfig) error {
	_, err := DB.Exec(
		`UPDATE model_configs SET name=?, provider=?, endpoint=?, api_key=?, model_name=?, 
		 temperature=?, max_tokens=?, is_active=?, description=?, updated_at=? WHERE id=?`,
		cfg.Name, cfg.Provider, cfg.Endpoint, cfg.APIKey, cfg.ModelName,
		cfg.Temperature, cfg.MaxTokens, boolToInt(cfg.IsActive), cfg.Description,
		time.Now(), cfg.ID,
	)
	return err
}

func SetActiveModelConfig(id int64) error {
	_, err := DB.Exec(`UPDATE model_configs SET is_active = 0`)
	if err != nil {
		return err
	}
	_, err = DB.Exec(`UPDATE model_configs SET is_active = 1, updated_at = ? WHERE id = ?`,
		time.Now(), id)
	return err
}

func DeleteModelConfig(id int64) error {
	_, err := DB.Exec(`DELETE FROM model_configs WHERE id = ?`, id)
	return err
}
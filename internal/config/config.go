package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	Server   ServerConfig   `json:"server"`
	Database DatabaseConfig `json:"database"`
	Upload   UploadConfig   `json:"upload"`
}

type ServerConfig struct {
	Port string `json:"port"`
	Mode string `json:"mode"`
}

type DatabaseConfig struct {
	Path string `json:"path"`
}

type UploadConfig struct {
	Dir      string `json:"dir"`
	MaxSize  int64  `json:"max_size"`
}

var AppConfig *Config

func Load() error {
	AppConfig = &Config{
		Server: ServerConfig{
			Port: "8080",
			Mode: "debug",
		},
		Database: DatabaseConfig{
			Path: "data/emergency.db",
		},
		Upload: UploadConfig{
			Dir:     "data/uploads",
			MaxSize: 100 << 20,
		},
	}

	if port := os.Getenv("PORT"); port != "" {
		AppConfig.Server.Port = port
	}
	if mode := os.Getenv("GIN_MODE"); mode != "" {
		AppConfig.Server.Mode = mode
	}
	if dbPath := os.Getenv("DB_PATH"); dbPath != "" {
		AppConfig.Database.Path = dbPath
	}

	configPath := filepath.Join("config.json")
	if data, err := os.ReadFile(configPath); err == nil {
		var fileCfg Config
		if err := json.Unmarshal(data, &fileCfg); err == nil {
			if fileCfg.Server.Port != "" {
				AppConfig.Server.Port = fileCfg.Server.Port
			}
			if fileCfg.Database.Path != "" {
				AppConfig.Database.Path = fileCfg.Database.Path
			}
			if fileCfg.Upload.Dir != "" {
				AppConfig.Upload.Dir = fileCfg.Upload.Dir
			}
			if fileCfg.Upload.MaxSize > 0 {
				AppConfig.Upload.MaxSize = fileCfg.Upload.MaxSize
			}
		}
	}

	dbDir := filepath.Dir(AppConfig.Database.Path)
	os.MkdirAll(dbDir, 0755)
	os.MkdirAll(AppConfig.Upload.Dir, 0755)

	return nil
}
package service

import (
	"emergency-response-platform/internal/model"
	"emergency-response-platform/internal/repository"
)

func GetActiveModelConfig() (*model.ModelConfig, error) {
	return repository.GetActiveModelConfig()
}

func ListModelConfigs() ([]model.ModelConfig, error) {
	return repository.ListModelConfigs()
}

func CreateModelConfig(cfg *model.ModelConfig) (int64, error) {
	return repository.CreateModelConfig(cfg)
}

func UpdateModelConfigService(cfg *model.ModelConfig) error {
	return repository.UpdateModelConfig(cfg)
}

func SetActiveModel(id int64) error {
	return repository.SetActiveModelConfig(id)
}

func DeleteModelConfig(id int64) error {
	return repository.DeleteModelConfig(id)
}
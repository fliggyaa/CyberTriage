package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"emergency-response-platform/internal/model"
	"emergency-response-platform/internal/repository"

	"github.com/gin-gonic/gin"
)

type modelConfigRequest struct {
	Name        string  `json:"name"`
	Provider    string  `json:"provider"`
	Endpoint    string  `json:"endpoint"`
	APIKey      string  `json:"api_key"`
	ModelName   string  `json:"model_name"`
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
	Description string  `json:"description"`
}

func ListModelConfigs(c *gin.Context) {
	configs, err := repository.ListModelConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if configs == nil {
		configs = []model.ModelConfig{}
	}
	c.JSON(http.StatusOK, gin.H{"model_configs": configs})
}

func CreateModelConfig(c *gin.Context) {
	var req modelConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Name == "" || req.Endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and endpoint are required"})
		return
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 4096
	}

	cfg := &model.ModelConfig{
		Name:        req.Name,
		Provider:    req.Provider,
		Endpoint:    req.Endpoint,
		APIKey:      req.APIKey,
		ModelName:   req.ModelName,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Description: req.Description,
	}

	id, err := repository.CreateModelConfig(cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	cfg.ID = id
	c.JSON(http.StatusCreated, gin.H{"model_config": cfg})
}

func UpdateModelConfig(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	existing, err := repository.GetModelConfigByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "model config not found"})
		return
	}

	var req modelConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Provider != "" {
		existing.Provider = req.Provider
	}
	if req.Endpoint != "" {
		existing.Endpoint = req.Endpoint
	}
	existing.APIKey = req.APIKey
	if req.ModelName != "" {
		existing.ModelName = req.ModelName
	}
	if req.Temperature > 0 {
		existing.Temperature = req.Temperature
	}
	if req.MaxTokens > 0 {
		existing.MaxTokens = req.MaxTokens
	}
	existing.Description = req.Description

	if err := repository.UpdateModelConfig(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"model_config": existing})
}

func DeleteModelConfig(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := repository.DeleteModelConfig(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func SetActiveModel(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := repository.SetActiveModelConfig(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "activated"})
}

func TestModelConnection(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	cfg, err := repository.GetModelConfigByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "model config not found"})
		return
	}

	reqBody := map[string]interface{}{
		"model": cfg.ModelName,
		"messages": []map[string]string{
			{"role": "user", "content": "Hello, respond with 'OK' only."},
		},
		"max_tokens":  10,
		"temperature": 0.1,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	httpReq, err := http.NewRequest("POST", cfg.Endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create request failed", "success": false})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "connection failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "connection successful"})
	} else {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "unexpected status: " + resp.Status})
	}
}

func TestModelConnectionRaw(c *gin.Context) {
	var req struct {
		Endpoint  string `json:"endpoint"`
		APIKey    string `json:"api_key"`
		ModelName string `json:"model_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "endpoint is required"})
		return
	}

	reqBody := map[string]interface{}{
		"model": req.ModelName,
		"messages": []map[string]string{
			{"role": "user", "content": "Hello, respond with 'OK' only."},
		},
		"max_tokens":  10,
		"temperature": 0.1,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	httpReq, err := http.NewRequest("POST", req.Endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "create request failed"})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if req.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "connection failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "connection successful"})
	} else {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "unexpected status: " + resp.Status})
	}
}
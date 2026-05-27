package handler

import (
	"net/http"
	"strconv"

	"emergency-response-platform/internal/repository"
	"emergency-response-platform/internal/service"

	"github.com/gin-gonic/gin"
)

func RunAIAnalysis(c *gin.Context) {
	var req struct {
		TaskID        int64 `json:"task_id"`
		ModelConfigID int64 `json:"model_config_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.TaskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task_id is required"})
		return
	}

	task, err := repository.GetTaskByID(req.TaskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	report, err := repository.GetReportByTaskID(req.TaskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no report found for this task, please upload first"})
		return
	}

	var modelCfg *struct {
		Endpoint    string
		APIKey      string
		ModelName   string
		Temperature float64
		MaxTokens   int
	}

	if req.ModelConfigID > 0 {
		cfg, err := repository.GetModelConfigByID(req.ModelConfigID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "model config not found"})
			return
		}
		modelCfg = &struct {
			Endpoint    string
			APIKey      string
			ModelName   string
			Temperature float64
			MaxTokens   int
		}{
			Endpoint:    cfg.Endpoint,
			APIKey:      cfg.APIKey,
			ModelName:   cfg.ModelName,
			Temperature: cfg.Temperature,
			MaxTokens:   cfg.MaxTokens,
		}
	} else {
		cfg, err := repository.GetActiveModelConfig()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no active model config, please configure or specify model_config_id"})
			return
		}
		modelCfg = &struct {
			Endpoint    string
			APIKey      string
			ModelName   string
			Temperature float64
			MaxTokens   int
		}{
			Endpoint:    cfg.Endpoint,
			APIKey:      cfg.APIKey,
			ModelName:   cfg.ModelName,
			Temperature: cfg.Temperature,
			MaxTokens:   cfg.MaxTokens,
		}
	}

	aiResult, riskLevel, err := service.RunAIAnalysis(report, task.Name, task.OSType, modelCfg.Endpoint, modelCfg.APIKey, modelCfg.ModelName, modelCfg.Temperature, modelCfg.MaxTokens)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI analysis failed: " + err.Error()})
		return
	}

	if err := repository.UpdateReportAIAnalysis(report.ID, aiResult, riskLevel); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save ai analysis failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "AI analysis completed",
		"analysis":   aiResult,
		"risk_level": riskLevel,
		"report_id":  report.ID,
	})
}

func GetAIAnalysis(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("task_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task_id"})
		return
	}

	report, err := repository.GetReportByTaskID(taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no report found for this task"})
		return
	}

	if !report.AICompleted {
		c.JSON(http.StatusOK, gin.H{
			"completed": false,
			"analysis":  "AI analysis not yet completed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"completed":  true,
		"analysis":   report.AIAnalysis,
		"risk_level": report.RiskLevel,
	})
}
package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"emergency-response-platform/internal/model"
	"emergency-response-platform/internal/repository"
	"emergency-response-platform/internal/service"

	"github.com/gin-gonic/gin"
)

type chatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatReq struct {
	TaskID   int64     `json:"task_id"`
	Messages []chatMsg `json:"messages"`
}

const (
	// maxContextChars triggers context compression when total message
	// text exceeds ~4000 estimated tokens (Chinese ~1.5 tokens/char, English ~0.3).
	maxContextChars = 10000
	// keepLastMessages is the number of most recent messages always kept intact.
	keepLastMessages = 8
	// keepHeadMessages is the number of leading messages always kept (greeting).
	keepHeadMessages = 2
)

// llmCall makes a single non-streaming request to the configured LLM and returns
// the response content. Used for summarization and the main chat.
func llmCall(cfg *model.ModelConfig, messages []map[string]interface{}) (string, error) {
	requestBody := map[string]interface{}{
		"model":       cfg.ModelName,
		"messages":    messages,
		"temperature": 0.1, // low temperature for summaries
		"max_tokens":  1024,
	}
	bodyBytes, _ := json.Marshal(requestBody)
	httpReq, _ := http.NewRequest("POST", cfg.Endpoint, bytes.NewReader(bodyBytes))
	httpReq.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("summarize API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", fmt.Errorf("parse summary response: %w", err)
	}
	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("empty summary response")
	}
	return chatResp.Choices[0].Message.Content, nil
}

// compressContext checks if total message text exceeds maxContextChars.
// If so, it asks the LLM to summarize the middle portion, keeping head/tail
// messages intact. Returns the compressed message list.
func compressContext(cfg *model.ModelConfig, messages []chatMsg) []chatMsg {
	// Count total characters
	totalChars := 0
	for _, m := range messages {
		totalChars += len([]rune(m.Content))
	}
	if totalChars <= maxContextChars || len(messages) <= keepHeadMessages+keepLastMessages {
		return messages // nothing to compress
	}

	// Split: head (greeting etc) | middle (to summarize) | tail (recent)
	head := messages[:keepHeadMessages]
	tail := messages[len(messages)-keepLastMessages:]
	middle := messages[keepHeadMessages : len(messages)-keepLastMessages]

	// Build summarization prompt
	var sb strings.Builder
	sb.WriteString("请用中文简洁总结以下对话历史中讨论的关键信息，保留所有具体的数据、发现、结论和建议：\n\n")
	for _, m := range middle {
		role := "用户"
		if m.Role == "assistant" {
			role = "助手"
		}
		sb.WriteString(fmt.Sprintf("【%s】%s\n", role, m.Content))
	}

	summaryPrompt := []map[string]interface{}{
		{"role": "system", "content": "你是一个对话摘要助手。用中文输出简洁的摘要。"},
		{"role": "user", "content": sb.String()},
	}

	summary, err := llmCall(cfg, summaryPrompt)
	if err != nil {
		// Fallback: if summarization fails, just truncate middle
		result := make([]chatMsg, 0, len(head)+len(tail)+1)
		result = append(result, head...)
		result = append(result, chatMsg{Role: "system", Content: fmt.Sprintf("[上下文压缩] 已截断 %d 条较早的消息以控制上下文长度。", len(middle))})
		result = append(result, tail...)
		return result
	}

	// Build compressed result
	result := make([]chatMsg, 0, len(head)+len(tail)+1)
	result = append(result, head...)
	result = append(result, chatMsg{
		Role:    "system",
		Content: fmt.Sprintf("[对话历史摘要]\n%s", summary),
	})
	result = append(result, tail...)
	return result
}

func ChatWithAI(c *gin.Context) {
	var req chatReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages is required"})
		return
	}

	cfg, err := repository.GetActiveModelConfig()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no active model config"})
		return
	}

	var systemPrompt string
	if req.TaskID > 0 {
		task, err := repository.GetTaskByID(req.TaskID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
			return
		}
		report, err := repository.GetReportByTaskID(req.TaskID)
		if err == nil && report != nil {
			reportContent := service.FormatReportForAI(report, task.Name, task.OSType)
			systemPrompt = fmt.Sprintf(`你是一名资深的安全应急响应专家。你正在协助用户分析一台机器的系统安全状态。

以下是该机器的系统采集数据：

=== 系统数据 ===
%s

=== 对话规则 ===
- 使用中文回复
- 基于上述系统数据进行分析
- 回答要专业、具体、可操作
`, reportContent)
		} else {
			systemPrompt = fmt.Sprintf(`你是一名资深的安全应急响应专家。当前关联任务"%s"（OS: %s），暂无采集数据。
- 使用中文回复
`, task.Name, task.OSType)
		}
	} else {
		systemPrompt = `你是一名资深的安全应急响应专家。使用中文回复，专业、具体、可操作。`
	}

	// Compress context when it grows too large
	compressed := compressContext(cfg, req.Messages)

	llmMessages := []map[string]interface{}{
		{"role": "system", "content": systemPrompt},
	}
	for _, msg := range compressed {
		llmMessages = append(llmMessages, map[string]interface{}{
			"role": msg.Role, "content": msg.Content,
		})
	}

	requestBody := map[string]interface{}{
		"model":       cfg.ModelName,
		"messages":    llmMessages,
		"temperature": cfg.Temperature,
		"max_tokens":  cfg.MaxTokens,
	}

	bodyBytes, _ := json.Marshal(requestBody)
	httpReq, _ := http.NewRequest("POST", cfg.Endpoint, bytes.NewReader(bodyBytes))
	httpReq.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}

	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "send request: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("API error (%d): %s", resp.StatusCode, string(respBody))})
		return
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "parse response: " + err.Error()})
		return
	}
	if len(chatResp.Choices) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no response from AI"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reply": chatResp.Choices[0].Message.Content})
}
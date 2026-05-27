package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"emergency-response-platform/internal/model"
)

func RunAIAnalysis(report *model.Report, taskName, osType, endpoint, apiKey, modelName string, temperature float64, maxTokens int) (string, string, error) {
	reportContent := FormatReportForAI(report, taskName, osType)

	prompt := fmt.Sprintf(`你是一名资深的安全应急响应专家。请根据以下系统采集数据，生成一份标准的安全应急响应分析报告。

报告需要包含以下内容：
1. 威胁等级评估（critical/high/medium/low/info）
2. 异常发现（列出所有可疑的活动和异常指标）
3. 风险分析（分析潜在的安全风险和攻击面）
4. 处置建议（具体的应急处置步骤）
5. 加固方案（长期安全加固建议）

请使用中文回复，格式清晰。

=== 系统采集数据 ===
%s`, reportContent)

	requestBody := map[string]interface{}{
		"model": modelName,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": "你是一名资深的安全应急响应专家。请根据提供的系统数据生成专业的安全分析报告。使用中文回复。",
			},
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": temperature,
		"max_tokens":  maxTokens,
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return "", "", fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", "", fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", "", fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return "", "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	type chatResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	var chatResp chatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", "", fmt.Errorf("parse response: %w, body: %s", err, string(respBody[:min(len(respBody), 500)]))
	}

	if len(chatResp.Choices) == 0 {
		return "", "", fmt.Errorf("no choices in response")
	}

	analysis := chatResp.Choices[0].Message.Content

	riskLevel := extractRiskLevel(analysis)

	return analysis, riskLevel, nil
}

func extractRiskLevel(analysis string) string {
	// Find the line/context around "威胁等级" and extract risk keyword within ~60 chars.
	// Only match within the SAME line to avoid cross-paragraph false positives.
	idx := strings.Index(analysis, "威胁等级")
	if idx >= 0 {
		// Extract up to 80 chars from "威胁等级" (same-line scope)
		end := idx + 80
		if end > len(analysis) {
			end = len(analysis)
		}
		snippet := analysis[idx:end]
		// Cut at newline to stay on the same line
		if nl := strings.IndexAny(snippet, "\r\n"); nl >= 0 {
			snippet = snippet[:nl]
		}
		snippetLower := strings.ToLower(snippet)

		// Ordered: longer/more-specific patterns first to avoid partial matches
		levelPatterns := []struct {
			level  string
			regex  string
		}{
			{"critical", `(?:严重|critical)`},
			{"high", `(?:高危|high)`},
			{"medium", `(?:中危|medium)`},
			{"low", `(?:低危|low)`},
			{"info", `(?:信息|info)`},
		}
		for _, lp := range levelPatterns {
			if matched, _ := regexp.MatchString(lp.regex, snippetLower); matched {
				return lp.level
			}
		}

		// Fallback: single-char patterns (must NOT be part of longer words)
		// "高" alone but NOT "高危" already checked above
		if matched, _ := regexp.MatchString(`(?:^|[^\x{4e00}-\x{9fff}])高(?:[^\x{4e00}-\x{9fff}]|$)`, snippet); matched {
			return "high"
		}
		if matched, _ := regexp.MatchString(`(?:^|[^\x{4e00}-\x{9fff}])中(?:[^\x{4e00}-\x{9fff}]|$)`, snippet); matched {
			return "medium"
		}
		if matched, _ := regexp.MatchString(`(?:^|[^\x{4e00}-\x{9fff}])低(?:[^\x{4e00}-\x{9fff}]|$)`, snippet); matched {
			return "low"
		}
	}

	return "unknown"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
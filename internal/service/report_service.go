package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"emergency-response-platform/internal/model"
)

// stripBOM removes UTF-8 BOM (\xEF\xBB\xBF) from the beginning of a string.
func stripBOM(s string) string {
	if len(s) >= 3 && s[0] == 0xEF && s[1] == 0xBB && s[2] == 0xBF {
		return s[3:]
	}
	return s
}

func ParseReport(rawContent string) (*model.ParsedReportData, map[string]interface{}, string, error) {
	var data model.ParsedReportData

	rawContent = stripBOM(strings.TrimSpace(rawContent))
	if strings.HasPrefix(rawContent, "{") {
		if err := json.Unmarshal([]byte(rawContent), &data); err != nil {
			return parseTextReport(rawContent)
		}
	} else {
		return parseTextReport(rawContent)
	}

	chartsData := generateChartsData(&data)
	riskLevel := assessRiskLevel(&data)

	return &data, chartsData, riskLevel, nil
}

func parseTextReport(rawContent string) (*model.ParsedReportData, map[string]interface{}, string, error) {
	data := &model.ParsedReportData{
		SystemInfo: model.SystemInfo{
			Hostname:  "Unknown",
			OSName:    "Unknown",
			OSVersion: "Unknown",
		},
	}

	lines := strings.Split(rawContent, "\n")
	currentSection := ""
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		lowerLine := strings.ToLower(line)
		if strings.Contains(lowerLine, "system info") || strings.Contains(line, "系统信息") {
			currentSection = "system"
			continue
		}
		if strings.Contains(lowerLine, "user") || strings.Contains(line, "用户") {
			currentSection = "users"
			continue
		}
		if strings.Contains(lowerLine, "process") || strings.Contains(line, "进程") {
			currentSection = "processes"
			continue
		}
		if strings.Contains(lowerLine, "network") || strings.Contains(line, "网络") {
			currentSection = "network"
			continue
		}

		switch currentSection {
		case "system":
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(strings.ToLower(parts[0]))
				val := strings.TrimSpace(parts[1])
				switch key {
				case "hostname":
					data.SystemInfo.Hostname = val
				case "os_name":
					data.SystemInfo.OSName = val
				case "os_version":
					data.SystemInfo.OSVersion = val
				}
			}
		}
	}

	chartsData := generateChartsData(data)
	riskLevel := assessRiskLevel(data)
	return data, chartsData, riskLevel, nil
}

func generateChartsData(data *model.ParsedReportData) map[string]interface{} {
	charts := make(map[string]interface{})

	procUsers := make(map[string]int)
	for _, p := range data.Processes {
		user := p.User
		if user == "" {
			user = "unknown"
		}
		procUsers[user]++
	}
	procLabels := []string{}
	procValues := []int{}
	for k, v := range procUsers {
		procLabels = append(procLabels, k)
		procValues = append(procValues, v)
	}
	charts["process_by_user"] = map[string]interface{}{
		"labels": procLabels,
		"values": procValues,
	}

	connTypes := make(map[string]int)
	for _, c := range data.NetworkConns {
		state := c.State
		if state == "" {
			state = c.Proto
		}
		connTypes[state]++
	}
	connLabels := []string{}
	connValues := []int{}
	for k, v := range connTypes {
		connLabels = append(connLabels, k)
		connValues = append(connValues, v)
	}
	charts["network_connections"] = map[string]interface{}{
		"labels": connLabels,
		"values": connValues,
	}

	serviceStatus := make(map[string]int)
	for _, s := range data.Services {
		serviceStatus[s.Status]++
	}
	svcLabels := []string{}
	svcValues := []int{}
	for k, v := range serviceStatus {
		svcLabels = append(svcLabels, k)
		svcValues = append(svcValues, v)
	}
	charts["service_status"] = map[string]interface{}{
		"labels": svcLabels,
		"values": svcValues,
	}

	adminCount := 0
	userCount := 0
	for _, u := range data.Users {
		if u.IsAdmin {
			adminCount++
		} else {
			userCount++
		}
	}
	charts["user_privilege"] = map[string]interface{}{
		"labels": []string{"Administrators", "Users"},
		"values": []int{adminCount, userCount},
	}

	overview := map[string]interface{}{
		"total_processes":      len(data.Processes),
		"total_users":          len(data.Users),
		"total_services":       len(data.Services),
		"total_connections":    len(data.NetworkConns),
		"total_startup_items":  len(data.StartupItems),
		"total_scheduled_tasks": len(data.ScheduledTask),
		"hidden_accounts":      len(data.RegHiddenAccounts),
		"task_path_cache":      len(data.RegTaskPaths),
		"security_key_watch":   len(data.RegSecurityKeys),
	}
	charts["overview"] = overview

	return charts
}

func assessRiskLevel(data *model.ParsedReportData) string {
	riskScore := 0

	if len(data.Users) > 10 {
		riskScore += 1
	}
	adminCount := 0
	for _, u := range data.Users {
		if u.IsAdmin {
			adminCount++
		}
	}
	if adminCount > 3 {
		riskScore += 1
	}

	if len(data.Processes) > 200 {
		riskScore += 1
	}

	listeningCount := 0
	for _, c := range data.NetworkConns {
		if c.State == "LISTEN" || c.State == "Listen" {
			listeningCount++
		}
		if c.RemotePort == "22" || c.RemotePort == "3389" || c.RemotePort == "445" {
			riskScore += 1
		}
	}
	if listeningCount > 50 {
		riskScore += 1
	}

	knownBadServices := map[string]bool{
		"telnet": true, "ftp": true, "rsh": true,
	}
	for _, s := range data.Services {
		if s.Status == "running" || s.Status == "Running" {
			lowerName := strings.ToLower(s.Name)
			if knownBadServices[lowerName] {
				riskScore += 2
			}
		}
	}

	for _, item := range data.StartupItems {
		lowerCmd := strings.ToLower(item.Command)
		if strings.Contains(lowerCmd, "temp") || strings.Contains(lowerCmd, "tmp") {
			riskScore += 2
		}
	}

	// Registry-based risk assessment
	for _, a := range data.RegHiddenAccounts {
		if a.Risk == "high" {
			riskScore += 3
		} else if a.Risk == "medium" {
			riskScore += 1
		}
	}

	for _, k := range data.RegSecurityKeys {
		switch k.Risk {
		case "high":
			riskScore += 3
		case "medium":
			riskScore += 1
		}
	}

	switch {
	case riskScore >= 8:
		return "critical"
	case riskScore >= 5:
		return "high"
	case riskScore >= 3:
		return "medium"
	case riskScore >= 1:
		return "low"
	default:
		return "info"
	}
}

func FormatReportForAI(report *model.Report, taskName string, osType string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("=== 应急响应报告 ===\n"))
	sb.WriteString(fmt.Sprintf("任务名称: %s\n", taskName))
	sb.WriteString(fmt.Sprintf("操作系统: %s\n", osType))
	sb.WriteString(fmt.Sprintf("风险等级: %s\n\n", report.RiskLevel))

	var parsedData model.ParsedReportData
	if report.ParsedData != "" {
		if err := json.Unmarshal([]byte(report.ParsedData), &parsedData); err == nil {
			sb.WriteString(formatParsedDataForAI(&parsedData))
		}
	}

	if report.RawContent != "" && report.ParsedData == "" {
		sb.WriteString("\n=== 原始采集数据 ===\n")
		if len(report.RawContent) > 8000 {
			sb.WriteString(report.RawContent[:8000])
			sb.WriteString("\n...(内容已截断)...\n")
		} else {
			sb.WriteString(report.RawContent)
		}
	}

	return sb.String()
}

func formatParsedDataForAI(data *model.ParsedReportData) string {
	var sb strings.Builder

	sb.WriteString("--- 系统信息 ---\n")
	sb.WriteString(fmt.Sprintf("  主机名: %s\n", data.SystemInfo.Hostname))
	sb.WriteString(fmt.Sprintf("  操作系统: %s %s\n", data.SystemInfo.OSName, data.SystemInfo.OSVersion))
	sb.WriteString(fmt.Sprintf("  CPU: %s (%d核)\n", data.SystemInfo.CPUModel, data.SystemInfo.CPUCores))
	sb.WriteString(fmt.Sprintf("  内存: %s\n", data.SystemInfo.TotalMemory))
	sb.WriteString(fmt.Sprintf("  运行时间: %s\n", data.SystemInfo.Uptime))

	sb.WriteString(fmt.Sprintf("\n--- 用户账户 (%d个) ---\n", len(data.Users)))
	for _, u := range data.Users {
		adminTag := ""
		if u.IsAdmin {
			adminTag = " [管理员]"
		}
		sb.WriteString(fmt.Sprintf("  %s (UID:%s)%s - %s\n", u.Username, u.UID, adminTag, u.LastLogin))
	}

	sb.WriteString(fmt.Sprintf("\n--- 进程列表 (%d个) ---\n", len(data.Processes)))
	for i, p := range data.Processes {
		if i >= 50 {
			sb.WriteString(fmt.Sprintf("  ... 还有 %d 个进程\n", len(data.Processes)-50))
			break
		}
		sb.WriteString(fmt.Sprintf("  [%d] %s (用户:%s, CPU:%s, 内存:%s)\n", p.PID, p.Name, p.User, p.CPU, p.Memory))
	}

	sb.WriteString(fmt.Sprintf("\n--- 网络连接 (%d个) ---\n", len(data.NetworkConns)))
	for i, c := range data.NetworkConns {
		if i >= 30 {
			sb.WriteString(fmt.Sprintf("  ... 还有 %d 个连接\n", len(data.NetworkConns)-30))
			break
		}
		sb.WriteString(fmt.Sprintf("  %s %s:%s -> %s:%s [%s] PID:%d\n",
			c.Proto, c.LocalAddr, c.LocalPort, c.RemoteAddr, c.RemotePort, c.State, c.PID))
	}

	sb.WriteString(fmt.Sprintf("\n--- 服务状态 (%d个) ---\n", len(data.Services)))
	for i, s := range data.Services {
		if i >= 20 {
			sb.WriteString(fmt.Sprintf("  ... 还有 %d 个服务\n", len(data.Services)-20))
			break
		}
		sb.WriteString(fmt.Sprintf("  %s: %s\n", s.Name, s.Status))
	}

	sb.WriteString(fmt.Sprintf("\n--- 启动项 (%d个) ---\n", len(data.StartupItems)))
	for _, item := range data.StartupItems {
		sb.WriteString(fmt.Sprintf("  %s: %s (%s)\n", item.Name, item.Command, item.Location))
	}

	if len(data.RegHiddenAccounts) > 0 {
		sb.WriteString(fmt.Sprintf("\n--- 注册表隐藏账户 (%d个) ---\n", len(data.RegHiddenAccounts)))
		for _, a := range data.RegHiddenAccounts {
			sb.WriteString(fmt.Sprintf("  [%s] %s: %s | 风险:%s | %s\n", a.Source, a.Name, a.Value, a.Risk, a.Note))
		}
	}

	if len(data.RegTaskPaths) > 0 {
		sb.WriteString(fmt.Sprintf("\n--- 注册表计划任务路径 (%d条) ---\n", len(data.RegTaskPaths)))
		for _, t := range data.RegTaskPaths {
			sb.WriteString(fmt.Sprintf("  %s: %s -> %s\n", t.GUID[:min(8, len(t.GUID))]+"...", t.Path, t.Actions))
		}
	}

	if len(data.RegSecurityKeys) > 0 {
		sb.WriteString(fmt.Sprintf("\n--- 注册表安全关键项 (%d项) ---\n", len(data.RegSecurityKeys)))
		for _, k := range data.RegSecurityKeys {
			riskTag := ""
			if k.Risk == "high" {
				riskTag = " [!!高危!!]"
			} else if k.Risk == "medium" {
				riskTag = " [!注意!]"
			}
			sb.WriteString(fmt.Sprintf("  [%s] %s\\%s = %s%s\n", k.Category, k.Name, k.Key, k.Value, riskTag))
		}
	}

	return sb.String()
}
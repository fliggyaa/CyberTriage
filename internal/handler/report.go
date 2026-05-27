package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"emergency-response-platform/internal/config"
	"emergency-response-platform/internal/model"
	"emergency-response-platform/internal/repository"
	"emergency-response-platform/internal/service"

	"github.com/gin-gonic/gin"
)

func ListTasks(c *gin.Context) {
	tasks, err := repository.ListTasks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tasks == nil {
		tasks = []model.Task{}
	}
	c.JSON(http.StatusOK, gin.H{"tasks": tasks})
}

func CreateTask(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		OSType      string `json:"os_type"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Name == "" || req.OSType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and os_type are required"})
		return
	}

	task := &model.Task{
		Name:        req.Name,
		OSType:      req.OSType,
		Description: req.Description,
		Status:      "pending",
	}
	id, err := repository.CreateTask(task)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	task.ID = id
	c.JSON(http.StatusCreated, gin.H{"task": task})
}

func GetTask(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	task, err := repository.GetTaskByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"task": task})
}

func DeleteTask(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := repository.DeleteTask(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func UpdateTask(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		Name        string `json:"name"`
		OSType      string `json:"os_type"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := repository.UpdateTask(id, req.Name, req.OSType, req.Description); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func UploadReport(c *gin.Context) {
	taskIDStr := c.PostForm("task_id")
	taskID, _ := strconv.ParseInt(taskIDStr, 10, 64)

	var task *model.Task
	var err error

	if taskID > 0 {
		task, err = repository.GetTaskByID(taskID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
			return
		}
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "read file failed"})
		return
	}

	rawContent := string(content)

	// 未提供 task_id 时自动创建任务
	if taskID == 0 {
		osType := detectOSType(rawContent)
		// Try to extract hostname and user from parsed data for a meaningful name
		hostname := extractHostname(rawContent)
		username := extractCurrentUser(rawContent)
		taskName := buildTaskName(header.Filename, osType, hostname, username)
		task = &model.Task{
			Name:        taskName,
			OSType:      osType,
			Description: fmt.Sprintf("上传文件 %s 自动创建", header.Filename),
			Status:      "processing",
			FilePath:    "",
		}
		taskID, err = repository.CreateTask(task)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "create task failed: " + err.Error()})
			return
		}
		task.ID = taskID
	}

	uploadDir := config.AppConfig.Upload.Dir
	ext := filepath.Ext(header.Filename)
	savePath := filepath.Join(uploadDir, fmt.Sprintf("%d_%d%s", taskID, time.Now().Unix(), ext))

	out, err := os.Create(savePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save file failed"})
		return
	}
	defer out.Close()
	out.Write(content)

	parsedData, chartsData, riskLevel, err := service.ParseReport(rawContent)
	if err != nil {
		parsedData = &model.ParsedReportData{
			SystemInfo: model.SystemInfo{Hostname: "Unknown", OSName: "Unknown"},
		}
		riskLevel = "unknown"
		chartsData = map[string]interface{}{}
	}

	parsedDataJSON, _ := json.Marshal(parsedData)
	chartsDataJSON, _ := json.Marshal(chartsData)

	report := &model.Report{
		TaskID:      taskID,
		RawContent:  rawContent,
		ParsedData:  string(parsedDataJSON),
		ChartsData:  string(chartsDataJSON),
		RiskLevel:   riskLevel,
		AICompleted: false,
	}

	reportID, err := repository.CreateReport(report)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create report failed: " + err.Error()})
		return
	}

	repository.UpdateTaskFilePath(taskID, savePath)
	repository.UpdateTaskStatus(taskID, "completed")

	report.ID = reportID
	c.JSON(http.StatusCreated, gin.H{
		"report": report,
		"task":   task,
	})
}

func ListReports(c *gin.Context) {
	reports, err := repository.ListReports()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if reports == nil {
		reports = []model.Report{}
	}

	type ReportWithTask struct {
		model.Report
		TaskName string `json:"task_name"`
		OSType   string `json:"os_type"`
	}

	var result []ReportWithTask
	for _, r := range reports {
		task, _ := repository.GetTaskByID(r.TaskID)
		taskName := ""
		osType := ""
		if task != nil {
			taskName = task.Name
			osType = task.OSType
		}
		result = append(result, ReportWithTask{
			Report:   r,
			TaskName: taskName,
			OSType:   osType,
		})
	}
	if result == nil {
		result = []ReportWithTask{}
	}
	c.JSON(http.StatusOK, gin.H{"reports": result})
}

func GetReport(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	report, err := repository.GetReportByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}

	task, _ := repository.GetTaskByID(report.TaskID)

	c.JSON(http.StatusOK, gin.H{
		"report": report,
		"task":   task,
	})
}

func DeleteReport(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := repository.DeleteReport(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func detectOSType(content string) string {
	lower := strings.ToLower(content)
	if strings.Contains(lower, "windows") || strings.Contains(lower, "powershell") || strings.Contains(lower, "win32") {
		return "windows"
	}
	if strings.Contains(lower, "macos") || strings.Contains(lower, "mac os") || strings.Contains(lower, "darwin") || strings.Contains(lower, "launchd") {
		return "macos"
	}
	if strings.Contains(lower, "linux") || strings.Contains(lower, "systemctl") || strings.Contains(lower, "/proc/") || strings.Contains(lower, "unix") {
		return "linux"
	}
	return "unknown"
}

func extractHostname(content string) string {
	// Try JSON path: "hostname": "VALUE"
	idx := strings.Index(content, `"hostname"`)
	if idx < 0 {
		return ""
	}
	// Find the value after the colon
	rest := content[idx:]
	colonIdx := strings.Index(rest, ":")
	if colonIdx < 0 {
		return ""
	}
	rest = rest[colonIdx+1:]
	// Find the quoted string value
	q1 := strings.Index(rest, `"`)
	if q1 < 0 {
		return ""
	}
	q2 := strings.Index(rest[q1+1:], `"`)
	if q2 < 0 {
		return ""
	}
	return rest[q1+1 : q1+1+q2]
}

func extractCurrentUser(content string) string {
	// Try JSON path: "current_user": "VALUE"
	idx := strings.Index(content, `"current_user"`)
	if idx < 0 {
		return ""
	}
	rest := content[idx:]
	colonIdx := strings.Index(rest, ":")
	if colonIdx < 0 {
		return ""
	}
	rest = rest[colonIdx+1:]
	q1 := strings.Index(rest, `"`)
	if q1 < 0 {
		return ""
	}
	q2 := strings.Index(rest[q1+1:], `"`)
	if q2 < 0 {
		return ""
	}
	return rest[q1+1 : q1+1+q2]
}

func buildTaskName(filename, osType, hostname, username string) string {
	parts := []string{}
	if osType != "" && osType != "unknown" {
		parts = append(parts, strings.Title(osType))
	}
	if hostname != "" {
		// Take only the computer name part (strip domain prefix)
		hn := hostname
		if idx := strings.LastIndex(hn, "\\"); idx >= 0 {
			hn = hn[idx+1:]
		}
		parts = append(parts, hn)
	}
	if username != "" {
		// Take only the username part (strip domain prefix)
		un := username
		if idx := strings.LastIndex(un, "\\"); idx >= 0 {
			un = un[idx+1:]
		}
		parts = append(parts, un)
	}
	if len(parts) == 0 {
		return strings.TrimSuffix(filename, filepath.Ext(filename))
	}
	return strings.Join(parts, "-")
}
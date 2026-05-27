package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"emergency-response-platform/internal/service"

	"github.com/gin-gonic/gin"
)

type ScriptInfo struct {
	Name        string   `json:"name"`
	OSType      string   `json:"os_type"`
	FileName    string   `json:"file_name"`
	Description string   `json:"description"`
	Categories  []string `json:"categories"`
}

var scriptList = []ScriptInfo{
	{
		Name:        "Windows 应急采集脚本",
		OSType:      "windows",
		FileName:    "collect.ps1",
		Description: "适用于 Windows 7/8/10/11/Server 的 PowerShell 采集脚本",
		Categories:  []string{"系统信息", "用户账户", "进程列表", "网络连接", "服务状态", "启动项", "计划任务", "安全日志", "注册表信息"},
	},
	{
		Name:        "Linux 应急采集脚本",
		OSType:      "linux",
		FileName:    "collect.sh",
		Description: "适用于 Linux (CentOS/Ubuntu/Debian) 的 Bash 采集脚本",
		Categories:  []string{"系统信息", "用户账户", "进程列表", "网络连接", "服务状态", "启动项", "计划任务", "安全日志", "注册表信息"},
	},
	{
		Name:        "macOS 应急采集脚本",
		OSType:      "macos",
		FileName:    "collect.sh",
		Description: "适用于 macOS 的 Bash 采集脚本",
		Categories:  []string{"系统信息", "用户账户", "进程列表", "网络连接", "服务状态", "启动项", "计划任务", "安全日志", "注册表信息"},
	},
}

func ListScripts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"scripts": scriptList,
	})
}

func DownloadScript(c *gin.Context) {
	osType := c.Query("os_type")
	if osType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "os_type is required"})
		return
	}

	var fileName string
	var ext string
	switch osType {
	case "windows":
		fileName = "collect.ps1"
		ext = ".ps1"
	case "linux":
		fileName = "collect.sh"
		ext = ".sh"
	case "macos":
		fileName = "collect.sh"
		ext = ".sh"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported os_type"})
		return
	}

	scriptPath := filepath.Join("scripts", osType, fileName)
	content, err := os.ReadFile(scriptPath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "script template not found"})
		return
	}

	categoriesStr := c.Query("categories")
	categories := []string{}
	if categoriesStr != "" {
		categories = strings.Split(categoriesStr, ",")
	}

	generated, err := service.GenerateScript(string(content), osType, categories)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=emergency_collect_%s%s", osType, ext))
	c.Header("Content-Type", "application/octet-stream")
	c.String(http.StatusOK, generated)
}
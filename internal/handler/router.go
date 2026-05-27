package handler

import (
	"net/http"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	webDir := filepath.Join("web")
	r.Static("/static", filepath.Join(webDir, "static"))

	r.GET("/", func(c *gin.Context) {
		c.File(filepath.Join(webDir, "index.html"))
	})

	api := r.Group("/api")
	{
		scripts := api.Group("/scripts")
		{
			scripts.GET("/list", ListScripts)
			scripts.GET("/download", DownloadScript)
		}

		tasks := api.Group("/tasks")
		{
			tasks.GET("", ListTasks)
			tasks.POST("", CreateTask)
			tasks.GET("/:id", GetTask)
			tasks.PUT("/:id", UpdateTask)
			tasks.DELETE("/:id", DeleteTask)
		}

		reports := api.Group("/reports")
		{
			reports.GET("", ListReports)
			reports.POST("/upload", UploadReport)
			reports.GET("/:id", GetReport)
			reports.DELETE("/:id", DeleteReport)
		}

		ai := api.Group("/ai")
		{
			ai.POST("/analyze", RunAIAnalysis)
			ai.GET("/analysis/:task_id", GetAIAnalysis)
		}

		api.POST("/chat", ChatWithAI)

		convs := api.Group("/conversations")
		{
			convs.GET("", ListConversations)
			convs.POST("", CreateConversation)
			convs.DELETE("/:id", DeleteConversation)
			convs.GET("/:id/messages", GetConversationMessages)
			convs.POST("/:id/messages", SaveMessage)
			convs.PUT("/:id/task", UpdateConversationTask)
			convs.PUT("/:id", UpdateConversationTitle)
		}

		models := api.Group("/models")
		{
			models.GET("", ListModelConfigs)
			models.POST("", CreateModelConfig)
			models.POST("/test-connection", TestModelConnectionRaw)
			models.PUT("/:id", UpdateModelConfig)
			models.DELETE("/:id", DeleteModelConfig)
			models.POST("/:id/activate", SetActiveModel)
			models.POST("/:id/test", TestModelConnection)
		}
	}

	r.NoRoute(func(c *gin.Context) {
		if !filepath.HasPrefix(c.Request.URL.Path, "/api") {
			c.File(filepath.Join(webDir, "index.html"))
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		}
	})

	return r
}
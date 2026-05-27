package main

import (
	"fmt"
	"log"

	"emergency-response-platform/internal/config"
	"emergency-response-platform/internal/handler"
	"emergency-response-platform/internal/middleware"
	"emergency-response-platform/internal/repository"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := repository.InitDB(config.AppConfig.Database.Path); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}
	defer repository.CloseDB()

	if config.AppConfig.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := handler.SetupRouter()
	r.Use(middleware.Logger())
	r.Use(middleware.Recovery())

	addr := fmt.Sprintf(":%s", config.AppConfig.Server.Port)
	log.Printf("Emergency Response Platform starting on http://localhost%s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	Endpoint    string
	APIKey      string
	Model       string
	Temperature float64
	MaxTokens   int
	httpClient  *http.Client
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
}

type ChatResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

func NewClient(endpoint, apiKey, model string, temperature float64, maxTokens int) *Client {
	return &Client{
		Endpoint:    endpoint,
		APIKey:      apiKey,
		Model:       model,
		Temperature: temperature,
		MaxTokens:   maxTokens,
		httpClient:  &http.Client{Timeout: 300 * time.Second},
	}
}

func (c *Client) Chat(messages []Message) (*ChatResponse, error) {
	req := ChatRequest{
		Model:       c.Model,
		Messages:    messages,
		Temperature: c.Temperature,
		MaxTokens:   c.MaxTokens,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.Endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	return &chatResp, nil
}

func (c *Client) TestConnection() error {
	messages := []Message{
		{Role: "user", Content: "Hello, respond with 'OK' only."},
	}
	_, err := c.Chat(messages)
	return err
}
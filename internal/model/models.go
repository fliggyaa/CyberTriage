package model

import "time"

type Task struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	OSType      string    `json:"os_type"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	FilePath    string    `json:"file_path"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Report struct {
	ID             int64     `json:"id"`
	TaskID         int64     `json:"task_id"`
	RawContent     string    `json:"raw_content"`
	ParsedData     string    `json:"parsed_data"`
	ChartsData     string    `json:"charts_data"`
	AIAnalysis     string    `json:"ai_analysis"`
	RiskLevel      string    `json:"risk_level"`
	AICompleted    bool      `json:"ai_completed"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ModelConfig struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Provider     string    `json:"provider"`
	Endpoint     string    `json:"endpoint"`
	APIKey       string    `json:"api_key"`
	ModelName    string    `json:"model_name"`
	Temperature  float64   `json:"temperature"`
	MaxTokens    int       `json:"max_tokens"`
	IsActive     bool      `json:"is_active"`
	Description  string    `json:"description"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ParsedReportData struct {
	SystemInfo    SystemInfo     `json:"system_info"`
	Users         []UserInfo     `json:"users"`
	Processes     []ProcessInfo  `json:"processes"`
	NetworkConns  []NetworkConn  `json:"network_conns"`
	Services      []ServiceInfo  `json:"services"`
	StartupItems  []StartupItem  `json:"startup_items"`
	ScheduledTask []ScheduledTask `json:"scheduled_tasks"`
	SecurityLogs  []SecurityLog  `json:"security_logs"`
	RegHiddenAccounts []RegHiddenAccount `json:"reg_hidden_accounts,omitempty"`
	RegTaskPaths   []RegTaskPath   `json:"reg_task_paths,omitempty"`
	RegSecurityKeys []RegSecurityKey `json:"reg_security_keys,omitempty"`
}

type RegHiddenAccount struct {
	Source string `json:"source"`
	Key    string `json:"key"`
	Name   string `json:"name"`
	Value  string `json:"value"`
	Risk   string `json:"risk"`
	Note   string `json:"note"`
}

type RegTaskPath struct {
	GUID    string `json:"guid"`
	Path    string `json:"path"`
	URI     string `json:"uri"`
	Actions string `json:"actions"`
}

type RegSecurityKey struct {
	Category string `json:"category"`
	Key      string `json:"key"`
	Name     string `json:"name"`
	Value    string `json:"value"`
	Risk     string `json:"risk"`
}

type SystemInfo struct {
	Hostname      string `json:"hostname"`
	OSName        string `json:"os_name"`
	OSVersion     string `json:"os_version"`
	OSArch        string `json:"os_arch"`
	KernelVersion string `json:"kernel_version"`
	Uptime        string `json:"uptime"`
	CurrentUser   string `json:"current_user"`
	CPUModel      string `json:"cpu_model"`
	CPUCores      int    `json:"cpu_cores"`
	TotalMemory   string `json:"total_memory"`
	DiskInfo      []DiskInfo `json:"disk_info"`
}

type DiskInfo struct {
	MountPoint string `json:"mount_point"`
	Total      string `json:"total"`
	Used       string `json:"used"`
	Available  string `json:"available"`
}

type UserInfo struct {
	Username   string `json:"username"`
	UID        string `json:"uid"`
	Group      string `json:"group"`
	HomeDir    string `json:"home_dir"`
	Shell      string `json:"shell"`
	LastLogin  string `json:"last_login"`
	IsAdmin    bool   `json:"is_admin"`
}

type ProcessInfo struct {
	PID        int    `json:"pid"`
	PPID       int    `json:"ppid"`
	Name       string `json:"name"`
	User       string `json:"user"`
	CPU        string `json:"cpu"`
	Memory     string `json:"memory"`
	StartTime  string `json:"start_time"`
	CmdLine    string `json:"cmd_line"`
}

type NetworkConn struct {
	Proto      string `json:"proto"`
	LocalAddr  string `json:"local_addr"`
	LocalPort  string `json:"local_port"`
	RemoteAddr string `json:"remote_addr"`
	RemotePort string `json:"remote_port"`
	State      string `json:"state"`
	PID        int    `json:"pid"`
	ProcName   string `json:"proc_name"`
}

type ServiceInfo struct {
	Name       string `json:"name"`
	Display    string `json:"display"`
	Status     string `json:"status"`
	StartType  string `json:"start_type"`
}

type StartupItem struct {
	Name     string `json:"name"`
	Command  string `json:"command"`
	Location string `json:"location"`
	User     string `json:"user"`
}

type ScheduledTask struct {
	Name     string `json:"name"`
	Command  string `json:"command"`
	Schedule string `json:"schedule"`
	User     string `json:"user"`
}

type SecurityLog struct {
	Time        string `json:"time"`
	EventID     string `json:"event_id"`
	Level       string `json:"level"`
	Source      string `json:"source"`
	Description string `json:"description"`
}

// Conversation and Message for chat feature
type Conversation struct {
	ID        int64     `json:"id"`
	TaskID    int64     `json:"task_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Message struct {
	ID        int64     `json:"id"`
	ConvID    int64     `json:"conv_id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
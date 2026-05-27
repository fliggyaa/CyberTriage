package repository

import (
	"emergency-response-platform/internal/model"
	"time"
)

func CreateReport(report *model.Report) (int64, error) {
	result, err := DB.Exec(
		`INSERT INTO reports (task_id, raw_content, parsed_data, charts_data, 
		 ai_analysis, risk_level, ai_completed, created_at, updated_at) 
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		report.TaskID, report.RawContent, report.ParsedData, report.ChartsData,
		report.AIAnalysis, report.RiskLevel, boolToInt(report.AICompleted),
		time.Now(), time.Now(),
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func GetReportByID(id int64) (*model.Report, error) {
	r := &model.Report{}
	var aiCompleted int
	err := DB.QueryRow(
		`SELECT id, task_id, raw_content, parsed_data, charts_data, 
		 ai_analysis, risk_level, ai_completed, created_at, updated_at 
		 FROM reports WHERE id = ?`, id,
	).Scan(&r.ID, &r.TaskID, &r.RawContent, &r.ParsedData, &r.ChartsData,
		&r.AIAnalysis, &r.RiskLevel, &aiCompleted, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	r.AICompleted = aiCompleted == 1
	return r, nil
}

func GetReportByTaskID(taskID int64) (*model.Report, error) {
	r := &model.Report{}
	var aiCompleted int
	err := DB.QueryRow(
		`SELECT id, task_id, raw_content, parsed_data, charts_data, 
		 ai_analysis, risk_level, ai_completed, created_at, updated_at 
		 FROM reports WHERE task_id = ? ORDER BY created_at DESC LIMIT 1`, taskID,
	).Scan(&r.ID, &r.TaskID, &r.RawContent, &r.ParsedData, &r.ChartsData,
		&r.AIAnalysis, &r.RiskLevel, &aiCompleted, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	r.AICompleted = aiCompleted == 1
	return r, nil
}

func UpdateReportAIAnalysis(id int64, aiAnalysis string, riskLevel string) error {
	_, err := DB.Exec(
		`UPDATE reports SET ai_analysis = ?, risk_level = ?, ai_completed = 1, updated_at = ? WHERE id = ?`,
		aiAnalysis, riskLevel, time.Now(), id,
	)
	return err
}

func ListReports() ([]model.Report, error) {
	rows, err := DB.Query(
		`SELECT id, task_id, raw_content, parsed_data, charts_data, 
		 ai_analysis, risk_level, ai_completed, created_at, updated_at 
		 FROM reports ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []model.Report
	for rows.Next() {
		var r model.Report
		var aiCompleted int
		if err := rows.Scan(&r.ID, &r.TaskID, &r.RawContent, &r.ParsedData,
			&r.ChartsData, &r.AIAnalysis, &r.RiskLevel, &aiCompleted,
			&r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		r.AICompleted = aiCompleted == 1
		reports = append(reports, r)
	}
	return reports, nil
}

func DeleteReport(id int64) error {
	_, err := DB.Exec(`DELETE FROM reports WHERE id = ?`, id)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
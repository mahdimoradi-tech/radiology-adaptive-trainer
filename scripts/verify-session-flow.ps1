$ErrorActionPreference = 'Stop'
$email = "resident_manual_" + (Get-Random) + "@hospital.test"
$regBody = @{ email = $email; password = "StrongPassword123!"; displayName = "Dr. Manual Verification" } | ConvertTo-Json
$regRes = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4000/api/auth/register" -ContentType 'application/json' -Body $regBody -SessionVariable s
Write-Host "Registered resident: $email"

# Create baseline session
$sessRes = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4000/api/sessions" -ContentType 'application/json' -Body '{"size":60}' -WebSession $s
$sid = $sessRes.data.id
Write-Host "Baseline session created with ID: $sid, kind: $($sessRes.data.kind), size: $($sessRes.data.size)"

# Answer 10 questions
1..10 | ForEach-Object {
    Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:4000/api/sessions/$sid/questions/$_/answer" -ContentType 'application/json' -Body '{"answer":"normal"}' -WebSession $s | Out-Null
}
Write-Host "Answered 10 questions with 'normal'"

# Finish session
$finishRes = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4000/api/sessions/$sid/finish" -ContentType 'application/json' -Body '{}' -WebSession $s
$report = $finishRes.data
Write-Host "=== FINISHED SESSION REPORT SUMMARY ==="
Write-Host "Session ID: $($report.sessionId)"
Write-Host "Answered: $($report.answeredCount), Unanswered: $($report.unansweredCount)"
Write-Host "Overall Accuracy: $($report.overall.accuracy) ($($report.overall.correct)/$($report.overall.total))"
Write-Host "Mastered: $($report.mastered)"
Write-Host "Per-Class Accuracy: covid19=$($report.perClass.covid19.accuracy), pneumonia=$($report.perClass.pneumonia.accuracy), normal=$($report.perClass.normal.accuracy)"

# Create next session (adaptive)
$s2Res = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4000/api/sessions" -ContentType 'application/json' -Body '{"size":60}' -WebSession $s
$s2id = $s2Res.data.id
Write-Host "Adaptive session created with ID: $s2id, kind: $($s2Res.data.kind)"

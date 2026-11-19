# Synthesises each narration line to a WAV using the built-in Windows voices (offline).
# Usage: powershell -ExecutionPolicy Bypass -File tts.ps1 <lines.json> <outDir> [voiceName]
param([string]$Json, [string]$OutDir, [string]$Voice = "Microsoft Zira Desktop")
Add-Type -AssemblyName System.Speech
$lines = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
New-Item -ItemType Directory -Force $OutDir | Out-Null
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($l in $lines) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice($Voice)
  $s.SetOutputToWaveFile((Join-Path $OutDir ($l.id + ".wav")), $fmt)
  $text = [System.Security.SecurityElement]::Escape($l.text) -replace '\|', '<break time="350ms"/>'
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><prosody rate='-2%' pitch='-2%'>$text</prosody></speak>"
  $s.SpeakSsml($ssml)
  $s.Dispose()
}
"ok"

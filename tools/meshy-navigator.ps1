param([ValidateSet('submit','status','download')][string]$Action='status', [ValidateSet('model','rig')][string]$Stage='model')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$privateRoot=Join-Path $taskRoot '.integration/meshy/sky-navigator-v01'
$assetRoot=Join-Path $taskRoot 'art/sky-navigator/source'
[IO.Directory]::CreateDirectory($privateRoot)|Out-Null
[IO.Directory]::CreateDirectory($assetRoot)|Out-Null
$apiKey=[Environment]::GetEnvironmentVariable('MESHY_API_KEY','User')
if($env:MESHY_API_KEY){$apiKey=$env:MESHY_API_KEY}
if(!$apiKey){throw 'Meshy credential is not configured.'}
$headers=@{Authorization="Bearer $apiKey"}
$endpoint=if($Stage -eq 'model'){'multi-image-to-3d'}else{'rigging'}
$base="https://api.meshy.ai/openapi/v1/$endpoint"
$recordPath=Join-Path $privateRoot "$Stage-task.json"
function DataUri($file,$mime){return "data:$mime;base64,$([Convert]::ToBase64String([IO.File]::ReadAllBytes($file)))"}
if($Action -eq 'submit'){
 if(Test-Path -LiteralPath $recordPath){throw 'Task already recorded; use status/download to avoid duplicate generation.'}
 if($Stage -eq 'model'){
  $images=@('front','back','right')|ForEach-Object {DataUri (Join-Path $taskRoot "art/sky-navigator/reference/$_-v01.png") 'image/png'}
  $payload=@{image_urls=@($images);ai_model='meshy-7';should_texture=$true;enable_pbr=$true;texture_resolution='2k';should_remesh=$true;topology='quad';target_polycount=16000;save_pre_remeshed_model=$true;pose_mode='a-pose';image_enhancement=$false;remove_lighting=$true;moderation=$true;target_formats=@('glb');multi_view_thumbnails=$true}
 }else{
  $model=Join-Path $assetRoot 'navigator-model-v01.glb'
  if(!(Test-Path -LiteralPath $model)){throw 'Download the model before rigging.'}
  $payload=@{model_url=(DataUri $model 'model/gltf-binary');height_meters=1.5}
 }
 try{$result=Invoke-RestMethod -Method Post -Uri $base -Headers $headers -ContentType 'application/json' -Body ($payload|ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 180}catch{throw "Meshy submission failed: HTTP $([int]$_.Exception.Response.StatusCode). No automatic retry."}
 if(!$result.result){throw 'No task ID returned; inspect provider before retrying.'}
 @{task_id=$result.result;stage=$Stage;created_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath $recordPath -Encoding utf8
 Write-Output "Submitted $Stage task: $($result.result)";exit
}
$task=Get-Content -LiteralPath $recordPath -Raw|ConvertFrom-Json
$status=Invoke-RestMethod -Uri "$base/$($task.task_id)" -Headers $headers -TimeoutSec 60
$status|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $privateRoot "$Stage-status.json") -Encoding utf8
Write-Output "$Stage : $($status.status) $($status.progress)%"
if($status.status -eq 'FAILED'){Write-Output ($status.task_error|ConvertTo-Json -Compress);exit 1}
if($Action -ne 'download'){exit}
if($status.status -ne 'SUCCEEDED'){throw 'Task is not ready for download.'}
function Download($url,$name){if($url){Invoke-WebRequest -Uri $url -OutFile (Join-Path $assetRoot $name) -TimeoutSec 240|Out-Null;Write-Output "Downloaded $name"}}
if($Stage -eq 'model'){
 Download $status.model_urls.glb 'navigator-model-v01.glb'
 Download $status.thumbnail_url 'navigator-preview-v01.png'
}else{
 Download $status.result.rigged_character_glb_url 'navigator-rigged-v01.glb'
 Download $status.result.basic_animations.walking_glb_url 'navigator-walking-v01.glb'
 Download $status.result.basic_animations.running_glb_url 'navigator-running-v01.glb'
}
@{provider='Meshy';stage=$Stage;task_id=$task.task_id;status=$status.status;created_utc=$task.created_utc;downloaded_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $assetRoot "$Stage-provenance.json") -Encoding utf8

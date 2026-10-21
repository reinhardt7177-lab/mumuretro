param([ValidateSet('submit','status','download')][string]$Action='status')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$privateRoot=Join-Path $taskRoot '.integration/meshy/water-deity-v03'
$assetRoot=Join-Path $taskRoot 'art/water-sanctuary/v03/source'
[IO.Directory]::CreateDirectory($privateRoot)|Out-Null
[IO.Directory]::CreateDirectory($assetRoot)|Out-Null
$apiKey=[Environment]::GetEnvironmentVariable('MESHY_API_KEY','User')
if($env:MESHY_API_KEY){$apiKey=$env:MESHY_API_KEY}
if(!$apiKey){throw 'Meshy credential is not configured.'}
$headers=@{Authorization="Bearer $apiKey"}
$base='https://api.meshy.ai/openapi/v1/image-to-3d'
$recordPath=Join-Path $privateRoot 'task.json'
if($Action -eq 'submit'){
 if(Test-Path -LiteralPath $recordPath){throw 'Task already recorded. Query the existing ID; never resubmit.'}
 $image=Join-Path $taskRoot 'art/water-sanctuary/v03/front-input.png'
 $payload=@{image_url="data:image/png;base64,$([Convert]::ToBase64String([IO.File]::ReadAllBytes($image)))";ai_model='meshy-7.1';geometry_resolution='4k';should_texture=$true;enable_pbr=$true;texture_resolution='8k';should_remesh=$true;topology='triangle';target_polycount=100000;save_pre_remeshed_model=$true;image_enhancement=$false;moderation=$true;target_formats=@('glb');multi_view_thumbnails=$true}
 # Persist intent before POST. Uncertain responses require provider reconciliation, not retry.
 @{state='submitting';created_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath $recordPath -Encoding utf8
 try{$result=Invoke-RestMethod -Method Post -Uri $base -Headers $headers -ContentType 'application/json' -Body ($payload|ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 180}catch{throw "Meshy submission failed/uncertain; inspect provider before retrying. HTTP $([int]$_.Exception.Response.StatusCode)"}
 if(!$result.result){throw 'No task ID returned; inspect provider before retrying.'}
 @{task_id=$result.result;state='submitted';created_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath $recordPath -Encoding utf8
 Write-Output "Submitted water deity task: $($result.result)";exit
}
$task=Get-Content -LiteralPath $recordPath -Raw|ConvertFrom-Json
if(!$task.task_id){throw 'Submission unresolved; reconcile provider task list first.'}
$status=Invoke-RestMethod -Uri "$base/$($task.task_id)" -Headers $headers -TimeoutSec 60
$status|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $privateRoot 'status.json') -Encoding utf8
Write-Output "$($task.task_id) : $($status.status) $($status.progress)%"
if($status.status -in @('FAILED','EXPIRED','CANCELED')){Write-Output ($status.task_error|ConvertTo-Json -Compress);exit 1}
if($Action -ne 'download'){exit}
if($status.status -ne 'SUCCEEDED'){throw 'Task is not ready for download.'}
function Download($url,$name){if($url){$destination=Join-Path $assetRoot $name;if(!(Test-Path -LiteralPath $destination)){Invoke-WebRequest -Uri $url -OutFile "$destination.partial" -TimeoutSec 240|Out-Null;Move-Item -LiteralPath "$destination.partial" -Destination $destination};Write-Output "Downloaded $name"}}
Download $status.model_urls.glb 'water-deity-v03.glb'
Download $status.model_urls.pre_remeshed_glb 'water-deity-v03-high.glb'
Download $status.thumbnail_url 'provider-preview.png'
@{provider='Meshy';task_id=$task.task_id;status=$status.status;model='meshy-7.1';geometry='4k';texture='8k';target_triangles=100000;created_utc=$task.created_utc;downloaded_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $assetRoot 'provenance.json') -Encoding utf8

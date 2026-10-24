#!/usr/bin/env python3
"""Cloud Shell bootstrap for a NEW Spark trial project. Never links billing or changes EPCMAIN."""
import json, os, re, secrets, subprocess, sys, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
HERE=Path(__file__).resolve().parent
STATE=HERE/'setup-state.local.json'
FORBIDDEN={'epcmain-76988','epcmenagement','sinka-quant','sinkaquant'}
def cli(*args):
    return subprocess.check_output(['gcloud',*args],text=True).strip()
def call(base,path,body=None,method=None):
    # The access token is used only in an Authorization header to Google's API; never printed or saved.
    token=cli('auth','print-access-token')
    data=None if body is None else json.dumps(body).encode()
    req=Request(base+path,data=data,method=method or ('POST' if body is not None else 'GET'),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    try:
        with urlopen(req,timeout=60) as r:return json.load(r)
    except HTTPError as e:
        try:message=json.loads(e.read()).get('error',{}).get('message','HTTP '+str(e.code))
        except Exception:message='HTTP '+str(e.code)
        raise RuntimeError(message) from None

def wait(base,operation):
    for _ in range(90):
        if operation.get('done'):
            if operation.get('error'):raise RuntimeError(operation['error'].get('message','建立失敗'))
            return operation.get('response',{})
        time.sleep(3)
        operation=call(base,'/'+operation['name'])
    raise RuntimeError('Google 建立作業尚未完成，稍後重新執行同一支程式即可')
def run():
    owner=cli('config','get-value','account')
    if not re.fullmatch(r'[A-Za-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+',owner):raise RuntimeError('請先登入 Google 帳號')
    if STATE.exists():
        state=json.loads(STATE.read_text())
        if state.get('owner')!=owner:raise RuntimeError('請使用第一次建立試行專案的 Google 帳號重試')
    else:
        state={'projectId':'epc-player-'+time.strftime('%y%m%d')+'-'+secrets.token_hex(3),'owner':owner,'created':False}
        STATE.write_text(json.dumps(state));os.chmod(STATE,0o600)
    project=state['projectId']
    if project in FORBIDDEN or not re.fullmatch(r'epc-player-[a-z0-9-]{4,19}',project):raise RuntimeError('拒絕操作既有或非試行專案')
    def save():STATE.write_text(json.dumps(state))
    print('免費試行專案：'+project,flush=True)
    if not state['created']:
        subprocess.run(['gcloud','projects','create',project,'--name=EPC PLAYER FREE','--quiet'],check=True)
        state['created']=True;save()
    billing=cli('billing','projects','describe',project,'--format=value(billingEnabled)')
    if billing.lower()!='false':raise RuntimeError('無法確認未啟用計費，已停止。此程式不會連結帳單。')
    subprocess.run(['gcloud','services','enable','firebase.googleapis.com','firebaserules.googleapis.com','firestore.googleapis.com','identitytoolkit.googleapis.com','--project='+project,'--quiet'],check=True)
    fb='https://firebase.googleapis.com/v1beta1';firestore='https://firestore.googleapis.com/v1';rules='https://firebaserules.googleapis.com/v1'
    if not state.get('firebase'):
        wait(fb,call(fb,'/projects/'+project+':addFirebase',{}));state['firebase']=True;save()
    if not state.get('database'):
        wait(firestore,call(firestore,'/projects/'+project+'/databases?databaseId=%28default%29',{'locationId':'asia-east1','type':'FIRESTORE_NATIVE','deleteProtectionState':'DELETE_PROTECTION_ENABLED'}));state['database']=True;save()
    if not state.get('app'):
        app=wait(fb,call(fb,'/projects/'+project+'/webApps',{'displayName':'EPC Player Free Trial'}));state['app']=app['name'];save()
    source=(HERE/'firestore.rules').read_text().replace('__OWNER_EMAIL__',owner)
    ruleset=call(rules,'/projects/'+project+'/rulesets',{'source':{'files':[{'name':'firestore.rules','content':source}]}})
    if state.get('rules'):
        call(rules,'/projects/'+project+'/releases/cloud.firestore',{'release':{'name':'projects/'+project+'/releases/cloud.firestore','rulesetName':ruleset['name']},'updateMask':'rulesetName'},method='PATCH')
    else:
        call(rules,'/projects/'+project+'/releases',{'name':'projects/'+project+'/releases/cloud.firestore','rulesetName':ruleset['name']});state['rules']=True;save()
    call(firestore,'/projects/'+project+'/databases/(default)/documents/epc_player_meta/trial',{'fields':{'mode':{'stringValue':'free-trial'},'privateHistoryReady':{'booleanValue':False},'sourceProject':{'stringValue':'none'},'publicRefreshSeconds':{'integerValue':'60'}}},method='PATCH')
    config=call(fb,'/'+state['app']+'/config')
    safe={k:config[k] for k in ['apiKey','authDomain','projectId','appId']}
    output=HERE/'firebase-web-config.local.json';output.write_text(json.dumps(safe,ensure_ascii=False,indent=2))
    print('\n已建立獨立試行專案並部署存取規則。沒有更動 EPCMAIN；沒有啟用 Cloud Functions 或連結計費。')
    print('\n下一步：開啟 Firebase Console → Authentication → Get started → Google → 啟用；支援電子郵件選擇你的管理員帳號。')
    print('再於 Authentication → Settings → Authorized domains 加入 sinkayang-bot.github.io。')
    print('https://console.firebase.google.com/project/'+project+'/authentication/providers')
    print('\n貼至免費試行設定頁的公開網頁設定（不含登入權杖或私鑰）：')
    print(json.dumps(safe,ensure_ascii=False,indent=2))
    print('\nhttps://sinkayang-bot.github.io/EPCMAIN/player-free/setup.html')
if __name__=='__main__':
    try:run()
    except (RuntimeError,subprocess.CalledProcessError,KeyError) as e:
        print('\n設定未完成：'+str(e),file=sys.stderr);print('請保留此目錄後重新執行；不要刪除 setup-state.local.json。',file=sys.stderr);sys.exit(1)

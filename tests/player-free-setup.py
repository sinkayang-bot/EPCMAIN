import contextlib, importlib.util, io, json, shutil, tempfile
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('epc_setup','player-free/setup.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as folder:
 root=Path(folder);shutil.copyfile('player-free/firestore.rules',root/'firestore.rules');module.HERE=root;module.STATE=root/'state.local.json';commands=[];requests=[]
 def cli(*args):
  if args[:3]==('config','get-value','account'):return 'owner@example.com'
  if args[0]=='billing':return 'False'
  raise AssertionError(args)
 def run(args,**kwargs):commands.append(args)
 def call(base,path,body=None,method=None):
  requests.append((base,path,body,method));assert base.startswith('https://') and '.googleapis.com/' in base
  if path.endswith(':addFirebase') or '/databases?' in path:return {'done':True,'response':{}}
  if path.endswith('/webApps'):return {'done':True,'response':{'name':'projects/epc-player-test/webApps/TEST'}}
  if path.endswith('/rulesets'):assert 'owner@example.com' in body['source']['files'][0]['content'];return {'name':'projects/test/rulesets/TEST'}
  if '/releases/cloud.firestore' in path:assert body['updateMask']=='rulesetName' and 'release' in body;return {}
  if path.endswith('/config'):
   state=json.loads(module.STATE.read_text());p=state['projectId'];return {'projectId':p,'authDomain':p+'.firebaseapp.com','apiKey':'AIzaSy12345678901234567890123456789','appId':'1:123456:web:abcdef'}
  return {}
 with patch.object(module,'cli',cli),patch.object(module,'call',call),patch.object(module.subprocess,'run',run),contextlib.redirect_stdout(io.StringIO()):module.run();module.run()
 assert sum('create' in c for c in commands)==1
 assert all(not(any(p in ' '.join(c) for p in module.FORBIDDEN)) for c in commands)
 assert not any('link' in c for c in commands)
 assert (root/'firebase-web-config.local.json').exists()
 state=json.loads(module.STATE.read_text());state['projectId']='epcmain-76988';module.STATE.write_text(json.dumps(state))
 with patch.object(module,'cli',cli),contextlib.redirect_stdout(io.StringIO()):
  try:module.run();raise AssertionError('must deny production project')
  except RuntimeError as e:assert '拒絕' in str(e)
print('PASS: mocked Google bootstrap creates only a fresh isolated project, retains state on retry, formats Rules PATCH correctly and refuses EPCMAIN; no billing link commands.')

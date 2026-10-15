import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export async function openPrettySession(entries,{command=process.env.PI_TRACK_VIEW_CODE??'code',tempRoot=tmpdir()}={}) {
  const directory=await mkdtemp(path.join(tempRoot,'pi-track-view-'));
  const file=path.join(directory,'session-formatted.json');
  try {
    await writeFile(file,JSON.stringify(entries,null,2)+'\n',{mode:0o600,flag:'wx'});
    await new Promise((resolve,reject)=>{
      const child=spawn(command,['--reuse-window',file],{stdio:'ignore'});
      child.once('error',reject);
      child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`VS Code CLI exited with ${code??signal}`)));
    });
    return {file,directory};
  } catch(error) {
    await rm(directory,{recursive:true,force:true});
    if(error.code==='ENOENT') throw Object.assign(new Error('VS Code code CLI not found; install the code command in PATH'),{status:503});
    throw Object.assign(error,{status:503});
  }
}

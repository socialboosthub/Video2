// AHM Studio V4 — server-side generation gateway.
// IMPORTANT: keep secrets in Vercel Environment Variables, not in public HTML.
// Set AHM_WORKER_URL and AHM_WORKER_TOKEN when your GPU worker is ready.
//
// Expected worker contract:
// POST AHM_WORKER_URL with { projectId, project, plan }
// -> { status:"queued", jobId }
// GET  AHM_WORKER_URL?jobId=... 
// -> { status:"queued"|"running"|"ready"|"error", progress, message, videoUrl? }

export default async function handler(req,res){
  if(req.method==="GET"){
    const jobId=req.query.jobId;
    if(!jobId) return res.status(400).json({error:"jobId required"});
    if(!process.env.AHM_WORKER_URL) return res.status(503).json({error:"GPU worker is not connected yet."});
    try{
      const r=await fetch(process.env.AHM_WORKER_URL+"?jobId="+encodeURIComponent(jobId),{
        headers: process.env.AHM_WORKER_TOKEN?{"Authorization":"Bearer "+process.env.AHM_WORKER_TOKEN}:{}
      });
      const data=await r.json();
      return res.status(r.status).json(data);
    }catch(e){return res.status(502).json({error:"Could not reach GPU worker."})}
  }
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  if(!process.env.AHM_WORKER_URL){
    return res.status(503).json({error:"GPU worker is not connected. Add AHM_WORKER_URL in Vercel when your GPU worker is ready."});
  }
  const body=req.body||{};
  const projectId="ahm_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);
  try{
    const r=await fetch(process.env.AHM_WORKER_URL,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        ...(process.env.AHM_WORKER_TOKEN?{"Authorization":"Bearer "+process.env.AHM_WORKER_TOKEN}:{})
      },
      body:JSON.stringify({projectId,project:body.project,plan:body.plan})
    });
    const data=await r.json();
    return res.status(r.status).json({...data,projectId:data.projectId||projectId});
  }catch(e){return res.status(502).json({error:"Could not submit job to GPU worker."})}
}
export default function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  // This endpoint intentionally validates/queues a future worker job.
  // The browser has a complete local parser for development mode.
  const body=req.body||{};
  return res.status(200).json({
    ok:true,
    status:"planned",
    message:"AHM Director package accepted. Connect this endpoint to the GPU worker when RunPod is funded.",
    projectId:"ahm_"+Date.now()
  });
}
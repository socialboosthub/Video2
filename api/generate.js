export default function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  return res.status(200).json({
    ok:true,
    status:"queued",
    message:"GPU generation endpoint placeholder. Attach the RunPod/ComfyUI worker here."
  });
}
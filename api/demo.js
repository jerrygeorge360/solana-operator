// Read-only, verifiable example from Solana Devnet. Never creates or sends a transaction.
const RPC="https://api.devnet.solana.com";
async function rpc(method,params,signal){
 const response=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal});
 if(!response.ok)throw new Error("Solana RPC unavailable");
 const data=await response.json();
 if(data.error)throw new Error(data.error.message||"RPC error");
 return data.result;
}
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store, max-age=0");
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
 try{
  const slot=await rpc("getSlot",[{commitment:"finalized"}],controller.signal);
  if(!Number.isSafeInteger(slot)||slot<10)throw new Error("No recent slot");
  let sig=null,chosenSlot=null;
  for(let offset=0;offset<9;offset++){
   try{
    const block=await rpc("getBlock",[slot-offset,{commitment:"finalized",transactionDetails:"signatures",rewards:false,maxSupportedTransactionVersion:0}],controller.signal);
    if(Array.isArray(block?.signatures)&&block.signatures.length){
      sig=block.signatures[0];chosenSlot=slot-offset;break;
    }
   }catch(e){if(controller.signal.aborted)throw e}
  }
  if(!sig){
   const txs=await rpc("getSignaturesForAddress",["Vote111111111111111111111111111111111111111",{limit:1,commitment:"finalized"}],controller.signal);
   if(Array.isArray(txs)&&txs.length){sig=txs[0].signature;chosenSlot=txs[0].slot}
  }
  if(!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig||""))throw new Error("No verifiable transaction was found");
  return res.status(200).json({ok:true,network:"devnet",signature:sig,slot:chosenSlot,explorer:"https://explorer.solana.com/tx/"+sig+"?cluster=devnet",meaning:"Recent finalized Devnet transaction. This is a public network example, not a transfer created by Solana Operator."});
 }catch(e){return res.status(503).json({ok:false,error:"Couldn't load a live Devnet example. Try again shortly."})}finally{clearTimeout(timeout)}
};

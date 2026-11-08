// Conversational, tool-using Solana Devnet assistant. The server never signs transactions.
const RPC="https://api.devnet.solana.com",GATEWAY="https://ai-gateway.vercel.sh/v1/chat/completions";
const PUBLIC_KEY=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const safe=(x,n=600)=>String(x??"").slice(0,n);
const isWallet=x=>typeof x==="string"&&PUBLIC_KEY.test(x);
const numeric=x=>typeof x==="number"&&Number.isFinite(x)?x:null;
const tools=[
 {type:"function",function:{name:"inspect_wallet",description:"Look up the actual SOL balance of the currently connected wallet on Solana Devnet. Call for balance inquiries. Never invent RPC data.",parameters:{type:"object",properties:{reason:{type:"string"}},required:["reason"]}}},
 {type:"function",function:{name:"propose_transfer",description:"Prepare a transfer proposal only. Call ONLY after user has provided a positive SOL amount and a full recipient wallet address in this conversation. Don't guess or invent details. Browser validates balance, fees and reserves then requires user wallet signature. This tool does not send.",parameters:{type:"object",properties:{amountSol:{type:"number"},recipient:{type:"string"},minimumBalanceSol:{type:"number"},explanation:{type:"string"}},required:["amountSol","recipient","minimumBalanceSol","explanation"]}}}
];
async function rpcBalance(wallet){
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),6000);
 try{
  const r=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getBalance",params:[wallet,{commitment:"confirmed"}]}),signal:ctrl.signal});
  if(!r.ok)throw Error("Devnet RPC failed");
  const data=await r.json();
  if(data.error||!Number.isSafeInteger(data?.result?.value))throw Error("Balance unavailable");
  return data.result.value/1e9;
 }finally{clearTimeout(timer)}
}
async function callModel(messages,auth){
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),19000);
 try{
  const payload={model:auth.model,messages,tools,tool_choice:"auto",temperature:0.2,max_tokens:750};
  if(auth.deepseek)payload.thinking={type:"disabled"};
  const r=await fetch(auth.endpoint,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+auth.token},body:JSON.stringify(payload),signal:ctrl.signal});
  if(!r.ok)throw Error("Model HTTP "+r.status);
  const data=await r.json();
  const msg=data?.choices?.[0]?.message;
  if(!msg)throw Error("No model response");
  return msg;
 }finally{clearTimeout(timer)}
}
const system=[
 "You are Solana Operator, a helpful conversational assistant for SOL on Solana Devnet.",
 "Communicate naturally, briefly and intelligently. Understand slang, grammar errors, plurals, amounts written as words, and follow-up messages. Remember the preceding conversation.",
 "Ask one concise, relevant question when information is missing. Do not insist on command syntax. Example: if the user says 'send 2 sols' without a recipient, ask for the recipient address. When a later message contains just an address, use the amount from the preceding conversation.",
 "You can only inspect a wallet or PROPOSE a transfer. Never sign, submit, claim a transfer happened, invent balances or ask for seed phrases.",
 "To transfer, collect a positive SOL amount and full Solana recipient address. Minimum balance to keep is optional and defaults to zero. Preserve any prior minimum constraint across turns, never silently lower it.",
 "If any information is missing, ask for it; DO NOT call propose_transfer yet. The recipient MUST be provided by the user somewhere in the conversation, not invented. Once complete, call propose_transfer.",
 "When reporting a connected wallet balance, call inspect_wallet. If the wallet is unconnected, ask the user to connect. You can also explain this app, Devnet, and fees.",
 "Plain English only. No marketing, fake assurances, long introductions or Markdown. When not calling tools, return a natural short assistant message, not a JSON response."
].join(" ");
function userHistory(raw){
 if(!Array.isArray(raw))return [];
 return raw.slice(-12).filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string")
 .map(m=>({role:m.role,content:m.content.slice(0,700)}));
}
const okay=(res,p)=>res.status(200).json({mode:"ai",...p});
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 const deepseek=process.env.DEEPSEEK_API_KEY;
 const gateway=process.env.AI_GATEWAY_API_KEY||req.headers?.["x-vercel-oidc-token"]||process.env.VERCEL_OIDC_TOKEN;
 const openai=process.env.OPENAI_API_KEY;
 const auth=deepseek?{token:deepseek,endpoint:"https://api.deepseek.com/chat/completions",model:process.env.DEEPSEEK_MODEL||"deepseek-flash",deepseek:true}
 :gateway?{token:gateway,endpoint:GATEWAY,model:process.env.AI_GATEWAY_MODEL||"deepseek/deepseek-v3.2"}
 :openai?{token:openai,endpoint:"https://api.openai.com/v1/chat/completions",model:process.env.OPENAI_MODEL||"gpt-4.1-mini"}:null;
 if(req.method==="GET")return okay(res,{ok:true,aiConfigured:!!auth,model:auth?.model||"none",conversation:true});
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 if(!auth)return res.status(503).json({error:"AI service not configured"});
 const instruction=typeof req.body?.instruction==="string"?req.body.instruction.trim().slice(0,1200):"";
 if(!instruction)return res.status(400).json({error:"Enter a message"});
 const wallet=isWallet(req.body?.wallet)?req.body.wallet:null;
 const history=userHistory(req.body?.history);
 const userWords=[...history.filter(m=>m.role==="user").map(m=>m.content),instruction].join("\n");
 const steps=[];
 const messages=[{role:"system",content:system},{role:"system",content:"Connected public wallet: "+(wallet||"none")+". Do not request secret keys."},...history,{role:"user",content:instruction}];
 try{
  for(let i=0;i<4;i++){
   const msg=await callModel(messages,auth);
   if(!msg.tool_calls?.length){
    let content=safe(msg.content,800).trim();
    if(content.startsWith("{"))try{const j=JSON.parse(content);content=safe(j.message||j.explanation||content,800)}catch(_){}
    if(!content)content="Could you tell me a little more about what you want to do?";
    return okay(res,{intent:"reply",message:content,steps});
   }
   messages.push(msg);
   let proposal=null,observedBalance=null;
   for(const call of msg.tool_calls){
    let args={};try{args=JSON.parse(call.function.arguments||"{}")}catch(_){}
    let value;
    if(call.function.name==="inspect_wallet"){
     if(!wallet){value={error:"No wallet connected. Ask the user to connect a wallet."};steps.push("Wallet balance requested, but no wallet is connected.");}
     else try{
      const balanceSol=await rpcBalance(wallet);observedBalance=balanceSol;
      value={network:"devnet",wallet,balanceSol};steps.push("Solana RPC: balance "+balanceSol.toFixed(6)+" SOL");
     }catch(e){value={error:"Devnet RPC unavailable"};steps.push("Solana RPC: balance lookup failed");}
    }else if(call.function.name==="propose_transfer"){
     const amt=numeric(args.amountSol),min=numeric(args.minimumBalanceSol)??0,recipient=typeof args.recipient==="string"?args.recipient.trim():"";
     if(amt===null||amt<=0||min<0||!isWallet(recipient)||!userWords.includes(recipient)){
      value={error:"Transfer not ready. Ask for any missing amount or full user-provided recipient address."};
      steps.push("Proposal rejected: missing or unverified transfer details.");
     }else{
      proposal={amountSol:amt,recipient,minimumBalanceSol:min,explanation:safe(args.explanation,260)};
      value={proposalOnly:true,message:"User must review amount, recipient, fees and reserve, then sign in wallet."};
      steps.push("Agent tool: prepared "+amt+" SOL proposal; no transfer sent.");
     }
    }else value={error:"Unknown tool"};
    messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(value)});
   }
   if(proposal)return okay(res,{intent:"transfer",message:"I have the transfer details. Review the amount, recipient and balance before opening your wallet.",...proposal,steps});
   if(observedBalance!==null)return okay(res,{intent:"balance",message:"Your Devnet wallet has "+observedBalance.toFixed(6)+" SOL.",balanceSol:observedBalance,steps});
  }
  return okay(res,{intent:"reply",message:"Could you clarify what you'd like me to do?",steps});
 }catch(e){
  console.error("DeepSeek conversation error:",safe(e.message,100));
  return res.status(503).json({error:"DeepSeek is unavailable. Nothing was sent."});
 }
};
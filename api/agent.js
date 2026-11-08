// Solana Operator: server-side AI planning. No wallet secrets are handled here.
const RPC = "https://api.devnet.solana.com";
const AI_GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MAX_STEPS = 4;
const isPublicKey = value => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const num = (value, fallback=null) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const safe = (value, max=220) => String(value||"").slice(0,max);
const tools = [
  {type:"function",function:{name:"inspect_wallet",description:"Fetch the wallet's current, actual SOL balance from Solana Devnet. Do not invent a balance. Call when an address is provided and user asks about balances or transfer affordability.",parameters:{type:"object",properties:{reason:{type:"string",description:"Reason to fetch the real balance."}},required:["reason"]}}},
  {type:"function",function:{name:"propose_transfer",description:"Propose (but do NOT execute) a Devnet SOL transfer. The frontend independently fetches balances, calculates network fees, blocks violations and requires a wallet signature. Recipient must be supplied by the user.",parameters:{type:"object",properties:{amountSol:{type:"number"},recipient:{type:"string"},minimumBalanceSol:{type:"number"},explanation:{type:"string"}},required:["amountSol","recipient","minimumBalanceSol","explanation"]}}}
];
async function rpcBalance(publicKey){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),4500);
  try{
    const r=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getBalance",params:[publicKey,{commitment:"confirmed"}]}),signal:controller.signal});
    if(!r.ok)throw Error("RPC unavailable");
    const data=await r.json();
    if(data.error||!Number.isFinite(data?.result?.value))throw Error("Invalid RPC balance");
    return data.result.value/1e9;
  } finally {clearTimeout(timer)}
}
function clean(plan){
  if(!plan||typeof plan!=="object")throw Error("Invalid agent plan");
  const intent=["balance","transfer","unknown"].includes(plan.intent)?plan.intent:"unknown";
  const amount=num(plan.amountSol);
  const minimum=num(plan.minimumBalanceSol,0);
  return {mode:"ai",intent,amountSol:amount,recipient:typeof plan.recipient==="string"?plan.recipient:null,minimumBalanceSol:minimum,explanation:safe(plan.explanation,500)};
}
function proposed(args){
  return clean({intent:"transfer",amountSol:num(args.amountSol),recipient:args.recipient,minimumBalanceSol:num(args.minimumBalanceSol,0),explanation:args.explanation});
}
async function chat(messages,auth){
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),14000);
  try{
    const response=await fetch(auth.deepseek?"https://api.deepseek.com/chat/completions":(auth.gateway?AI_GATEWAY:"https://api.openai.com/v1/chat/completions"),{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+auth.token},body:JSON.stringify({model:auth.deepseek?(process.env.DEEPSEEK_MODEL||"deepseek-flash"):(auth.gateway?(process.env.AI_GATEWAY_MODEL||"deepseek/deepseek-v3.2"):(process.env.OPENAI_MODEL||"gpt-4.1-mini")),temperature:0,max_tokens:700,thinking:auth.deepseek?{type:"disabled"}:undefined,messages,tools,tool_choice:"auto"}),signal:abort.signal});
    if(!response.ok){const msg=await response.text();throw Error("AI Gateway request failed ("+response.status+"): "+msg.slice(0,150))}
    const body=await response.json();
    if(!body?.choices?.[0]?.message)throw Error("No AI response");
    return body.choices[0].message;
  }finally{clearTimeout(timer)}
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const deepseekToken=process.env.DEEPSEEK_API_KEY;
  const gatewayToken=process.env.AI_GATEWAY_API_KEY||req.headers?.["x-vercel-oidc-token"]||process.env.VERCEL_OIDC_TOKEN;
  const openaiToken=process.env.OPENAI_API_KEY;
  const auth=deepseekToken?{token:deepseekToken,deepseek:true,gateway:false}:gatewayToken?{token:gatewayToken,gateway:true,deepseek:false}:openaiToken?{token:openaiToken,gateway:false,deepseek:false}:null;
  if(req.method==="GET")return res.status(200).json({ok:true,aiConfigured:!!auth,model:auth?.deepseek?(process.env.DEEPSEEK_MODEL||"deepseek-flash"):(auth?.gateway?(process.env.AI_GATEWAY_MODEL||"not configured"):(auth?"direct provider":"none"))});
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  if(!auth)return res.status(503).json({error:"No AI provider is configured"});
  const instruction=typeof req.body?.instruction==="string"?req.body.instruction.slice(0,1200).trim():"";
  const wallet=req.body?.wallet;
  if(!instruction)return res.status(400).json({error:"Instruction required"});
  const steps=[];
  const messages=[
    {role:"system",content:"You are Solana Operator, a careful Devnet-only blockchain assistant. You can inspect a wallet balance using a tool and propose a transfer using a tool; you NEVER sign, submit, or claim completion. If the user requests to view balance, inspect_wallet if a user wallet is provided and then return a short JSON plan. If user requests a transfer, inspect_wallet first when available, then call propose_transfer. Never invent a recipient address, amount, or balance. Ask for missing data by returning JSON intent unknown. Return JSON objects only when not calling a tool: {\"intent\":\"balance|transfer|unknown\",\"amountSol\":null,\"recipient\":null,\"minimumBalanceSol\":0,\"explanation\":\"...\"}. All transfers must be independently verified on the client and approved by the wallet owner. Never ask for private keys."},
    {role:"user",content:"Connected public wallet: "+(isPublicKey(wallet)?wallet:"not connected")+". User instruction: "+instruction}
  ];
  try{
    for(let iteration=0;iteration<MAX_STEPS;iteration++){
      const reply=await chat(messages,auth);
      if(reply.tool_calls?.length){
        messages.push(reply);
        let transferProposal=null;
        for(const call of reply.tool_calls){
          let args={};try{args=JSON.parse(call.function.arguments||"{}")}catch(_){}
          let result={};
          if(call.function.name==="inspect_wallet"){
            if(!isPublicKey(wallet)){result={error:"Wallet not connected"};steps.push("Attempted wallet inspection: connect your wallet to continue.");}
            else{try{const balanceSol=await rpcBalance(wallet);result={network:"solana-devnet",publicKey:wallet,balanceSol};steps.push("Tool inspect_wallet: "+balanceSol.toFixed(6)+" SOL observed on Devnet.");}catch(e){result={error:"Devnet RPC temporarily unavailable"};steps.push("Tool inspect_wallet: RPC failed.");}}
          }else if(call.function.name==="propose_transfer"){
            transferProposal=proposed(args);
            result={status:"proposal_created_only",message:"No transaction has been sent. Deterministic policy validation and human signature required."};
            steps.push("Tool propose_transfer: prepared "+(transferProposal.amountSol??"unknown")+" SOL request; signing NOT performed.");
          }else result={error:"Unknown tool"};
          messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result)});
        }
        if(transferProposal)return res.status(200).json({...transferProposal,steps});
        continue;
      }
      const content=reply.content||"";
      let parsed=null;try{parsed=JSON.parse(content)}catch(_){const part=content.match(/\{[\s\S]*\}/);if(part)try{parsed=JSON.parse(part[0])}catch(_){}}
      const result=clean(parsed||{intent:"unknown",explanation:safe(content,300)});
      steps.push("Agent completed planning without executing a transaction.");
      return res.status(200).json({...result,steps});
    }
    return res.status(200).json({...clean({intent:"unknown",explanation:"Planning step limit reached. Please simplify the instruction."}),steps});
  }catch(e){console.error("Agent planning unavailable:",safe(e.message,90));return res.status(503).json({error:"AI provider unavailable; use local rule-based mode"})}
};

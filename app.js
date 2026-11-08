(() => {
"use strict";
const RPC="https://api.devnet.solana.com", STORAGE="operator:devnet-confirmed:v1";
const $=id=>document.getElementById(id);
const D={
 form:$("instructionForm"),input:$("command"),run:$("analyzeBtn"),runLabel:$("analyzeText"),message:$("message"),
 connect:$("connectBtn"),connectLabel:$("connectLabel"),contextConnect:$("contextConnectBtn"),
 refresh:$("refreshBtn"),balance:$("walletBalance"),address:$("walletAddress"),model:$("modelLabel"),
 response:$("responsePanel"),userRequest:$("userRequest"),explanation:$("agentExplanation"),
 source:$("agentSource"),observed:$("observedBalance"),readout:$("balanceReadout"),trace:$("traceList"),
 review:$("reviewPanel"),badge:$("policyBadge"),policy:$("policyMessage"),approve:$("approveBtn"),
 amount:$("transferAmount"),recipient:$("recipientAddress"),current:$("figureBalance"),
 fee:$("figureFee"),minimum:$("figureMinimum"),remaining:$("figureRemaining"),
 receipt:$("receiptPanel"),signature:$("receiptSignature"),receiptLink:$("receiptLink"),
 history:$("activityList"),historyCount:$("activityCount")
};
let provider=null,publicKey=null,balanceLamports=null,pending=null,busy=false;
const SDK=()=>{if(!window.solanaWeb3)throw Error("Solana library failed to load. Reload the page.");return window.solanaWeb3};
const conn=()=>new (SDK().Connection)(RPC,"confirmed");
const fmt=(n,d=4)=>Number.isFinite(n)?new Intl.NumberFormat("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):"—";
const short=s=>s?s.slice(0,5)+"…"+s.slice(-5):"—";
const stageNames=["Describe","Review","Approve","Verify"];
function status(message,tone=""){D.message.textContent=message;D.message.className="inline-message"+(tone?" "+tone:"")}
function stage(active,completed=[]){stageNames.forEach((name,i)=>{const node=$("stage"+name),n=i+1;node.classList.toggle("active",active===n);node.classList.toggle("complete",completed.includes(n))})}
function trace(text){const li=document.createElement("li");li.textContent=String(text).slice(0,500);D.trace.appendChild(li)}
function setBusy(value){busy=value;D.run.disabled=value;D.runLabel.textContent=value?"Working on it…":"Run instruction"}
function resetReview(){
 pending=null;D.approve.disabled=true;D.approve.textContent="Approve in wallet";
 D.response.hidden=true;D.review.hidden=true;D.receipt.hidden=true;D.readout.hidden=true;
 D.trace.replaceChildren();$("traceDetails").open=false;stage(1);
}
function showPolicy(ok,message){
 D.badge.textContent=ok?"Within policy":"Action blocked";D.badge.className="review-state "+(ok?"passed":"blocked");
 D.policy.textContent=message;D.policy.className="policy-message "+(ok?"passed":"blocked");D.approve.disabled=!ok;
}
function showWallet(amount){
 balanceLamports=amount;
 D.balance.replaceChildren(document.createTextNode(fmt(amount/SDK().LAMPORTS_PER_SOL,4)+" "));
 const suffix=document.createElement("span");suffix.textContent="SOL";D.balance.appendChild(suffix);
 if(publicKey) D.address.textContent=publicKey.toBase58();
}
async function refreshBalance(quiet=false){
 if(!publicKey)throw Error("Connect your wallet first.");
 const value=await conn().getBalance(publicKey);showWallet(value);
 if(!quiet)status("Live balance updated from Solana Devnet.","success");
 return value;
}
async function connectWallet(silent=false){
 try{
  provider=window.phantom?.solana||window.solana||null;
  if(!provider)throw Error("Install a Solana wallet such as Phantom, then reload the page.");
  const answer=await provider.connect();
  publicKey=new (SDK().PublicKey)(answer.publicKey.toString());
  D.connectLabel.textContent=short(publicKey.toBase58());
  D.address.textContent=publicKey.toBase58();
  D.contextConnect.hidden=true;D.refresh.hidden=false;
  await refreshBalance(true);
  if(!silent)status("Wallet connected. Reading Solana Devnet.","success");
  return true;
 }catch(error){status(error.message||"Unable to connect a wallet.","error");return false}
}
function parseFallback(text){
 const amount=text.match(/(?:send|transfer|pay)\s+(\d+(?:\.\d+)?)\s*sol\b/i);
 const recipient=text.match(/\bto\s+([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
 const reserve=text.match(/(?:keep|retain|leave|minimum|at least)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*sol\b/i);
 return {
  mode:"fallback",intent:amount?"transfer":"balance",amountSol:amount?Number(amount[1]):null,
  recipient:recipient?recipient[1]:null,minimumBalanceSol:reserve?Number(reserve[1]):0,
  explanation:amount?"I recognized a transfer request, but the AI provider did not respond. This is a rule-based proposal, not an AI action. Review the details before proceeding.":"I can inspect your live Devnet wallet balance. The AI service was unavailable, so a local parser handled the request.",
  steps:["DeepSeek did not return an agent result. Local parsing was used; no transaction was sent."]
 };
}
async function agent(text){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instruction:text,wallet:publicKey?.toBase58()||null}),signal:controller.signal});
  if(!response.ok)throw Error("AI service unavailable");
  const result=await response.json();
  if(!result||!["balance","transfer","unknown"].includes(result.intent))throw Error("Agent response was invalid");
  result.mode="ai";return result;
 }catch(error){return parseFallback(text)}finally{clearTimeout(timer)}
}
function renderAgent(result,instruction){
 D.response.hidden=false;D.userRequest.textContent=instruction;
 D.explanation.textContent=String(result.explanation||"This is the proposed next step.");
 const AI=result.mode==="ai";D.source.textContent=AI?"DeepSeek · tool planner":"Rule-based fallback";
 D.model.textContent=AI?"DeepSeek · active":"Rule-based fallback";
 (Array.isArray(result.steps)?result.steps:[]).forEach(trace);
 trace("Network restricted to Solana Devnet.");
 D.response.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function requestedAmount(text){const r=text.match(/(?:send|transfer|pay)\s+(\d+(?:\.\d+)?)\s*sol\b/i);return r?Number(r[1]):null}
function requestedMinimum(text){const r=text.match(/(?:keep|retain|leave|minimum|at least)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*sol\b/i);return r?Number(r[1]):null}
async function makeTransfer(result,text){
 const sol=SDK(),amount=Number(result.amountSol),aiMinimum=Number(result.minimumBalanceSol??0);
 const actualAmount=requestedAmount(text);
 if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(aiMinimum)||aiMinimum<0)throw Error("Transfer details are invalid.");
 if(actualAmount===null||Math.abs(amount-actualAmount)>1e-9)throw Error("The AI amount does not match your instruction. Specify an amount like 'send 0.05 SOL'.");
 if(typeof result.recipient!=="string"||!text.includes(result.recipient))throw Error("Recipient address missing or different from your instruction. Include a real Devnet wallet address.");
 const recipient=new (sol.PublicKey)(result.recipient);
 const lamports=Math.round(amount*sol.LAMPORTS_PER_SOL);
 const minSol=Math.max(aiMinimum,requestedMinimum(text)??0);
 const minLamports=Math.ceil(minSol*sol.LAMPORTS_PER_SOL);
 if(!Number.isSafeInteger(lamports)||lamports<1||!Number.isSafeInteger(minLamports))throw Error("Amount cannot be safely represented.");
 const rpc=conn(),balance=await refreshBalance(true);
 const block=await rpc.getLatestBlockhash("confirmed");
 const tx=new sol.Transaction({feePayer:publicKey,recentBlockhash:block.blockhash}).add(sol.SystemProgram.transfer({fromPubkey:publicKey,toPubkey:recipient,lamports}));
 const feeResult=await rpc.getFeeForMessage(tx.compileMessage(),"confirmed");
 if(!feeResult||feeResult.value===null)throw Error("Network fee estimate is unavailable. Transfer refused.");
 const fee=feeResult.value,remaining=balance-lamports-fee;
 D.review.hidden=false;
 D.amount.textContent=String(amount);D.recipient.textContent=recipient.toBase58();
 D.current.textContent=fmt(balance/sol.LAMPORTS_PER_SOL,6)+" SOL";
 D.fee.textContent=fmt(fee/sol.LAMPORTS_PER_SOL,6)+" SOL";
 D.minimum.textContent=fmt(minSol,6)+" SOL";
 D.remaining.textContent=fmt(remaining/sol.LAMPORTS_PER_SOL,6)+" SOL";
 trace("Read current wallet balance and network fee from Solana Devnet RPC.");
 trace("Verified recipient and amount against the user's original instruction.");
 trace("Enforced the stronger of the user-specified and agent-proposed minimum balance.");
 if(remaining<minLamports||remaining<0){
  pending=null;showPolicy(false,"This action would violate your remaining-balance rule after network fees. No wallet signature is possible.");
  trace("Policy blocked the transfer.");stage(2,[1]);status("This transfer is blocked by your minimum-balance rule.","error");
 }else{
  pending={tx,lamports,reserve:minLamports,amount};
  showPolicy(true,"The transfer meets your spending limit. Only your wallet can approve and sign it.");
  trace("Policy passed; the agent cannot sign for the user.");
  stage(3,[1,2]);status("Review the transaction and approve it in your wallet.","success");
 }
 D.review.scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function analyze(event){
 if(event)event.preventDefault();
 if(busy)return;const text=D.input.value.trim();
 if(!text){status("Write an instruction first.","error");D.input.focus();return}
 resetReview();setBusy(true);status("Understanding your instruction…");
 try{
  if(!publicKey){const connected=await connectWallet(true);if(!connected)throw Error("Connect a Devnet wallet to access live blockchain state.")}
  const result=await agent(text);renderAgent(result,text);
  if(result.intent==="balance"){
   const balance=await refreshBalance(true);
   D.readout.hidden=false;D.observed.textContent=fmt(balance/SDK().LAMPORTS_PER_SOL,6);
   trace("Read-only result: no signing or blockchain transaction required.");
   stage(2,[1]);status("Balance read successfully from Devnet.","success");
  }else if(result.intent==="transfer"){
   await makeTransfer(result,text);
  }else{
   stage(2,[1]);trace("No valid transaction proposal was produced.");
   status("Ask to check your wallet balance or to send a specific amount of SOL.","error");
  }
 }catch(error){
  status(error.message||"Unable to finish the task.","error");trace("Stopped: "+(error.message||"Unknown error"));
  pending=null;D.approve.disabled=true;
  if(!D.review.hidden)showPolicy(false,error.message||"Validation failed.");
 }finally{setBusy(false)}
}
function getHistory(){
 try{const data=JSON.parse(localStorage.getItem(STORAGE)||"[]");return Array.isArray(data)?data.filter(x=>x&&typeof x.signature==="string"&&/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(x.signature)).slice(0,5):[]}
 catch(error){return []}
}
function renderHistory(){
 const items=getHistory();D.historyCount.textContent=String(items.length);D.history.replaceChildren();
 if(!items.length){const p=document.createElement("p");p.className="no-activity";p.textContent="Confirmed Devnet transfers will appear here, in this browser.";D.history.appendChild(p);return}
 items.forEach(item=>{
  const row=document.createElement("div");row.className="activity-item";
  const amount=document.createElement("strong");amount.textContent=fmt(Number(item.amount),4)+" SOL sent";
  const link=document.createElement("a");link.href="https://explorer.solana.com/tx/"+item.signature+"?cluster=devnet";link.target="_blank";link.rel="noopener noreferrer";link.textContent="Verified receipt ↗";
  const time=document.createElement("time");time.dateTime=item.date;time.textContent=new Date(item.date).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  row.append(amount,link,time);D.history.appendChild(row);
 });
}
function saveHistory(signature,amount){
 try{const rows=[{signature,amount,date:new Date().toISOString()},...getHistory().filter(x=>x.signature!==signature)].slice(0,5);localStorage.setItem(STORAGE,JSON.stringify(rows))}
 catch(error){}
 renderHistory();
}
async function approve(){
 if(busy||!pending||!provider||!publicKey)return;
 const draft=pending;pending=null;D.approve.disabled=true;D.approve.textContent="Waiting for wallet…";
 status("Rechecking wallet balance and transaction fees…");
 try{
  if(provider.publicKey?.toString()!==publicKey.toBase58())throw Error("Connected wallet changed. Re-run the instruction.");
  const rpc=conn(),current=await rpc.getBalance(publicKey),block=await rpc.getLatestBlockhash("confirmed");
  draft.tx.recentBlockhash=block.blockhash;
  const fee=await rpc.getFeeForMessage(draft.tx.compileMessage(),"confirmed");
  if(!fee||fee.value===null||current-draft.lamports-fee.value<draft.reserve)throw Error("The balance or fee changed and the policy no longer allows this transfer.");
  if(typeof provider.signTransaction!=="function")throw Error("Your wallet cannot sign a Solana transaction.");
  trace("Final balance and fee check passed.");
  status("Approve the Devnet transaction in your wallet.");
  const signed=await provider.signTransaction(draft.tx);
  const signature=await rpc.sendRawTransaction(signed.serialize());
  trace("Signed transaction submitted: "+signature);
  stage(4,[1,2,3]);status("Waiting for the Solana network to confirm…");
  const confirmation=await rpc.confirmTransaction({signature,blockhash:block.blockhash,lastValidBlockHeight:block.lastValidBlockHeight},"confirmed");
  if(confirmation.value.err)throw Error("Solana reported a transaction failure.");
  D.receipt.hidden=false;D.signature.textContent=signature;
  D.receiptLink.href="https://explorer.solana.com/tx/"+signature+"?cluster=devnet";
  saveHistory(signature,draft.amount);trace("Solana Devnet confirmed the transfer.");
  stage(4,[1,2,3,4]);status("Transaction confirmed. Your receipt is available.","success");
  await refreshBalance(true).catch(()=>{});
  D.receipt.scrollIntoView({behavior:"smooth",block:"nearest"});
 }catch(error){
  trace("Execution stopped: "+(error.message||"Unknown wallet error"));
  status("Transaction not confirmed: "+(error.message||"Unknown wallet error"),"error");
  stage(2,[1]);
 }finally{D.approve.textContent="Approve in wallet"}
}
function newTask(){
 if(busy)return;D.input.value="";resetReview();status("New task ready. No transaction is pending.");D.input.focus();window.scrollTo({top:0,behavior:"smooth"})
}
function sampleBalance(){
 if(busy)return;resetReview();D.input.value="Check my Solana Devnet wallet balance and tell me how much SOL I have.";D.input.focus();status("Balance check loaded. Run the instruction to continue.")
}
function sampleTransfer(){
 if(busy)return;resetReview();D.input.value="Send 0.05 SOL to [PASTE_DEVNET_WALLET_ADDRESS] but keep at least 0.20 SOL.";D.input.focus();status("Replace the placeholder with a real recipient Devnet wallet address.","");
}
async function checkAgent(){
 try{
  const response=await fetch("/api/agent");if(!response.ok)throw Error("Unable to reach agent");
  const data=await response.json();
  D.model.textContent=data.aiConfigured?(String(data.model||"").toLowerCase().includes("deepseek")?"DeepSeek · ready":"AI configured"):"Local fallback";
 }catch(error){D.model.textContent="Local fallback"}
}
D.form.addEventListener("submit",analyze);
D.input.addEventListener("keydown",event=>{if(event.key==="Enter"&&(event.ctrlKey||event.metaKey))analyze(event)});
D.connect.addEventListener("click",()=>connectWallet());
D.contextConnect.addEventListener("click",()=>connectWallet());
D.refresh.addEventListener("click",()=>refreshBalance().catch(error=>status(error.message,"error")));
D.approve.addEventListener("click",approve);
$("balancePrompt").addEventListener("click",sampleBalance);
$("transferPrompt").addEventListener("click",sampleTransfer);
$("newTaskBtn").addEventListener("click",newTask);
$("activityNav").addEventListener("click",()=>$("activityPanel").scrollIntoView({behavior:"smooth",block:"center"}));
$("guideNav").addEventListener("click",()=>$("guidePanel").scrollIntoView({behavior:"smooth",block:"center"}));
renderHistory();stage(1);checkAgent();
})();

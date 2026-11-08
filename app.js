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
 history:$("activityList"),historyCount:$("activityCount"),thread:$("conversationMessages"),followup:$("followupInput")
};
let provider=null,publicKey=null,balanceLamports=null,pending=null,busy=false;
let submittedSignature=null,submittedAmount=null,dialog=[],deferredProposal=null;
const PENDING_STORAGE="operator:pending-devnet-tx:v1";
const SDK=()=>{if(!window.solanaWeb3)throw Error("Solana library failed to load. Reload the page.");return window.solanaWeb3};
const conn=()=>new (SDK().Connection)(RPC,"confirmed");
const fmt=(n,d=4)=>Number.isFinite(n)?new Intl.NumberFormat("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):"—";
const short=s=>s?s.slice(0,5)+"…"+s.slice(-5):"—";
const stageNames=["Describe","Review","Approve","Verify"];
function status(message,tone=""){D.message.textContent=message;D.message.className="inline-message"+(tone?" "+tone:"")}
function stage(active,completed=[]){stageNames.forEach((name,i)=>{const node=$("stage"+name),n=i+1;node.classList.toggle("active",active===n);node.classList.toggle("complete",completed.includes(n))})}
function trace(text){
 const message=String(text).slice(0,500);
 const li=document.createElement("li");li.textContent=message;
 li.dataset.type=/^Tool|^DeepSeek|agent|planner/i.test(message)?"agent":/RPC|balance read|Devnet|Network:|network fee/i.test(message)?"rpc":/wallet|signed|signature/i.test(message)?"wallet":/policy|limit|reserve|blocked|checks passed/i.test(message)?"policy":/fallback|parser/i.test(message)?"fallback":"status";
 D.trace.appendChild(li);
}
function setBusy(value){busy=value;D.run.disabled=value;D.runLabel.textContent=value?"Thinking…":"Send";$("followupSend").disabled=value}
function resetReview(keepChat=false){
 pending=null;deferredProposal=null;D.approve.disabled=true;D.approve.textContent="Continue to wallet";
 D.review.hidden=true;D.receipt.hidden=true;D.readout.hidden=true;
 D.trace.replaceChildren();$("traceDetails").open=false;stage(1);
 if(!keepChat){dialog=[];D.thread.replaceChildren();D.response.hidden=true;D.followup.value=""}
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
 if(!quiet)status("Balance updated from Devnet.","success");
 return value;
}
async function connectWallet(silent=false){
 try{
  provider=window.phantom?.solana||window.solana||null;
  if(!provider){
   const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
   if(mobile){
     const guide=$("mobileWalletHelp");guide.hidden=false;
     const currentUrl=window.location.origin+window.location.pathname;
     $("openPhantomLink").href="https://phantom.app/ul/browse/"+encodeURIComponent(currentUrl)+"?ref="+encodeURIComponent(window.location.origin);
     throw Error("Open this page in Phantom's in-app browser to connect your wallet.");
   }
   throw Error("Install a Solana wallet such as Phantom, then reload this page.");
  }
  const answer=await provider.connect();
  publicKey=new (SDK().PublicKey)(answer.publicKey.toString());
  D.connectLabel.textContent=short(publicKey.toBase58());
  D.address.textContent=publicKey.toBase58();
  D.contextConnect.hidden=true;D.refresh.hidden=false;
  await refreshBalance(true);
  if(!silent)status("Wallet connected. Balance loaded.","success");
  if(deferredProposal){const proposal=deferredProposal;deferredProposal=null;try{await makeTransfer(proposal,"")}catch(error){status(error.message||"Could not prepare the transfer.","error")}}
  return true;
 }catch(error){status(error.message||"Unable to connect a wallet.","error");return false}
}
function addMessage(role,text){
 D.response.hidden=false;
 const row=document.createElement("div");row.className="chat-turn "+role;
 const label=document.createElement("span");label.className="chat-role";label.textContent=role==="user"?"You":"DeepSeek";
 const body=document.createElement("p");body.textContent=String(text||"");
 row.append(label,body);D.thread.appendChild(row);row.scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function agent(text,history){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000);
 try{
  const res=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instruction:text,wallet:publicKey?.toBase58()||null,history:history.slice(-12)}),signal:ctrl.signal});
  const result=await res.json().catch(()=>null);
  if(!res.ok)throw Error(result?.error||"DeepSeek is unavailable.");
  if(!result||!["reply","balance","transfer"].includes(result.intent))throw Error("Agent response is invalid.");
  return result;
 }finally{clearTimeout(timer)}
}
function renderAgent(result){
 const answer=String(result.message||"Could you clarify?");
 addMessage("assistant",answer);dialog.push({role:"assistant",content:answer});
 D.source.textContent="DeepSeek";D.model.textContent="DeepSeek · active";
 (Array.isArray(result.steps)?result.steps:[]).forEach(trace);
}
async function makeTransfer(result,text){
 const sol=SDK(),amount=Number(result.amountSol),aiMinimum=Number(result.minimumBalanceSol??0);
 if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(aiMinimum)||aiMinimum<0)throw Error("The proposed amount or reserve is invalid.");
 const userMessages=dialog.filter(m=>m.role==="user").map(m=>m.content).join("\n");
 if(typeof result.recipient!=="string"||!userMessages.includes(result.recipient))throw Error("The recipient address was not provided by you. No transfer was prepared.");
 const recipient=new (sol.PublicKey)(result.recipient);
 const lamports=Math.round(amount*sol.LAMPORTS_PER_SOL);
 const minSol=aiMinimum;

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
 trace("Recipient matched a user-provided address. Check amount and recipient in the review.");
 trace("Minimum balance shown in the transfer review was enforced.");
 if(remaining<minLamports||remaining<0){
  pending=null;showPolicy(false,"Sending this amount would leave less SOL than you asked to keep. No transfer will be sent.");
  trace("Balance limit not met. Signing disabled.");stage(2,[1]);status("You need to lower the amount or change your limit.","error");
 }else{
  pending={tx,lamports,reserve:minLamports,amount};
  showPolicy(true,"The amount fits your limit, including the estimated fee. Review the details before signing.");
  if(result.mode==="ai")D.explanation.textContent="The amount and recipient match your request. Review the estimated fee and balance left below.";
  trace("Checks passed. Only your wallet can sign.");
  stage(3,[1,2]);status("Review the amount and recipient, then continue to your wallet.","success");
 }
 D.review.scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function analyze(event){
 if(event)event.preventDefault();
 if(busy)return;
 const text=D.input.value.trim();
 if(!text){status("Write a message first.","error");D.input.focus();return}
 if(submittedSignature){status("Check your previously submitted transfer before starting another.","error");$("progressPanel").scrollIntoView({behavior:"smooth",block:"nearest"});return}
 resetReview(true);
 const past=dialog.slice(-12);dialog.push({role:"user",content:text});addMessage("user",text);
 D.input.value="";setBusy(true);status("DeepSeek is reading your message…");
 let agentResponded=false;
 try{
  const result=await agent(text,past);renderAgent(result);agentResponded=true;
  if(result.intent==="balance"){
   if(publicKey){
    const value=await refreshBalance(true);
    D.readout.hidden=false;D.observed.textContent=fmt(value/SDK().LAMPORTS_PER_SOL,6);
    trace("Balance verified through Solana Devnet RPC.");
    status("Balance checked.","success");
   }else status("Connect your wallet to check its balance.");
   stage(2,[1]);
  }else if(result.intent==="transfer"){
   if(!publicKey){deferredProposal=result;stage(2,[1]);status("Connect your wallet to review the proposed transfer.");}
   else await makeTransfer(result,text);
  }else{stage(1);status("Reply below to continue.");}
  D.followup.focus({preventScroll:true});
 }catch(error){
  if(agentResponded){
   const explanation="I couldn't complete that step: "+(error.message||"Please check the details.");
   addMessage("assistant",explanation);dialog.push({role:"assistant",content:explanation});
   trace("Transfer review stopped. No transaction sent.");
  }else{
   dialog.pop();addMessage("assistant","DeepSeek couldn't respond. Please try sending your message again.");
   D.input.value=text;trace("Agent request failed. Nothing was sent.");
  }
  status(error.message||"Nothing was sent.","error");
 }finally{setBusy(false)}
}
function getHistory(){
 try{const data=JSON.parse(localStorage.getItem(STORAGE)||"[]");return Array.isArray(data)?data.filter(x=>x&&typeof x.signature==="string"&&/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(x.signature)).slice(0,5):[]}
 catch(error){return []}
}
function renderHistory(){
 const items=getHistory();D.historyCount.textContent=String(items.length);D.history.replaceChildren();
 if(!items.length){const p=document.createElement("p");p.className="no-activity";p.textContent="Confirmed transfers from this browser will appear here.";D.history.appendChild(p);return}
 items.forEach(item=>{
  const row=document.createElement("div");row.className="activity-item";
  const amount=document.createElement("strong");amount.textContent=fmt(Number(item.amount),4)+" SOL sent";
  const link=document.createElement("a");link.href="https://explorer.solana.com/tx/"+item.signature+"?cluster=devnet";link.target="_blank";link.rel="noopener noreferrer";link.textContent="View on Explorer ↗";
  const time=document.createElement("time");time.dateTime=item.date;time.textContent=new Date(item.date).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  row.append(amount,link,time);D.history.appendChild(row);
 });
}
function saveHistory(signature,amount){
 try{const rows=[{signature,amount,date:new Date().toISOString()},...getHistory().filter(x=>x.signature!==signature)].slice(0,5);localStorage.setItem(STORAGE,JSON.stringify(rows))}
 catch(error){}
 renderHistory();
}
// Transaction evidence stays visible if confirmation is delayed or the page reloads.
function progress(phase,message,signature){
 const phases=["validated","wallet","submitted","confirmed"];
 const index=phases.indexOf(phase);
 const current=index<0?(phase==="unknown"?2:1):index;
 $("progressPanel").hidden=false;
 const ids=["pValidate","pWallet","pSubmitted","pConfirmed"];
 ids.forEach((id,i)=>{
  const node=$(id);node.className="";
  if(phase==="confirmed"||i<current)node.classList.add("complete");
  else if(i===current)node.classList.add(phase==="failed"?"failed":"current");
 });
 const names={validated:"Checked",wallet:"Awaiting signature",submitted:"Submitted",unknown:"Status unknown",confirmed:"Confirmed",failed:"Stopped"};
 $("progressBadge").textContent=names[phase]||"Checking";
 $("progressMessage").textContent=message;
 if(signature){
  submittedSignature=signature;
  $("pendingExplorer").href="https://explorer.solana.com/tx/"+signature+"?cluster=devnet";
  $("pendingExplorer").hidden=false;
  $("checkSignatureBtn").hidden=phase==="confirmed";
 } else {
  $("pendingExplorer").hidden=!submittedSignature;
  $("checkSignatureBtn").hidden=!submittedSignature;
 }
}
function persistSubmitted(signature,amount){
 submittedSignature=signature;submittedAmount=amount;
 try{localStorage.setItem(PENDING_STORAGE,JSON.stringify({signature,amount,at:Date.now()}))}catch(_){}
}
function clearSubmitted(){
 try{localStorage.removeItem(PENDING_STORAGE)}catch(_){}
 submittedSignature=null;submittedAmount=null;
}
function confirmedReceipt(signature,amount){
 $("progressPanel").hidden=false;progress("confirmed","Confirmed on Solana Devnet.",signature);
 D.receipt.hidden=false;D.signature.textContent=signature;
 D.receiptLink.href="https://explorer.solana.com/tx/"+signature+"?cluster=devnet";
 if(Number.isFinite(amount))saveHistory(signature,amount);
 clearSubmitted();
 stage(4,[1,2,3,4]);
 status("Transfer confirmed. Receipt available below.","success");
}
async function checkSubmittedStatus(){
 if(!submittedSignature)return;
 const sig=submittedSignature;
 $("checkSignatureBtn").disabled=true;
 try{
  const response=await conn().getSignatureStatuses([sig],{searchTransactionHistory:true});
  const value=response?.value?.[0];
  if(!value){progress("unknown","No confirmation found yet. Check the Explorer link before trying another transfer.",sig);return}
  if(value.err){progress("failed","Solana reported a transaction error. See Explorer for details.",sig);$("checkSignatureBtn").hidden=true;clearSubmitted();status("The transaction failed on-chain. You can start a new request.","error");return}
  if(["confirmed","finalized"].includes(value.confirmationStatus)){
    confirmedReceipt(sig,submittedAmount);
    trace("Solana RPC confirmed transaction "+sig);
    return;
  }
  progress("submitted","The transaction is being processed. You can check again.",sig);
 }catch(error){
  progress("unknown","Could not check confirmation now. Your transaction ID is saved; use Explorer to verify.",sig);
 }finally{$("checkSignatureBtn").disabled=false}
}
function restoreSubmitted(){
 try{
  const stored=JSON.parse(localStorage.getItem(PENDING_STORAGE)||"null");
  if(stored&&/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(stored.signature)){
   submittedSignature=stored.signature;submittedAmount=Number(stored.amount);
   progress("unknown","An earlier transfer was submitted. Check its status before sending again.",stored.signature);
  }
 }catch(_){}
}
async function showDemo(){
 $("demoPanel").hidden=false;
 $("demoPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
 await loadDemo();
}
async function loadDemo(){
 $("demoStatus").textContent="Loading a recent finalized Devnet transaction…";
 $("demoExplorer").hidden=true;$("demoRetryBtn").disabled=true;
 try{
  const response=await fetch("/api/demo",{cache:"no-store"});
  if(!response.ok)throw Error("Network example unavailable");
  const info=await response.json();
  if(!info.ok||!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(info.signature)||!Number.isSafeInteger(info.slot))throw Error("No verifiable example");
  $("demoStatus").textContent="Recent finalized Devnet transaction · slot "+info.slot+". This transaction was not created by Solana Operator.";
  $("demoExplorer").href="https://explorer.solana.com/tx/"+info.signature+"?cluster=devnet";
  $("demoExplorer").hidden=false;
 }catch(error){
  $("demoStatus").textContent="A network example could not be loaded right now. The walkthrough above is illustrative and does not send anything.";
 }finally{$("demoRetryBtn").disabled=false}
}
async function approve(){
 if(busy||!pending||!provider||!publicKey)return;
 const draft=pending;pending=null;setBusy(true);D.approve.disabled=true;D.approve.textContent="Open your wallet…";
 progress("validated","Rechecking your balance and the fee before signing.");
 let signedSignature=null;
 status("Checking the balance and fee again…");
 try{
  if(provider.publicKey?.toString()!==publicKey.toBase58())throw Error("Connected wallet changed. Re-run the instruction.");
  const rpc=conn(),current=await rpc.getBalance(publicKey),block=await rpc.getLatestBlockhash("confirmed");
  draft.tx.recentBlockhash=block.blockhash;
  const fee=await rpc.getFeeForMessage(draft.tx.compileMessage(),"confirmed");
  if(!fee||fee.value===null||current-draft.lamports-fee.value<draft.reserve)throw Error("The balance or fee changed and the policy no longer allows this transfer.");
  if(typeof provider.signTransaction!=="function")throw Error("Your wallet cannot sign a Solana transaction.");
  trace("Final balance and fee check passed.");
  progress("wallet","Your wallet is waiting for your approval.");
  trace("Wallet signature requested. No transaction submitted yet.");
  status("Review and approve the transfer in your wallet.");
  const signed=await provider.signTransaction(draft.tx);
  const signature=await rpc.sendRawTransaction(signed.serialize());
  signedSignature=signature;persistSubmitted(signature,draft.amount);
  progress("submitted","Transaction submitted to Devnet. Waiting for network confirmation.",signature);
  trace("Signed transaction submitted: "+signature);
  stage(4,[1,2,3]);status("Transfer submitted. Checking its status on Devnet…");
  const confirmation=await rpc.confirmTransaction({signature,blockhash:block.blockhash,lastValidBlockHeight:block.lastValidBlockHeight},"confirmed");
  if(confirmation.value.err)throw Error("Solana reported a transaction failure.");
  confirmedReceipt(signature,draft.amount);trace("Solana Devnet confirmed the transfer.");
  await refreshBalance(true).catch(()=>{});
  D.receipt.scrollIntoView({behavior:"smooth",block:"nearest"});
 }catch(error){
  trace("Execution stopped: "+(error.message||"Unknown wallet error"));
  if(signedSignature){
   const knownFailure=String(error.message||"").includes("Solana reported a transaction failure");
   progress(knownFailure?"failed":"unknown",knownFailure?"Solana reported a failed transaction. See Explorer.":"Submitted, but confirmation could not be verified. Do not resend yet; use Check status or Explorer.",signedSignature);
   if(knownFailure){$("checkSignatureBtn").hidden=true;clearSubmitted();status("This transaction failed on-chain. You can start a new request.","error");}
   else status("Confirmation is still unknown. Check the existing transaction first.","error");
  }else{
   progress("failed",error.message||"Wallet approval was cancelled.");
   status("No confirmed transfer. "+(error.message||"Wallet request stopped."),"error");
   stage(2,[1]);
  }
 }finally{D.approve.textContent="Continue to wallet";setBusy(false)}
}
function newTask(){
 if(busy)return;
 if(submittedSignature){status("An earlier transfer is still unconfirmed. Check its status before starting another.","error");$("progressPanel").scrollIntoView({behavior:"smooth",block:"nearest"});return;}D.input.value="";resetReview();status("Ready for another request.");D.input.focus();window.scrollTo({top:0,behavior:"smooth"})
}
function sampleBalance(){
 if(busy)return;resetReview();D.input.value="How much SOL do I have?";D.input.focus();status("Message ready to send.")
}
function sampleTransfer(){
 if(busy)return;resetReview();D.input.value="I want to send 0.05 SOL, but keep at least 0.20 SOL in my wallet.";D.input.focus();status("DeepSeek will ask for any missing details.");
}
async function checkAgent(){
 try{
  const response=await fetch("/api/agent");if(!response.ok)throw Error("Unable to reach agent");
  const data=await response.json();
  D.model.textContent=data.aiConfigured?(String(data.model||"").toLowerCase().includes("deepseek")?"DeepSeek configured":"AI configured"):"Built-in parser";
 }catch(error){D.model.textContent="Local fallback"}
}
$("followupForm").addEventListener("submit",event=>{
 event.preventDefault();if(busy)return;
 const message=D.followup.value.trim();if(!message)return;
 D.input.value=message;D.followup.value="";analyze();
});
$("demoBtn").addEventListener("click",showDemo);
$("demoRetryBtn").addEventListener("click",loadDemo);
$("demoCloseBtn").addEventListener("click",()=>{$("demoPanel").hidden=true});
$("checkSignatureBtn").addEventListener("click",checkSubmittedStatus);
D.form.addEventListener("submit",analyze);
D.input.addEventListener("keydown",event=>{if(event.key==="Enter"&&(event.ctrlKey||event.metaKey))analyze(event)});
D.connect.addEventListener("click",()=>connectWallet());
D.contextConnect.addEventListener("click",()=>connectWallet());
D.refresh.addEventListener("click",()=>refreshBalance().catch(error=>status(error.message,"error")));
D.approve.addEventListener("click",approve);
$("balancePrompt").addEventListener("click",sampleBalance);
$("transferPrompt").addEventListener("click",sampleTransfer);
$("newTaskBtn").addEventListener("click",newTask);
$("mobileNewTaskBtn").addEventListener("click",newTask);
$("activityNav").addEventListener("click",()=>$("activityPanel").scrollIntoView({behavior:"smooth",block:"center"}));
$("guideNav").addEventListener("click",()=>$("guidePanel").scrollIntoView({behavior:"smooth",block:"center"}));
renderHistory();restoreSubmitted();stage(1);checkAgent();
})();

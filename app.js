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
 const label=document.createElement("span");label.className="chat-role";label.textContent=role==="user"?"You":"Operator";
 const body=document.createElement("p");body.textContent=String(text||"");
 row.append(label,body);D.thread.appendChild(row);row.scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function agent(text,history){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000);
 try{
  const res=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instruction:text,wallet:publicKey?.toBase58()||null,history:history.slice(-12)}),signal:ctrl.signal});
  const result=await res.json().catch(()=>null);
  if(!res.ok)throw Error(result?.error||"The agent is unavailable.");
  if(!result||!["reply","balance","transfer","bulk_transfer"].includes(result.intent))throw Error("Agent response is invalid.");
  return result;
 }finally{clearTimeout(timer)}
}
function renderAgent(result){
 const answer=String(result.message||"Could you clarify?");
 addMessage("assistant",answer);dialog.push({role:"assistant",content:answer});
 D.source.textContent="Operator";D.model.textContent="AI agent · active";
 (Array.isArray(result.steps)?result.steps:[]).forEach(trace);
}
async function makeTransfer(result,text){
 const sol=SDK();
 const bulk=result.intent==="bulk_transfer"||result.type==="bulk";
 const proposed=bulk?result.transfers:[{recipient:result.recipient,amountSol:result.amountSol}];
 if(!Array.isArray(proposed)||proposed.length<(bulk?2:1)||proposed.length>10)throw Error("Enter between 2 and 10 recipients for a bulk transfer.");
 const minFromModel=Number(result.minimumBalanceSol??0);
 if(!Number.isFinite(minFromModel)||minFromModel<0)throw Error("Invalid minimum balance. Nothing was prepared.");
 const userMessages=dialog.filter(m=>m.role==="user").map(m=>m.content).join("\n");
 const amounts=[];const seen=new Set();
 for(const row of proposed){
  const recipientText=typeof row?.recipient==="string"?row.recipient.trim():"";
  if(!recipientText||!userMessages.includes(recipientText))throw Error("One recipient address wasn't supplied in this conversation. Please check your list.");
  let recipient;
  try{recipient=new sol.PublicKey(recipientText)}catch(_){throw Error("One recipient address is invalid. Please check your list.");}
  const address=recipient.toBase58();
  if(seen.has(address))throw Error("The same recipient appears twice. Please combine that recipient's amounts or correct the addresses.");
  if(address===publicKey.toBase58())throw Error("Your own wallet appears in the recipient list. Remove it to continue.");
  seen.add(address);
  const amount=Number(row.amountSol);
  const lamports=Math.round(amount*sol.LAMPORTS_PER_SOL);
  if(!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(lamports)||lamports<=0||Math.abs(amount*sol.LAMPORTS_PER_SOL-lamports)>0.00001){
   throw Error("One transfer amount is invalid. Amounts must be positive, with up to nine decimal places.");
  }
  amounts.push({address,recipient,amount,lamports});
 }
 const totalLamports=amounts.reduce((sum,x)=>sum+x.lamports,0);
 const reserveSol=minFromModel;
 const reserveLamports=Math.ceil(reserveSol*sol.LAMPORTS_PER_SOL);
 if(!Number.isSafeInteger(totalLamports)||!Number.isSafeInteger(reserveLamports)||reserveLamports<0)throw Error("The total or reserve is too large to process.");
 // Optional numeric-language sanity check adds a stronger reserve; it never weakens the model's reserve.
 const minMatches=[...userMessages.matchAll(/(?:keep|leave|retain|reserve|at least|minimum(?: of)?)\s+(\d+(?:\.\d+)?)\s*sols?\b/gi)];
 let reserve=reserveLamports;
 for(const entry of minMatches){
  const userMin=Math.ceil(Number(entry[1])*sol.LAMPORTS_PER_SOL);
  if(Number.isSafeInteger(userMin)&&userMin>reserve)reserve=userMin;
 }
 const connRPC=conn();
 const balance=await refreshBalance(true);
 const latest=await connRPC.getLatestBlockhash("confirmed");
 const transaction=new sol.Transaction({feePayer:publicKey,recentBlockhash:latest.blockhash});
 for(const row of amounts)transaction.add(sol.SystemProgram.transfer({fromPubkey:publicKey,toPubkey:row.recipient,lamports:row.lamports}));
 // Legacy Solana transactions have a strict size ceiling. Refuse, do not silently omit recipients.
 const serialized=transaction.serialize({requireAllSignatures:false,verifySignatures:false});
 if(serialized.length>1232)throw Error("The complete batch does not fit in one Solana transaction. Try fewer recipients.");
 const feeResult=await connRPC.getFeeForMessage(transaction.compileMessage(),"confirmed");
 if(!feeResult||feeResult.value===null)throw Error("Network fee unavailable. No transfer was prepared.");
 const fee=feeResult.value;
 const remaining=balance-totalLamports-fee;
 D.review.hidden=false;
 D.amount.textContent=(totalLamports/sol.LAMPORTS_PER_SOL).toLocaleString("en-US",{maximumFractionDigits:9});
 $("totalAmountLabel").textContent=bulk?"TOTAL TO SEND":"AMOUNT";
 $("singleRecipientArea").hidden=bulk;
 $("bulkRecipientArea").hidden=!bulk;
 if(bulk){
  $("bulkRecipientCount").textContent=amounts.length+" wallets";
  const rows=$("bulkRecipientRows");rows.replaceChildren();
  amounts.forEach((t,i)=>{
   const tr=document.createElement("tr");
   const no=document.createElement("td");no.textContent=String(i+1);
   const recipient=document.createElement("td");recipient.className="bulk-address";recipient.textContent=t.address;
   const value=document.createElement("td");value.textContent=t.amount.toLocaleString("en-US",{maximumFractionDigits:9});
   tr.append(no,recipient,value);rows.appendChild(tr);
  });
 }else D.recipient.textContent=amounts[0].address;
 D.current.textContent=fmt(balance/sol.LAMPORTS_PER_SOL,6)+" SOL";
 D.fee.textContent=fmt(fee/sol.LAMPORTS_PER_SOL,6)+" SOL";
 D.minimum.textContent=fmt(reserve/sol.LAMPORTS_PER_SOL,6)+" SOL";
 D.remaining.textContent=fmt(remaining/sol.LAMPORTS_PER_SOL,6)+" SOL";
 trace("Solana RPC: fetched balance and estimated one transaction fee.");
 trace("Review: "+amounts.length+" explicit recipient address"+(amounts.length===1?"":"es")+"; total "+D.amount.textContent+" SOL.");
 trace("Policy: reserve "+fmt(reserve/sol.LAMPORTS_PER_SOL,6)+" SOL after transfer and fees.");
 if(remaining<reserve||remaining<0){
  pending=null;
  showPolicy(false,"The total plus network fee would leave less than your minimum balance. Nothing can be signed.");
  trace("Policy blocked the full batch.");
  stage(2,[1]);status("The total exceeds your available spending amount.","error");
 }else{
  pending={tx:transaction,lamports:totalLamports,reserve,amount:totalLamports/sol.LAMPORTS_PER_SOL,count:amounts.length};
  showPolicy(true,bulk?"All "+amounts.length+" transfers will be sent together in one transaction if you approve.":"The amount fits your limit, including the estimated fee. Review before signing.");
  trace("Wallet: awaiting your signature. No SOL sent yet.");
  stage(3,[1,2]);
  status(bulk?"Review all "+amounts.length+" recipients, then approve one transaction in your wallet.":"Review the amount and recipient, then continue to your wallet.","success");
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
 D.input.value="";setBusy(true);status("Checking your request…");
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
  }else if(result.intent==="transfer"||result.intent==="bulk_transfer"){
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
 if(busy)return;resetReview();D.input.value="I want to send 0.05 SOL, but keep at least 0.20 SOL in my wallet.";D.input.focus();status("The agent can ask for any missing details.");
}
async function checkAgent(){
 try{
  const response=await fetch("/api/agent");if(!response.ok)throw Error("Unable to reach agent");
  const data=await response.json();
  D.model.textContent=data.aiConfigured?"AI agent ready":"AI agent unavailable";
 }catch(error){D.model.textContent="AI agent unavailable"}
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
$("bulkPrompt").addEventListener("click",()=>{if(busy)return;resetReview();D.input.value="I need to send SOL to several wallets. Can you help me set up a bulk transfer?";D.input.focus();status("The agent will collect recipients, amounts, and any minimum balance.");});
$("newTaskBtn").addEventListener("click",newTask);
$("mobileNewTaskBtn").addEventListener("click",newTask);
$("activityNav").addEventListener("click",()=>$("activityPanel").scrollIntoView({behavior:"smooth",block:"center"}));
$("guideNav").addEventListener("click",()=>$("guidePanel").scrollIntoView({behavior:"smooth",block:"center"}));
renderHistory();restoreSubmitted();stage(1);checkAgent();
})();

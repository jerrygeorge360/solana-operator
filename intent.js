(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.OperatorIntent=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const amountPattern=/\b(?:send|transfer|pay|move)\s+(?:(?:me|him|her|them)\s+)?(\d+(?:\.\d+)?)\s*sols?\b/i;
  const balancePattern=/\b(?:balance|how much|funds|check my wallet|wallet balance)\b/i;
  const transferPattern=/\b(?:send|transfer|pay|move)\b/i;
  const reservePattern=/\b(?:keep|retain|leave|reserve|minimum|at least)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*sols?\b/i;
  const addressPattern=/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  function parse(text){
    text=String(text||"");
    const amountMatch=text.match(amountPattern);
    const reserveMatch=text.match(reservePattern);
    const addresses=[...text.matchAll(addressPattern)];
    const recipientMatches=addresses.filter(x=>/\b(?:to|recipient|destination)\b/i.test(text.slice(0,x.index)));
    const amount=amountMatch?Number(amountMatch[1]):null;
    const minimum=reserveMatch?Number(reserveMatch[1]):null;
    return {
      transferRequested:transferPattern.test(text),
      balanceRequested:balancePattern.test(text),
      amountSol:Number.isFinite(amount)?amount:null,
      minimumBalanceSol:Number.isFinite(minimum)?minimum:null,
      recipient:recipientMatches.length===1?recipientMatches[0][0]:null,
      recipientCount:recipientMatches.length
    };
  }
  return {parse};
});
